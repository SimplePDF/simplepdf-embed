---
name: fill-any-pdf
description: Fills any PDF on a SimplePDF portal and submits it, entirely through the embed iframe protocol - no side channels. A flat (no-field) PDF is made fillable first (detect, then place fields verified against a render, combed fields like SSN/phone/dates included) and then filled; an already-fillable PDF is filled directly. Holds one editor session open (drive_form.mjs serve) and drives the loop over a localhost control port. Triggers on "fill this PDF", "fill the PDF at <url>", "fill and submit <pdf>", "fill any pdf".
allowed-tools: Read, Bash(node:*), Bash(npm:*), Bash(npx:*), Bash(curl:*)
user-invocable: true
---

# Fill Any PDF Skill

Goes from a PDF URL to a **filled, submitted document** on a SimplePDF portal, entirely through the
embed iframe protocol - no side channels. Field state lives in one live editor session for the whole
run; `submit` is the only persistence and is itself an embed call.

The true outcome is a FILLED PDF. Making a flat PDF fillable (placing the fields) is only step one - no
one wants an empty fillable PDF as an end state, they want it filled. This skill covers both starting
points:

- **Flat PDF (no fields)** -> detect, place fields, verify against the render -> fill -> submit.
- **Already-fillable PDF (has fields)** -> read the fields -> fill -> submit.

Both journeys converge on the same fill step (`set_field_value`) and the same finish (`submit`).

**The op reference is the served manifest, not this file.** Every op's schema, conventions (the
top-left/y-down point convention, the comb round-trip rule, grouped-comb layouts), field/value shapes,
and error codes are the manifest at `https://<your-portal>.simplepdf.com/embed/json` - the same
`.describe()` text the agentic tools use. This skill covers only the ORCHESTRATION (the local driver +
the loop); consult the manifest for op semantics.

## Prerequisites

- **Node 18+** and this skill's dependencies: from the skill directory, run `npm install` (installs
  Playwright), then `npx playwright install chromium` (the browser binary).
- **A SimplePDF portal you own**, passed to the driver as `--editor-origin`. Two gates apply:
  - **Plan.** Every op except loading the document needs the paid **programmatic-control** capability
    (the **Pro** plan and above); `get_annotated_area` needs the top **Premium** plan on top of that. So
    both journeys need a Pro-or-above portal.
  - **Whitelist.** `create_field`, `get_annotated_area` and `get_document_content` also need the
    **embedding origin whitelisted** for the tenant. This driver embeds the editor in a locally-launched
    browser page, so *that* origin must be whitelisted for those three ops to work - a **headful** run
    makes the origin visible so you can confirm what to whitelist. `get_fields`, `detect_fields`,
    `delete_fields`, `set_field_value` and `submit` do NOT need whitelisting.
  Net: the **fill journey on an already-fillable PDF** (`get_fields` -> `set_field_value` -> `submit`)
  needs only a Pro-or-above portal, no whitelisting; the **build journey** (which adds `create_field` and
  the `get_annotated_area` render) additionally needs the origin whitelisted. A blocked op returns the
  matching gateway code (`plan_upgrade_required` or `origin_not_whitelisted`); see the manifest.
- For a **headful** run (`--headful`, to watch it), a desktop with a display. Headless runs anywhere.

## The session

`drive_form.mjs serve` opens ONE editor session and exposes the embed ops over a localhost port. You
POST one op at a time and read the result (renders are written as PNGs you open). `<skill>` = this
skill's directory; `<work>` = a scratch directory.

```bash
node <skill>/drive_form.mjs serve \
  --editor-origin https://<your-portal>.simplepdf.com \
  --pdf-url <PDF_URL> --out <work> --port 8787 &
until curl -s localhost:8787/ping >/dev/null 2>&1; do sleep 1; done      # wait for READY
```

Add `--headful` to watch the browser drive itself. Every mutation is in-session until `submit`; if you
stop without submitting, the work is discarded.

## Which journey?

Read what is already there:

```bash
curl -sX POST localhost:8787/get -d '{}'        # get_fields -> { fields, pages }
```

- `fields` non-empty -> the PDF is **already fillable**. Skip to **Fill**.
- `fields` empty -> the PDF is **flat**. Do **Build** first, then **Fill**.

## Build (flat PDF only)

Turn the flat page into fields, then verify placement against the printed form. This is the
**detect, see, adjust, verify** loop.

### 1. Clear, then detect

Start from a flat page. A document built (or submitted) before reloads with its saved fields, so clear
first:

```bash
curl -sX POST localhost:8787/delete -d '{}'        # no field_ids = delete every overlay field
curl -sX POST localhost:8787/detect                # detect_fields on the flat page -> { detected_count }
```

Detection is a *rough* starting point, not the answer. Text boxes land approximately; comb rows come
back as one loose box (or split into per-group boxes), never resolved into cells. It saves you the
blank-page cold start; it does NOT place fields perfectly. Perfect positioning is the job of the render
loop below.

### 2. See

```bash
curl -sX POST localhost:8787/get                       # get_fields -> { fields, pages }
curl -sX POST localhost:8787/area -d '{"page":1}'      # get_annotated_area -> a whole-page render
```

`/get` lists every field with its geometry and every page's displayed size. `/area` renders a page (or
a sub-area) as a PNG written to `<work>` (`image_file`), with a numbered badge over every field
overlapping it and a `badges` (badge to `field_id`) map, plus the rendered area in points and the image
size in pixels. READ the PNG against the printed form. The render shows the printed form plus your field
PLACEMENT, not the filled-in values - read values with `/get`.

### 3. Adjust (the loop)

Create fields, re-render, correct. Every field is `{ type, x, y, width, height, page }` in points;
`COMB_TEXT` also takes `comb: { cell_offsets, cell_width }` (the manifest's `create_field.comb` carries
the exact layout rules - offsets, group gaps, the width round-trip):

```bash
curl -sX POST localhost:8787/create -d '{"field":{"type":"TEXT","x":100,"y":200,"width":150,"height":14,"page":1}}'
curl -sX POST localhost:8787/create -d '{"field":{"type":"COMB_TEXT","x":80,"y":300,"width":58,"height":13,"page":1,"comb":{"cell_offsets":[0,12,24,36,48],"cell_width":10}}}'
curl -sX POST localhost:8787/delete -d '{"field_ids":["f_..."]}'
curl -sX POST localhost:8787/area -d '{"page":1}'                                          # re-render the page you touched
curl -sX POST localhost:8787/area -d '{"page":1,"x":75,"y":295,"width":68,"height":23,"zoom":4}'  # zoom a comb row to read cell alignment
```

The render is your measurement, and reaching PERFECT placement is the whole point of the loop. Place a
field, render, look at the badge against the printed row, nudge, render again; repeat until every field
sits on its line and every comb cell straddles its printed bar. Combs need the most iteration: delete
detection's loose box over a comb row and rebuild it as an explicit `COMB_TEXT` whose `cell_offsets` you
read off the printed bars in the render. A row of cell blocks under ONE label - an SSN (xxx-xx-xxxx), a
phone, a date (MM/DD/YYYY), a ZIP+4 - is a SINGLE `COMB_TEXT` with gaps between the groups, not several
fields. The full-page render is too coarse to see individual cells: pass a zone plus `zoom` to `/area`
to magnify a comb row, where the render outlines each cell (the gaps between grouped cells left empty).
Read the drift between the outlined cells and the printed bars, nudge `x`, the cell pitch, and the group
gaps, and re-render; one or two iterations lands every cell on its bar. A create that reads back wrong
(overlap, width mismatch) returns an actionable `bad_request` - fix and retry; the session stays alive.
To adjust any field, delete it and recreate it.

Field-size heuristics that make a form fill cleanly (build strategy, not contract - the manifest owns
the op rules):

- **Text lines**: height 11-12; `y` about 2-3pt above the line so typed text sits on it. Multiline
  boxes: the writable area below the printed label, not the whole box.
- **Combs**: read the cell opening bars off the zoomed render; font-size about 10 fits a ~13pt cell.
- **Checkboxes**: square; about 10.8pt.
- **Signatures**: the printed signature area, height about 28pt.

As you place each field for a known purpose (the "First name" line, the SSN comb), remember its returned
`field_id` against that meaning - that is the map you fill with next.

## Fill

Write your data onto the fields, one value per field. This works the same whether the fields came from
**Build** above or from an already-fillable PDF.

### 1. Know each field's meaning

- **Built fields**: you already know which `field_id` is which - you placed each one.
- **Already-fillable fields**: `/get` reports each field's `name`, `type`, `value`, and `options`. The
  `name` usually carries the meaning; `options` lists the only accepted values for a dropdown/radio. To
  read the surrounding printed labels (helpful when field names are opaque like `topmostSubform[0]...`):

```bash
curl -sX POST localhost:8787/content -d '{}'      # get_document_content -> { name, pages:[{page,content}] }
```

Map your input data (a person's name, SSN, date of birth, an address) to the right `field_id` using the
name, type, options, and page text.

### 2. Set the values

```bash
curl -sX POST localhost:8787/set -d '{"field_id":"f_...","value":"Jane Q. Public"}'     # text: any string
curl -sX POST localhost:8787/set -d '{"field_id":"f_...","value":"123456789"}'           # SSN comb: 9 chars, one per cell
curl -sX POST localhost:8787/set -d '{"field_id":"f_...","value":"checked"}'             # checkbox: one of its options "checked" / "xchecked" / "unchecked"
curl -sX POST localhost:8787/set -d '{"field_id":"f_...","value":"Married"}'             # dropdown / radio: one of the field's options
curl -sX POST localhost:8787/set -d '{"field_id":"f_...","value":null}'                  # clear a field
```

Rules the editor enforces (full detail in the manifest's `set_field_value`): if the field has `options`,
`value` MUST be one of them - that covers dropdowns/radios (their listed choices) AND checkboxes (whose
options are `checked` / `xchecked` / `unchecked`, NOT `"Yes"`/`"true"`); a plain text field takes any
string; signature and picture fields take an image data URL. A `COMB_TEXT` value is one character per
cell, filled left to right - pass only the data characters (an SSN is `123456789`, a date `01022026`);
the separators printed on the form (the dashes in an SSN, the slashes in a date) are page artwork
rendered by the cell gaps, NOT typed. A rejected value returns an actionable `bad_request` - fix and
retry; the session stays alive. Re-read with `/get` to confirm the values landed. `create_field` also
accepts an initial `value`, so a built field can be placed pre-filled, but `set` is the one fill step
both journeys share.

## Submit

```bash
curl -sX POST localhost:8787/submit -d '{}'        # finalize: saves the filled document + records a submission
curl -sX POST localhost:8787/stop                  # close the session
```

`submit` is the embed-native finalization: on a flat PDF you just made fillable, the first submit also
saves the placed fields as the document's template. It fails with `missing_required_fields` if required
fields are still empty - fill them and resubmit. `submit` is irreversible; only submit a document you
mean to save. **Always `POST /stop`** when done - it closes the browser and exits the driver.

## Notes

- Everything is in-session until `submit`; stopping without submitting discards the work.
- Detection is mildly non-deterministic run-to-run (a field or two); the build loop is how you converge,
  not a one-shot.
- `submit` persists to the portal's real document. Point `--editor-origin` at a portal you own and mean
  to write to.
