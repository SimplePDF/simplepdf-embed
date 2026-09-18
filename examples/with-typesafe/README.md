# JEV-based PDF form filling (Typesafe × SimplePDF)

_Built with Next.js, Tailwind CSS, `@simplepdf/react-embed-pdf`, and Typesafe's **JEV** ("System One") model._

Pick a form (an **IRS W-9** or a **medication prior-authorization**), and JEV auto-fills it from a demo record in the SimplePDF editor: it maps each CSV column to a field, ticks the right checkboxes and picks constrained-field options, and gates every write on a calibrated confidence. Fills below the auto-threshold surface as **low-confidence** items to confirm, a JEV plausibility pass flags **fictional / implausible** values, and any field it can't fill is a manual-entry prompt. A human confirms or fixes each one, re-validates, and finalizes.

The shape is the message: **code owns control flow, JEV answers narrow structured questions** (which column fits this field? should this box be checked? is this value plausible?). No agent, no hallucination.

## Run

```sh
npm install
npm run dev
```

Open `http://localhost:3001`. The editor loads under the whitelisted `spdf-jev` demo origin (no Pro account needed).

## JEV API key (BYOK, in-memory)

The JEV key is **yours** and is held **in memory only**: no server, no persistence, no localStorage. The call is proxied same-origin through `/api/jev` (JEV has no browser CORS), and the key is forwarded, never stored. Get a key at `https://console.typesafe.ai/settings/keys`.

**What reaches JEV:** field labels, the demo CSV record, and the filled text values (for the plausibility pass). Checkbox/option states, signature data, and picture data are never sent.

For local dev you can pre-seed the key: copy it into `.env.local` as `NEXT_PUBLIC_TYPESAFE_API_KEY=<key>` (gitignored, never committed). The shipped path is still typing the key into the UI.

> Illustrative demo, not tax advice.
