// fill-any-pdf protocol driver. The whole fill journey runs over the SimplePDF embed iframe protocol
// - no side channels. `serve` holds ONE editor session open and exposes the embed ops over a localhost
// control port so an agent drives the loop interactively:
//
//   POST /detect            -> detect_fields                    { detected_count }
//   POST /get               -> get_fields                       { fields, pages }
//   POST /content {extraction_mode?} -> get_document_content     { name, pages }
//   POST /area {page,x?,y?,width?,height?,zoom?} -> get_annotated_area (render written as a PNG)
//   POST /create {field}    -> create_field                     { field_id }
//   POST /delete {field_ids?} -> delete_fields                  { deleted_count }
//   POST /set {field_id,value} -> set_field_value               (null; value=null clears the field)
//   POST /submit {download_copy?} -> submit (the first submit saves the template, then records a submission)
//   POST /stop              -> close the session and exit
//
// Field state lives in the single editor session for the whole journey; submit is the only persistence,
// and it is itself an embed call. A FLAT PDF is made fillable first (detect/create, verified against the
// get_annotated_area render), then filled (set); an ALREADY-FILLABLE PDF skips straight to get + set.
// `create` places GEOMETRY (optionally an initial value); `set` writes a value onto an existing field.
//
// Requires Playwright (`npm i playwright`). Point --editor-origin at a SimplePDF portal you own. Two
// gates apply on a portal you own: (1) PLAN - every op except LOAD_DOCUMENT needs the paid
// programmatic-control capability (the Pro plan and above), and get_annotated_area needs the top Premium
// plan on top of that; (2) WHITELIST - create_field, get_annotated_area and get_document_content also
// need the embedding origin whitelisted for the tenant (this driver embeds the editor in a
// locally-launched browser page, so that origin must be whitelisted), while get_fields, detect_fields,
// delete_fields, set_field_value and submit do not. So the fillable-PDF fill journey needs no
// whitelisting; the flat-PDF build journey does. A blocked op returns the matching gateway code
// (plan_upgrade_required or origin_not_whitelisted). The op contract is served at <editor-origin>/embed/json.
//
//   node drive_form.mjs serve --editor-origin https://<your-portal>.simplepdf.com \
//     --pdf-url <pdf-url> --out <dir> [--port 8787] [--headful]
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const DEFAULT_PORT = 8787;

const EXIT_CODES = {
  invalid_arguments: 2,
  session_failed: 3,
};

const fail = (exitCode, message) => {
  console.error(message);
  process.exit(exitCode);
};

const parseArgs = () => {
  const [, , command, ...rest] = process.argv;
  const args = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith('--')) {
      fail(EXIT_CODES.invalid_arguments, `Unexpected argument: ${token}`);
    }
    const key = token.slice(2);
    const next = rest[index + 1];
    // A valueless flag (e.g. --headful) is followed by another --flag or the end of args.
    if (next === undefined || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      index += 1;
    }
  }
  return { command, args };
};

// ---------------------------------------------------------------------------------------------
// The one editor session: the iframe embedded in a scratch page, spoken to via postMessage.
// ---------------------------------------------------------------------------------------------

const openEditorSession = async ({ editorUrl, headful }) => {
  // Headless by default (automation); --headful opens a visible window to watch the loop run.
  const browser = await chromium.launch({ headless: !headful });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.setContent(`
    <iframe src="${editorUrl}" style="width:1200px;height:850px;border:none"></iframe>
    <script>
      window.received = [];
      window.addEventListener('message', (event) => {
        try { window.received.push(JSON.parse(event.data)); } catch {}
      });
      window.post = (payload) =>
        document.querySelector('iframe').contentWindow.postMessage(JSON.stringify(payload), '*');
    </script>
  `);

  const waitForType = async (type, timeoutMs) => {
    await page.waitForFunction(([t]) => window.received.some((entry) => entry.type === t), [type], {
      timeout: timeoutMs,
    });
  };

  let requestCounter = 0;
  const request = async ({ type, data, timeoutMs }) => {
    requestCounter += 1;
    const requestId = `drive-${requestCounter}`;
    await page.evaluate(
      ([payload]) => window.post(payload),
      [{ type, request_id: requestId, ...(data === undefined ? {} : { data }) }],
    );
    await page.waitForFunction(
      ([id]) => window.received.some((entry) => entry.data?.request_id === id),
      [requestId],
      { timeout: timeoutMs ?? 60_000 },
    );
    return page.evaluate(([id]) => window.received.find((entry) => entry.data?.request_id === id), [requestId]).then(
      (reply) => reply.data.result,
    );
  };

  return { browser, waitForType, request };
};

// Write the annotated-area PNG to the out dir and swap the (large) data URL for the file path, so
// the agent reads the image off disk and the JSON reply stays small. A whole-page overview (x=y=0)
// keeps a stable name you re-render in place through the loop; a sub-area is named by its corner, size
// and pixel width so different crops or zoom levels at the same corner never overwrite each other.
const materializeAnnotatedArea = async ({ outDir, area }) => {
  const isWholePage = area.x === 0 && area.y === 0;
  const name = isWholePage
    ? `annotated-page-${area.page}.png`
    : `annotated-area-${area.page}-${Math.round(area.x)}-${Math.round(area.y)}-${Math.round(area.width)}x${Math.round(area.height)}-${area.image_width}px.png`;
  const imageFile = join(outDir, name);
  await writeFile(imageFile, Buffer.from(area.image_data_url.replace(/^data:image\/png;base64,/, ''), 'base64'));
  const { image_data_url: _dataUrl, ...rest } = area;
  return { ...rest, image_file: imageFile };
};

// ---------------------------------------------------------------------------------------------
// The control server: each route dispatches ONE embed op against the live session and returns the
// protocol Result verbatim. A failing op returns its error envelope (never crashes the session),
// so the agent reads the error and adjusts - the loop survives bad inputs.
// ---------------------------------------------------------------------------------------------

const handleRoute = async ({ route, body, session, outDir }) => {
  switch (route) {
    case '/ping':
      return { ready: true, out: outDir };
    case '/detect':
      return session.request({ type: 'DETECT_FIELDS', data: {}, timeoutMs: 180_000 });
    case '/get':
      return session.request({ type: 'GET_FIELDS', data: {}, timeoutMs: 120_000 });
    case '/content':
      return session.request({
        type: 'GET_DOCUMENT_CONTENT',
        data: { ...(body.extraction_mode !== undefined ? { extraction_mode: body.extraction_mode } : {}) },
        timeoutMs: 180_000,
      });
    case '/area': {
      const result = await session.request({
        type: 'GET_ANNOTATED_AREA',
        data: {
          page: body.page,
          // Pass whatever the caller gave verbatim so the editor validates all-or-nothing zones and
          // reports the actionable error, rather than the driver silently dropping a partial rect.
          ...(body.x !== undefined ? { x: body.x } : {}),
          ...(body.y !== undefined ? { y: body.y } : {}),
          ...(body.width !== undefined ? { width: body.width } : {}),
          ...(body.height !== undefined ? { height: body.height } : {}),
          ...(body.zoom !== undefined ? { zoom: body.zoom } : {}),
        },
        timeoutMs: 120_000,
      });
      if (!result.success) {
        return result;
      }
      return { success: true, data: await materializeAnnotatedArea({ outDir, area: result.data }) };
    }
    case '/create':
      return session.request({ type: 'CREATE_FIELD', data: body.field });
    case '/delete':
      // Forward field_ids and the optional page scope verbatim - the editor validates them (a non-array
      // field_ids returns invalid_field_ids). Omitting BOTH is the contract's "delete every overlay
      // field", which the Build clear-first step relies on.
      return session.request({
        type: 'DELETE_FIELDS',
        data: {
          ...(body.field_ids !== undefined ? { field_ids: body.field_ids } : {}),
          ...(body.page !== undefined ? { page: body.page } : {}),
        },
      });
    case '/set':
      // Forward value verbatim when present (including null, which clears the field), and omit it when
      // the caller left it out - so the editor returns the actionable invalid_value rather than the
      // driver silently clearing the field, matching the pass-through the /area zone route uses above.
      return session.request({
        type: 'SET_FIELD_VALUE',
        data: { field_id: body.field_id, ...(body.value !== undefined ? { value: body.value } : {}) },
      });
    case '/submit':
      return session.request({ type: 'SUBMIT', data: { download_copy: body.download_copy === true } });
    default:
      return { success: false, error: { code: 'bad_request:unknown_route', message: `Unknown route ${route}` } };
  }
};

const commandServe = async ({ editorOrigin, pdfUrl, outDir, port, headful }) => {
  if (!editorOrigin || !pdfUrl || !outDir) {
    fail(EXIT_CODES.invalid_arguments, 'serve requires --editor-origin, --pdf-url and --out');
  }
  mkdirSync(outDir, { recursive: true });

  const session = await openEditorSession({
    editorUrl: `${editorOrigin.replace(/\/+$/, '')}/editor?open=${encodeURIComponent(pdfUrl)}`,
    headful,
  });
  await session.waitForType('DOCUMENT_LOADED', 90_000).catch(() => {
    fail(EXIT_CODES.session_failed, 'The editor never emitted DOCUMENT_LOADED - is the portal reachable and the URL valid?');
  });

  const server = createServer((req, res) => {
    const reply = (payload) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(payload));
    };
    void (async () => {
      const route = (req.url ?? '/').split('?')[0];

      // Only /ping is a GET; every op (including /stop) is POST, so a stray GET - from a browser or a
      // malicious localhost page - can never trigger /submit, /delete or /stop.
      if (route !== '/ping' && req.method !== 'POST') {
        reply({ success: false, error: { code: 'bad_request:method_not_allowed', message: `${route} requires POST` } });
        return;
      }

      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }

      const body = (() => {
        if (chunks.length === 0) {
          return {};
        }
        try {
          return JSON.parse(Buffer.concat(chunks).toString());
        } catch {
          return null;
        }
      })();

      if (body === null) {
        reply({ success: false, error: { code: 'bad_request:invalid_json', message: 'Request body is not valid JSON' } });
        return;
      }

      if (route === '/stop') {
        reply({ stopped: true });
        server.close();
        await session.browser.close().catch(() => {});
        process.exit(0);
      }

      try {
        reply(await handleRoute({ route, body, session, outDir }));
      } catch (e) {
        const error = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
        reply({ success: false, error: { code: 'unexpected:driver_error', message: error } });
      }
    })().catch((e) => {
      // A stream/read error before we replied would otherwise reject this void IIFE as an unhandled
      // rejection that crashes the process and kills every other in-flight caller. Answer this one
      // request (or just close it if headers already went out) and keep the session alive.
      const error = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      if (res.headersSent) {
        res.end();
        return;
      }
      reply({ success: false, error: { code: 'unexpected:driver_error', message: error } });
    });
  });

  // Loopback only - the control server has no auth, so it must never be reachable off this machine.
  await new Promise((resolveListen) => server.listen(port, '127.0.0.1', resolveListen));
  console.log(
    `READY port=${port} out=${outDir} - POST /detect /get /content /area /create /delete /set /submit against http://localhost:${port}; POST /stop to end.`,
  );
};

const main = async () => {
  const { command, args } = parseArgs();

  switch (command) {
    case 'serve':
      return commandServe({
        editorOrigin: args['editor-origin'],
        pdfUrl: args['pdf-url'],
        outDir: args.out,
        port: args.port ? Number(args.port) : DEFAULT_PORT,
        headful: args.headful !== undefined,
      });
    default:
      return fail(EXIT_CODES.invalid_arguments, `Unknown command: ${command}. The only command is 'serve'.`);
  }
};

await main();
