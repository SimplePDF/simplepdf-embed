/**
 * SimplePDF MCP Server
 *
 * An MCP server that displays PDFs in SimplePDF's interactive editor.
 * SimplePDF handles document fetching, rendering, and annotation.
 *
 * Tools:
 * - display_pdf: Show interactive PDF editor
 */

import fs from "node:fs";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import type {
  CallToolResult,
  ReadResourceResult,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// =============================================================================
// Configuration
// =============================================================================

export const DEFAULT_PDF = "https://arxiv.org/pdf/1706.03762"; // Attention Is All You Need
export const RESOURCE_URI = "ui://simplepdf/mcp-app.html";

// Works both from source (server.ts) and compiled (dist/server.js)
const DIST_DIR = import.meta.filename.endsWith(".ts")
  ? path.join(import.meta.dirname, "dist")
  : import.meta.dirname;

// =============================================================================
// MCP Server Factory
// =============================================================================

export const createServer = (): McpServer => {
  const server = new McpServer({ name: "SimplePDF", version: "1.0.0" });

  // Tool: display_pdf - Show interactive editor
  registerAppTool(
    server,
    "display_pdf",
    {
      title: "Display PDF",
      description: `Display an interactive PDF editor using SimplePDF.

Features:
- View and annotate PDF documents
- Add text, checkboxes, signatures, and images
- Extract document content
- Submit annotated documents

Accepts any publicly accessible PDF URL.`,
      inputSchema: {
        url: z.string().url().default(DEFAULT_PDF).describe("PDF URL to open"),
        page: z.number().min(1).default(1).describe("Initial page number"),
      },
      outputSchema: z.object({
        url: z.string(),
        initialPage: z.number(),
      }),
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    async ({ url, page }): Promise<CallToolResult> => {
      return {
        content: [{ type: "text", text: `Opening PDF in SimplePDF: ${url}` }],
        structuredContent: {
          url,
          initialPage: page,
        },
      };
    },
  );

  // Resource: UI HTML
  registerAppResource(
    server,
    RESOURCE_URI,
    RESOURCE_URI,
    { mimeType: RESOURCE_MIME_TYPE },
    async (): Promise<ReadResourceResult> => {
      const html = await fs.promises.readFile(
        path.join(DIST_DIR, "mcp-app.html"),
        "utf-8",
      );
      return {
        contents: [
          { uri: RESOURCE_URI, mimeType: RESOURCE_MIME_TYPE, text: html },
        ],
      };
    },
  );

  return server;
};
