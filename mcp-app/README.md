# SimplePDF MCP App

An interactive PDF editor using [SimplePDF](https://simplepdf.com). View and annotate PDF documents directly in Claude Desktop.

## MCP Client Configuration

Add to your MCP client configuration (stdio transport):

```json
{
  "mcpServers": {
    "simplepdf": {
      "command": "npx",
      "args": [
        "-y",
        "--silent",
        "--registry=https://registry.npmjs.org/",
        "@simplepdf/mcp-app",
        "--stdio"
      ]
    }
  }
}
```

### Local Development

To test local modifications:

```json
{
  "mcpServers": {
    "simplepdf": {
      "command": "bash",
      "args": [
        "-c",
        "cd /path/to/simplepdf-embed/mcp-app && npm run build >&2 && node dist/index.js --stdio"
      ]
    }
  }
}
```

## Features

- View PDF documents from any publicly accessible URL
- Add text, checkboxes, signatures, and images
- Extract document content (text, OCR)
- Submit annotated documents
- Dark/light mode support

## Usage

```bash
# Development
npm run dev

# Build
npm run build

# Run with stdio (for MCP clients)
node dist/index.js --stdio

# Run with HTTP transport
node dist/index.js
```

## Tools

| Tool          | Visibility | Purpose                          |
| ------------- | ---------- | -------------------------------- |
| `display_pdf` | Model + UI | Display SimplePDF editor with PDF |

## Architecture

```
server.ts      # MCP server + tools
main.ts        # CLI entry point
src/
└── mcp-app.ts # SimplePDF iframe integration
```

## Dependencies

- `@modelcontextprotocol/ext-apps`: MCP Apps SDK
- `@modelcontextprotocol/sdk`: MCP protocol SDK
