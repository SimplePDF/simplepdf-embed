# agent-pdf

Let AI agents edit and fill PDFs through [SimplePDF](https://simplepdf.com).

## Install as a skill

Copy the [SKILL.md](./SKILL.md) file into your agent's skills directory:

```bash
# Claude Code
cp SKILL.md ~/.claude/skills/simplepdf/SKILL.md

# Cursor
cp SKILL.md .cursor/skills/simplepdf/SKILL.md
```

Or point your agent at the hosted version:

```
https://agent.simplepdf.com
```

Any agent that fetches this URL gets the skill as `text/markdown`.

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
