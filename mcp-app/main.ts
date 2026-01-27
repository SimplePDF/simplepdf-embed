/**
 * Entry point for running the SimplePDF MCP server.
 * Run with: node dist/index.js --stdio
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import cors from "cors";
import type { Request, Response } from "express";
import { createServer } from "./server.js";

/**
 * Starts an MCP server with Streamable HTTP transport in stateless mode.
 */
const startStreamableHTTPServer = async (
  createServerFn: () => McpServer,
): Promise<void> => {
  const port = parseInt(process.env.PORT ?? "3001", 10);

  const app = createMcpExpressApp({ host: "0.0.0.0" });
  app.use(cors());

  app.all("/mcp", async (req: Request, res: Response) => {
    const server = createServerFn();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    res.on("close", () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("MCP error:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  const httpServer = app.listen(port, (listenError) => {
    if (listenError) {
      console.error("Failed to start server:", listenError);
      process.exit(1);
    }
    console.log(`SimplePDF MCP server listening on http://localhost:${port}/mcp`);
  });

  const shutdown = (): void => {
    console.log("\nShutting down...");
    httpServer.close(() => process.exit(0));
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

/**
 * Starts an MCP server with stdio transport.
 */
const startStdioServer = async (
  createServerFn: () => McpServer,
): Promise<void> => {
  await createServerFn().connect(new StdioServerTransport());
};

const parseArgs = (): { stdio: boolean } => {
  const args = process.argv.slice(2);
  return { stdio: args.includes("--stdio") };
};

const main = async (): Promise<void> => {
  const { stdio } = parseArgs();

  console.error("[simplepdf] SimplePDF MCP server starting...");

  if (stdio) {
    await startStdioServer(createServer);
  } else {
    await startStreamableHTTPServer(createServer);
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
