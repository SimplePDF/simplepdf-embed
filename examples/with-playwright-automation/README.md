# SimplePDF Editor Automation

Playwright-based CLI tool for automatically detecting form fields in PDF documents using the SimplePDF editor.

## Features

- Automatically detect form fields
- Browser opens for visual inspection after detection

## Quick Start

```bash
npm install
npx tsx src/index.ts example.config.json
```

## Usage

```bash
npx tsx src/index.ts <config.json> [options]

Options:
  --company-identifier  Your SimplePDF company identifier (default: embed)
  --help                Show help
```

### Using Your Company Identifier

```bash
npx tsx src/index.ts config.json --company-identifier mycompany
```

This connects to `https://mycompany.simplepdf.com`.

## Configuration

Create a JSON configuration file:

```json
{
  "document": "https://example.com/document.pdf"
}
```

### Document Source

| Format | Example |
|--------|---------|
| URL | `"https://example.com/doc.pdf"` |
| Local file | `"./documents/form.pdf"` |

## How It Works

The tool uses the SimplePDF editor's iframe postMessage API:

1. Embeds the editor in an iframe
2. Waits for `DOCUMENT_LOADED` event
3. Sends `DETECT_FIELDS` to automatically detect form fields
4. Leaves browser open for inspection

## Requirements

- Playwright (installed automatically via npm)

## License

MIT
