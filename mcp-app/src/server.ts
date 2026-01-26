import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { toolDefinitions, handleToolCall } from './tools/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const server = new Server(
  {
    name: 'simplepdf-mcp-app',
    version: '0.0.1',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: toolDefinitions,
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  return handleToolCall(name, args);
});

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'ui://simplepdf/editor.html',
        name: 'SimplePDF Editor',
        description: 'Interactive PDF editor powered by SimplePDF',
        mimeType: 'text/html',
      },
    ],
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  if (uri === 'ui://simplepdf/editor.html') {
    const htmlPath = path.join(__dirname, '..', 'mcp-app.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

    return {
      contents: [
        {
          uri,
          mimeType: 'text/html',
          text: htmlContent,
        },
      ],
    };
  }

  throw new Error(`Resource not found: ${uri}`);
});

const runServer = async (): Promise<void> => {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('SimplePDF MCP App server running on stdio');
};

runServer().catch(console.error);
