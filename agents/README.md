# agent-pdf

Give any AI agent the ability to edit and fill PDFs. No API key, no server-side processing, free.

Powered by [SimplePDF](https://simplepdf.com). [Source code](https://github.com/SimplePDF/simplepdf-embed/tree/main/agents).

## Add the [edit-pdf SKILL](https://agents.simplepdf.com/SKILL.md)

### Claude Code

```bash
curl --create-dirs -o ~/.claude/skills/edit-pdf/SKILL.md https://agents.simplepdf.com/SKILL.md
```

### Codex

```bash
curl --create-dirs -o .codex/skills/edit-pdf/SKILL.md https://agents.simplepdf.com/SKILL.md
```

## Quick start

```bash
# From a URL
curl "https://agents.simplepdf.com?url=https://example.com/form.pdf"

# From a file
curl -X POST https://agents.simplepdf.com -F file=@document.pdf
```

Returns a ready-to-use editor link:

```json
{
  "url": "https://ai.simplepdf.com/editor?open=...",
  "iframe": "<iframe src=\"...\" width=\"100%\" height=\"800\" frameborder=\"0\"></iframe>",
  "react": "<EmbedPDF mode=\"inline\" companyIdentifier=\"ai\" documentURL=\"...\" />"
}
```

The user opens the `url`, edits the PDF in-browser, and downloads the result. All client-side.

## Connect your SimplePDF account

Free to use as-is. Connect a [SimplePDF](https://simplepdf.com) account to add branding, webhooks, and storage:

```bash
curl "https://agents.simplepdf.com?url=https://example.com/form.pdf&companyIdentifier=acme"
```

With a `companyIdentifier`, you get:

- **Custom branding**: match the editor to your product ([guide](https://simplepdf.com/help/how-to/customize-the-pdf-editor-and-add-branding))
- **Email & webhook notifications**: receive submissions in your backend ([guide](https://simplepdf.com/help/how-to/configure-webhooks-pdf-form-submissions))
- **Bring Your Own Storage**: route PDFs to your S3 or Azure bucket ([guide](https://simplepdf.com/help/how-to/use-your-own-s3-bucket-storage-for-pdf-form-submissions))

## Privacy

- **URL input**: passed directly to the browser editor, never downloaded or stored by this service
- **File upload**: stored for up to 24 hours, then automatically deleted
- **Editing**: entirely client-side, edited documents never touch SimplePDF servers

## Limits

- Max PDF size: 50 MB (file uploads)
- Uploaded files expire after 24 hours
- Rate limit: 30 req/min per IP
- URLs must start with `https://`
