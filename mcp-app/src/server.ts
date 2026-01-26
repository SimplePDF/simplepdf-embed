#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RESOURCE_URI = 'ui://simplepdf/editor.html';

const server = new McpServer({
  name: 'simplepdf-mcp-app',
  version: '0.0.1',
});

registerAppResource(
  server,
  'SimplePDF Editor',
  RESOURCE_URI,
  {
    description: 'Interactive PDF editor powered by SimplePDF',
  },
  async () => {
    const htmlPath = path.join(__dirname, '..', 'dist', 'ui', 'mcp-app.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    return {
      contents: [
        {
          uri: RESOURCE_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: htmlContent,
        },
      ],
    };
  }
);

registerAppTool(
  server,
  'display_pdf',
  {
    title: 'Display PDF',
    description: 'Load and display a PDF document in the SimplePDF editor. The editor will be shown in the UI where users can view and interact with the document.',
    inputSchema: {
      url: z.string().describe('URL of the PDF document to load'),
      name: z.string().optional().describe('Display name for the document'),
      page: z.number().int().positive().optional().describe('Initial page to display (1-indexed)'),
    },
    _meta: {
      ui: { resourceUri: RESOURCE_URI },
    },
  },
  async (args) => {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            action: 'LOAD_DOCUMENT',
            data: {
              data_url: args.url,
              name: args.name,
              page: args.page,
            },
          }),
        },
      ],
    };
  }
);

registerAppTool(
  server,
  'add_annotation',
  {
    title: 'Add Annotation',
    description: 'Add an annotation (text, checkbox, signature, or picture) to the PDF document at a specific position.',
    inputSchema: {
      type: z.enum(['TEXT', 'BOXED_TEXT', 'CHECKBOX', 'SIGNATURE', 'PICTURE']).describe('Type of annotation to add'),
      page: z.number().int().positive().describe('Page number (1-indexed)'),
      x: z.number().describe('X coordinate in PDF points from left'),
      y: z.number().describe('Y coordinate in PDF points from bottom'),
      width: z.number().positive().describe('Width in PDF points'),
      height: z.number().positive().describe('Height in PDF points'),
      value: z.string().optional().describe('Initial value for the annotation'),
    },
    _meta: {
      ui: { resourceUri: RESOURCE_URI },
    },
  },
  async (args) => {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            action: 'CREATE_FIELD',
            data: args,
          }),
        },
      ],
    };
  }
);

registerAppTool(
  server,
  'extract_content',
  {
    title: 'Extract Content',
    description: 'Extract text content from the loaded PDF document. Returns the text content of each page.',
    inputSchema: {
      extraction_mode: z.enum(['auto', 'ocr']).optional().default('auto').describe('Extraction mode: auto or ocr'),
    },
    _meta: {
      ui: { resourceUri: RESOURCE_URI },
    },
  },
  async (args) => {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            action: 'GET_DOCUMENT_CONTENT',
            data: { extraction_mode: args.extraction_mode },
          }),
        },
      ],
    };
  }
);

registerAppTool(
  server,
  'navigate_page',
  {
    title: 'Navigate Page',
    description: 'Navigate to a specific page in the PDF document.',
    inputSchema: {
      page: z.number().int().positive().describe('Page number to navigate to (1-indexed)'),
    },
    _meta: {
      ui: { resourceUri: RESOURCE_URI },
    },
  },
  async (args) => {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            action: 'GO_TO',
            data: { page: args.page },
          }),
        },
      ],
    };
  }
);

registerAppTool(
  server,
  'submit_document',
  {
    title: 'Submit Document',
    description: 'Submit the document with all annotations. Optionally triggers a download of the filled PDF.',
    inputSchema: {
      download_copy: z.boolean().optional().default(false).describe('Whether to trigger download of the filled PDF'),
    },
    _meta: {
      ui: { resourceUri: RESOURCE_URI },
    },
  },
  async (args) => {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            action: 'SUBMIT',
            data: { download_copy: args.download_copy },
          }),
        },
      ],
    };
  }
);

registerAppTool(
  server,
  'clear_annotations',
  {
    title: 'Clear Annotations',
    description: 'Clear annotations from the document. Can clear all annotations or specific ones by ID or page.',
    inputSchema: {
      field_ids: z.array(z.string()).optional().describe('Specific field IDs to remove (omit to clear all)'),
      page: z.number().int().positive().optional().describe('Only clear fields on this page'),
    },
    _meta: {
      ui: { resourceUri: RESOURCE_URI },
    },
  },
  async (args) => {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            action: 'CLEAR_FIELDS',
            data: {
              field_ids: args.field_ids,
              page: args.page,
            },
          }),
        },
      ],
    };
  }
);

const runServer = async (): Promise<void> => {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('SimplePDF MCP App server running on stdio');
};

runServer().catch(console.error);
