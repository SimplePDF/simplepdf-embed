import OAuthProvider from '@cloudflare/workers-oauth-provider';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpAgent } from 'agents/mcp';
import { z } from 'zod';
import { GitHubHandler } from './github-handler.js';

type Props = {
  login: string;
  name: string;
  email: string;
  accessToken: string;
};

export class SimplePdfMcp extends McpAgent<Env, Record<string, never>, Props> {
  server = new McpServer({
    name: 'simplepdf-mcp',
    version: '0.0.1',
  });

  async init(): Promise<void> {
    this.server.tool(
      'display_pdf',
      {
        url: z.string().describe('URL of the PDF document to load'),
        name: z.string().optional().describe('Display name for the document'),
        page: z.number().int().positive().optional().describe('Initial page to display (1-indexed)'),
      },
      async ({ url, name, page }) => ({
        content: [
          {
            type: 'text',
            text: `Opening PDF editor with document: ${name ?? url}\n\nOpen the SimplePDF editor to view and annotate the document:\nhttps://simplepdf.com/editor?open=${encodeURIComponent(url)}${page ? `&page=${page}` : ''}`,
          },
        ],
      })
    );

    this.server.tool(
      'add_annotation',
      {
        type: z.enum(['TEXT', 'BOXED_TEXT', 'CHECKBOX', 'SIGNATURE', 'PICTURE']).describe('Type of annotation'),
        page: z.number().int().positive().describe('Page number (1-indexed)'),
        x: z.number().describe('X coordinate in PDF points from left'),
        y: z.number().describe('Y coordinate in PDF points from bottom'),
        width: z.number().positive().describe('Width in PDF points'),
        height: z.number().positive().describe('Height in PDF points'),
        value: z.string().optional().describe('Initial value for the annotation'),
      },
      async (args) => ({
        content: [
          {
            type: 'text',
            text: `Annotation added:\n- Type: ${args.type}\n- Page: ${args.page}\n- Position: (${args.x}, ${args.y})\n- Size: ${args.width}x${args.height}${args.value ? `\n- Value: ${args.value}` : ''}`,
          },
        ],
      })
    );

    this.server.tool(
      'extract_content',
      {
        extraction_mode: z.enum(['auto', 'ocr']).optional().default('auto').describe('Extraction mode: auto or ocr'),
      },
      async ({ extraction_mode }) => ({
        content: [
          {
            type: 'text',
            text: `Extracting document content using ${extraction_mode} mode...\n\nNote: Content extraction requires an active document in the SimplePDF editor.`,
          },
        ],
      })
    );

    this.server.tool(
      'navigate_page',
      {
        page: z.number().int().positive().describe('Page number to navigate to (1-indexed)'),
      },
      async ({ page }) => ({
        content: [
          {
            type: 'text',
            text: `Navigated to page ${page}`,
          },
        ],
      })
    );

    this.server.tool(
      'submit_document',
      {
        download_copy: z.boolean().optional().default(false).describe('Whether to trigger download of the filled PDF'),
      },
      async ({ download_copy }) => ({
        content: [
          {
            type: 'text',
            text: `Document submitted${download_copy ? ' with download triggered' : ''}`,
          },
        ],
      })
    );

    this.server.tool(
      'clear_annotations',
      {
        field_ids: z.array(z.string()).optional().describe('Specific field IDs to remove (omit to clear all)'),
        page: z.number().int().positive().optional().describe('Only clear fields on this page'),
      },
      async ({ field_ids, page }) => ({
        content: [
          {
            type: 'text',
            text: (() => {
              if (field_ids) {
                return `Cleared ${field_ids.length} annotation(s)`;
              }
              if (page) {
                return `Cleared all annotations on page ${page}`;
              }
              return 'Cleared all annotations';
            })(),
          },
        ],
      })
    );
  }
}

export default new OAuthProvider({
  apiRoute: '/mcp',
  apiHandler: SimplePdfMcp.mount('/mcp'),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  defaultHandler: GitHubHandler as any,
  authorizeEndpoint: '/authorize',
  tokenEndpoint: '/token',
  clientRegistrationEndpoint: '/register',
});
