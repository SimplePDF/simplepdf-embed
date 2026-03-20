# SimplePDF Editor Automation

Playwright-based CLI tool for automatically detecting form fields in PDF documents using the SimplePDF editor.

## Quick Start

```bash
npm install
npx tsx src/index.ts https://example.com/form.pdf
```

## Usage

```bash
npx tsx src/index.ts <document> [options]

Arguments:
  document              URL or local file path to a PDF

Options:
  --company-identifier  Your SimplePDF company identifier (default: embed)
  --help                Show help
```

### Examples

```bash
npx tsx src/index.ts https://example.com/form.pdf
npx tsx src/index.ts ./documents/form.pdf
npx tsx src/index.ts https://example.com/form.pdf --company-identifier mycompany
```

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
