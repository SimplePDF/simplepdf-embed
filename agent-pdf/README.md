# agent-pdf

Lightweight Rust backend for SimplePDF's agentic PDF editing API. Accepts a PDF (URL or binary), returns ready-to-embed editor URLs.

Hosted at `agent.simplepdf.com`. `GET /` without params serves the SKILL.md. `GET /?url=...` returns editor links. `POST /` handles file uploads.

## Endpoints

### `GET /`

Without `url` param: returns `SKILL.md` as `text/markdown` for agent discovery.

With `url` param: returns JSON with editor embed codes.

```bash
# URL passthrough (no upload needed)
curl "https://agent.simplepdf.com?url=https://example.com/form.pdf"

# With company-specific portal
curl "https://agent.simplepdf.com?url=https://example.com/form.pdf&companyIdentifier=acme"
```

### `POST /`

File upload via multipart. Stored in DO Spaces (expires after 1hr).

```bash
curl -X POST https://agent.simplepdf.com -F file=@document.pdf

# With company-specific portal
curl -X POST "https://agent.simplepdf.com?companyIdentifier=acme" -F file=@document.pdf
```

### Query parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `url` | GET only | PDF URL to open in the editor |
| `companyIdentifier` | No | Routes to `<identifier>.simplepdf.com` instead of `embed.simplepdf.com` |

## Deploy

1. Create a DO Spaces bucket named `agent-pdf` with a lifecycle rule (1hr expiry)
2. Set the bucket ACL to public-read
3. Push to GitHub and deploy via App Platform (uses `.do/app.yaml`)
4. Set `SPACES_KEY` and `SPACES_SECRET` in the App Platform console

## Architecture

```
Agent → GET /?url=PDF_URL → JSON response (passthrough)
Agent → POST / (file)    → Rust (upload to Spaces) → JSON response
                                                          ↓
User clicks URL → <identifier>.simplepdf.com/editor?open=PDF_URL → client-side editing
```

No database. No auth. No sessions. Bucket lifecycle handles cleanup.
