# agent-pdf

Let AI agents edit and fill PDFs through [SimplePDF](https://simplepdf.com).

## Install

```bash
curl --create-dirs -o ~/.claude/skills/edit-pdf/SKILL.md https://agents.simplepdf.com
```

## Quick start

```bash
# From a URL
curl "https://agents.simplepdf.com?url=https://example.com/form.pdf"

# From a file
curl -X POST https://agents.simplepdf.com -F file=@document.pdf
```

Returns:

```json
{
  "url": "https://ai.simplepdf.com/editor?open=...",
  "iframe": "<iframe src=\"...\" width=\"100%\" height=\"800\" frameborder=\"0\"></iframe>",
  "react": "<EmbedPDF mode=\"inline\" companyIdentifier=\"ai\" documentURL=\"...\" />"
}
```
