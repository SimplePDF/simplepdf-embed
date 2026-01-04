# SimplePDF Editor Automation

Playwright-based CLI tool for programmatically creating and positioning fields in PDF documents using the SimplePDF editor.

## Features

- Create TEXT, BOXED_TEXT, CHECKBOX, SIGNATURE, and PICTURE fields
- Position fields using PDF standard coordinates (bottom-left origin)
- Pre-fill field values including typed signatures
- Browser opens for visual inspection after field creation

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
  "document": "https://example.com/document.pdf",
  "fields": [...]
}
```

### Document Source

| Format | Example |
|--------|---------|
| URL | `"https://example.com/doc.pdf"` |
| Local file | `"./documents/form.pdf"` |

## Field Types

### TEXT

Single-line text input.

```json
{
  "type": "TEXT",
  "x": 100,
  "y": 700,
  "width": 200,
  "height": 20,
  "page": 1,
  "value": "John Doe"
}
```

### BOXED_TEXT

Multi-line text with border.

```json
{
  "type": "BOXED_TEXT",
  "x": 100,
  "y": 600,
  "width": 300,
  "height": 100,
  "page": 1,
  "value": "Additional notes here..."
}
```

### CHECKBOX

Checkable box. Must be square (equal width/height).

```json
{
  "type": "CHECKBOX",
  "x": 100,
  "y": 550,
  "width": 12,
  "height": 12,
  "page": 1,
  "value": true
}
```

### SIGNATURE

Signature field with multiple value formats.

```json
{
  "type": "SIGNATURE",
  "x": 100,
  "y": 450,
  "width": 200,
  "height": 60,
  "page": 1,
  "value": "John Doe"
}
```

**Value formats:**

| Format | Example | Result |
|--------|---------|--------|
| Plain text | `"John Doe"` | Typed signature (cursive font) |
| URL | `"https://example.com/sig.png"` | Drawn signature from image |
| Data URL | `"data:image/png;base64,..."` | Drawn signature from base64 |
| Local file | `"./signatures/john.png"` | Drawn signature from file |

### PICTURE

Image field.

```json
{
  "type": "PICTURE",
  "x": 100,
  "y": 300,
  "width": 150,
  "height": 150,
  "page": 1,
  "value": "https://example.com/photo.jpg"
}
```

**Value formats:** URL, data URL, or local file path.

## Coordinate System

Uses PDF standard coordinates:

```
┌─────────────────────────────┐
│                             │ ↑
│                             │ │
│         PDF Page            │ │ Y increases
│                             │ │
│                             │ │
└─────────────────────────────┘
(0,0) ───────────────────────→
         X increases
```

- **Origin**: Bottom-left corner of page
- **Units**: Points (1/72 inch)
- **Y-axis**: Increases upward

## Examples

### Basic Form Fill

```json
{
  "document": "https://cdn.simplepdf.com/simple-pdf/assets/sample.pdf",
  "fields": [
    {
      "type": "TEXT",
      "x": 72,
      "y": 700,
      "width": 200,
      "height": 14,
      "page": 1,
      "value": "John"
    },
    {
      "type": "TEXT",
      "x": 320,
      "y": 700,
      "width": 200,
      "height": 14,
      "page": 1,
      "value": "Doe"
    },
    {
      "type": "SIGNATURE",
      "x": 72,
      "y": 100,
      "width": 200,
      "height": 60,
      "page": 1,
      "value": "John Doe"
    }
  ]
}
```

### Multi-Page Document

```json
{
  "document": "./documents/multi-page.pdf",
  "fields": [
    {
      "type": "TEXT",
      "x": 72,
      "y": 700,
      "width": 200,
      "height": 14,
      "page": 1,
      "value": "Page 1 content"
    },
    {
      "type": "TEXT",
      "x": 72,
      "y": 700,
      "width": 200,
      "height": 14,
      "page": 2,
      "value": "Page 2 content"
    },
    {
      "type": "SIGNATURE",
      "x": 72,
      "y": 100,
      "width": 200,
      "height": 60,
      "page": 3,
      "value": "Final Signature"
    }
  ]
}
```

## How It Works

The tool uses the SimplePDF editor's iframe postMessage API:

1. Embeds the editor in an iframe
2. Waits for `DOCUMENT_LOADED` event
3. Sends `CLEAR_FIELDS` to remove existing fields
4. Sends `CREATE_FIELD` for each configured field
5. Leaves browser open for inspection

## Requirements

- Playwright (installed automatically via npm)

## License

MIT
