# agent-pdf

Let AI agents edit and fill PDFs through [SimplePDF](https://simplepdf.com).

`GET /` serves a [SKILL.md](./SKILL.md) that any AI agent can read to learn how to use this API.

## Quick start

```bash
# From a URL
curl "https://agent.simplepdf.com?url=https://example.com/form.pdf"

# From a file
curl -X POST https://agent.simplepdf.com -F file=@document.pdf
```

Returns:

```json
{
  "url": "https://ai.simplepdf.com/editor?open=...",
  "iframe": "<iframe src=\"...\" width=\"100%\" height=\"800\" frameborder=\"0\"></iframe>",
  "react": "<EmbedPDF mode=\"inline\" companyIdentifier=\"ai\" documentURL=\"...\" />"
}
```

## Deploy

Runs on any container platform. See [.do/app.yaml](.do/app.yaml) for a DigitalOcean App Platform reference config.

Required env vars:

| Variable | Description |
|----------|-------------|
| `S3_ENDPOINT` | S3-compatible endpoint URL |
| `S3_BUCKET` | Bucket name |
| `S3_KEY` | Access key (secret) |
| `S3_SECRET` | Secret key (secret) |

Optional:

| Variable | Default | Description |
|----------|---------|-------------|
| `S3_REGION` | `us-east-1` | Bucket region |
| `S3_PUBLIC_URL` | Same as `S3_ENDPOINT` | CDN or public URL prefix for uploaded files |
| `DEFAULT_EDITOR_HOST` | `ai.simplepdf.com` | Editor host when no `companyIdentifier` is set |
| `TRUST_PROXY` | `false` | Trust `X-Forwarded-For` for rate limiting |
| `RATE_LIMIT_PER_MIN` | `30` | Requests per IP per minute |
