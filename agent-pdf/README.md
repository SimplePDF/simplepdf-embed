# agent-pdf

Lightweight Rust backend for SimplePDF's agentic PDF editing API. Accepts a PDF (URL or binary), returns ready-to-embed editor URLs.

Hosted at `agents.simplepdf.com`. `GET /` serves the skill description, `POST /` handles PDF submissions.

## Endpoints

### `GET /`

Returns `SKILL.md` as `text/markdown`. Describes the API capabilities for AI agents and users.

### `POST /`

Accepts JSON or multipart. Returns editor embed codes.

```bash
# Via URL (passthrough - no upload needed)
curl -X POST https://agents.simplepdf.com \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/form.pdf"}'

# Via file upload (stored in DO Spaces, expires after 1hr)
curl -X POST https://agents.simplepdf.com \
  -F file=@document.pdf

# With company-specific portal
curl -X POST "https://agents.simplepdf.com?companyIdentifier=acme" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/form.pdf"}'
```

#### Query parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `companyIdentifier` | No | Routes to `<identifier>.simplepdf.com` instead of `embed.simplepdf.com` |

## Deploy

1. Create a DO Spaces bucket named `agent-pdf` with a lifecycle rule (1hr expiry)
2. Set the bucket ACL to public-read
3. Push to GitHub and deploy via App Platform (uses `.do/app.yaml`)
4. Set `SPACES_KEY` and `SPACES_SECRET` in the App Platform console

## Architecture

```
Agent → POST / → Rust (upload to Spaces or URL passthrough) → JSON response
                                                                    ↓
User clicks URL → <identifier>.simplepdf.com/editor?open=PDF_URL → client-side editing
```

No database. No auth. No sessions. Bucket lifecycle handles cleanup.
