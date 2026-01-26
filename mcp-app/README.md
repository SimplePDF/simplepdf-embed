# @simplepdf/mcp-app

MCP (Model Context Protocol) App for SimplePDF - Edit PDFs with AI assistants like Claude.

## Features

- Load and display PDFs in SimplePDF's browser-based editor
- Add annotations: text, checkboxes, signatures, pictures
- Extract document content (with OCR support)
- Navigate pages programmatically
- Submit/save annotated documents

## Installation

```bash
npm install @simplepdf/mcp-app
```

## Usage with Claude Desktop

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "simplepdf": {
      "command": "npx",
      "args": ["@simplepdf/mcp-app"]
    }
  }
}
```

## Available Tools

### display_pdf

Load and display a PDF document in the editor.

```json
{
  "url": "https://example.com/document.pdf",
  "name": "my-document.pdf",
  "page": 1
}
```

### add_annotation

Add an annotation to the document.

```json
{
  "type": "TEXT",
  "page": 1,
  "x": 100,
  "y": 700,
  "width": 200,
  "height": 30,
  "value": "Hello World"
}
```

Supported types: `TEXT`, `BOXED_TEXT`, `CHECKBOX`, `SIGNATURE`, `PICTURE`

### extract_content

Extract text content from the document.

```json
{
  "extraction_mode": "auto"
}
```

Modes: `auto` (default), `ocr`

### navigate_page

Navigate to a specific page.

```json
{
  "page": 3
}
```

### submit_document

Submit the document with annotations.

```json
{
  "download_copy": true
}
```

### clear_annotations

Clear annotations from the document.

```json
{
  "field_ids": ["f_abc123"],
  "page": 1
}
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build
npm run build

# Type check
npm run test:types
```

## License

MIT
