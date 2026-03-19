# agent-pdf

Lightweight Rust backend for SimplePDF's agentic PDF editing API. Accepts a PDF (URL or binary), stores it in DO Spaces, returns ready-to-embed URLs.

## Endpoints

### `POST /agents`

Full PDF editor. Accepts JSON or multipart.

```bash
# Via URL
curl -X POST https://your-app.ondigitalocean.app/agents \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/form.pdf"}'

# Via file upload
curl -X POST https://your-app.ondigitalocean.app/agents \
  -F file=@document.pdf
```

## Deploy

1. Create a DO Spaces bucket named `agent-pdf` with a lifecycle rule (1hr expiry)
2. Set the bucket ACL to public-read
3. Push to GitHub and deploy via App Platform (uses `.do/app.yaml`)
4. Set `SPACES_KEY` and `SPACES_SECRET` in the App Platform console

## Architecture

```
Agent → POST /agents → Rust (upload to Spaces) → JSON response
                                                         ↓
User clicks URL → simplepdf.com/editor?open=SPACES_URL → client-side editing
```

No database. No auth. No sessions. Bucket lifecycle handles cleanup.
