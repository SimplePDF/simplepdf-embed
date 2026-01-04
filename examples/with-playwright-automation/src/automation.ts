import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import type { AutomationConfig } from './schema';

type AutomationErrorCode =
  | 'document_load_failed'
  | 'field_creation_failed'
  | 'clear_fields_failed';

type AutomationResult =
  | { success: true; data: null }
  | { success: false; error: { code: AutomationErrorCode; message: string } };

type RunAutomationArgs = {
  config: AutomationConfig;
  baseUrl: string;
};

type IframeEvent = {
  type: string;
  data?: Record<string, unknown>;
  request_id?: string;
};

type ReceivedEvent = {
  order: number;
  timestamp: string;
  event: IframeEvent;
};

type RequestResultData = {
  request_id: string;
  result: {
    success: boolean;
    error?: { code: string; message: string };
  };
};

const isRequestResultData = (data: unknown): data is RequestResultData => {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;

  if (typeof obj.result !== 'object' || obj.result === null) {
    return false;
  }

  const result = obj.result as Record<string, unknown>;
  return typeof result.success === 'boolean';
};

const setupIframePage = async ({
  page,
  editorUrl,
}: {
  page: Page;
  editorUrl: string;
}): Promise<{
  sendEvent: (event: IframeEvent) => Promise<string>;
  waitForEvent: (eventType: string, options?: { timeout?: number; requestId?: string }) => Promise<ReceivedEvent>;
  waitForDocumentLoaded: () => Promise<ReceivedEvent>;
}> => {
  const receivedEvents: ReceivedEvent[] = [];
  let eventOrder = 0;

  await page.exposeFunction('recordEvent', (event: IframeEvent, timestamp: string) => {
    receivedEvents.push({
      order: ++eventOrder,
      timestamp,
      event,
    });
  });

  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { margin: 0; height: 100vh; }
        iframe { width: 100%; height: 100%; border: none; }
      </style>
      <script>
        window.addEventListener("message", (event) => {
          let payload = null;
          try {
            payload = JSON.parse(event.data);
          } catch {
            return;
          }

          if (payload?.type) {
            window.recordEvent(payload, new Date().toISOString());
          }
        });
      </script>
    </head>
    <body>
      <iframe id="editor" src="${editorUrl}" allow="clipboard-write"></iframe>
    </body>
    </html>
  `);

  const sendEvent = async (event: IframeEvent): Promise<string> => {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const eventWithId = { ...event, request_id: requestId };

    await page.evaluate((eventJson) => {
      const iframe = document.getElementById('editor') as HTMLIFrameElement;
      iframe.contentWindow?.postMessage(eventJson, '*');
    }, JSON.stringify(eventWithId));

    return requestId;
  };

  const findMatchingEvent = (eventType: string, options?: { requestId?: string }): ReceivedEvent | undefined => {
    return receivedEvents.find((e) => {
      if (e.event.type !== eventType) {
        return false;
      }

      if (options?.requestId && e.event.data) {
        const data = e.event.data as { request_id?: string };
        return data.request_id === options.requestId;
      }

      return true;
    });
  };

  const waitForEvent = async (
    eventType: string,
    options?: { timeout?: number; requestId?: string }
  ): Promise<ReceivedEvent> => {
    const timeout = options?.timeout ?? 30000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const matchingEvent = findMatchingEvent(eventType, options);

      if (matchingEvent) {
        return matchingEvent;
      }

      await page.waitForTimeout(100);
    }

    throw new Error(
      `Timeout waiting for event: ${eventType}${options?.requestId ? ` with request_id ${options.requestId}` : ''}`
    );
  };

  const waitForDocumentLoaded = async (): Promise<ReceivedEvent> => {
    return waitForEvent('DOCUMENT_LOADED');
  };

  return {
    sendEvent,
    waitForEvent,
    waitForDocumentLoaded,
  };
};

const resolveValueToString = ({ value }: { value: string }): string => {
  if (value.startsWith('data:') || value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }

  const absolutePath = path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  const buffer = fs.readFileSync(absolutePath);
  const ext = path.extname(absolutePath).toLowerCase();
  const mimeType = (() => {
    switch (ext) {
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.png':
        return 'image/png';
      case '.gif':
        return 'image/gif';
      case '.webp':
        return 'image/webp';
      default:
        return 'image/png';
    }
  })();

  return `data:${mimeType};base64,${buffer.toString('base64')}`;
};

const runAutomation = async ({ config, baseUrl }: RunAutomationArgs): Promise<AutomationResult> => {
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ headless: false });

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });

    const page = await context.newPage();

    const editorUrl = buildEditorUrl({ document: config.document, baseUrl });
    const { sendEvent, waitForEvent, waitForDocumentLoaded } = await setupIframePage({
      page,
      editorUrl,
    });

    console.log('Waiting for document to load...');
    await waitForDocumentLoaded();
    console.log('Document loaded');

    console.log('Clearing existing fields...');
    const clearRequestId = await sendEvent({ type: 'CLEAR_FIELDS', data: {} });
    const clearResult = await waitForEvent('REQUEST_RESULT', { requestId: clearRequestId });

    if (!isRequestResultData(clearResult.event.data) || !clearResult.event.data.result.success) {
      return {
        success: false,
        error: { code: 'clear_fields_failed', message: 'Failed to clear existing fields' },
      };
    }
    console.log('Fields cleared');

    console.log(`Creating ${config.fields.length} fields...`);
    for (let i = 0; i < config.fields.length; i++) {
      const field = config.fields[i];

      if (!field) {
        continue;
      }

      const fieldValue = ((): string | boolean | undefined => {
        if (field.value === undefined) {
          return undefined;
        }

        if (typeof field.value === 'boolean') {
          return field.value;
        }

        if (field.type === 'PICTURE' || field.type === 'SIGNATURE') {
          return resolveValueToString({ value: field.value });
        }

        return field.value;
      })();

      const requestId = await sendEvent({
        type: 'CREATE_FIELD',
        data: {
          type: field.type,
          x: field.x,
          y: field.y,
          width: field.width,
          height: field.height,
          page: field.page,
          ...(fieldValue !== undefined ? { value: fieldValue } : {}),
        },
      });

      const result = await waitForEvent('REQUEST_RESULT', { requestId });

      if (!isRequestResultData(result.event.data) || !result.event.data.result.success) {
        const errorMessage = isRequestResultData(result.event.data)
          ? result.event.data.result.error?.message ?? 'Unknown error'
          : 'Invalid response';
        return {
          success: false,
          error: {
            code: 'field_creation_failed',
            message: `Failed to create ${field.type} field at page ${field.page}: ${errorMessage}`,
          },
        };
      }

      console.log(`  [${i + 1}/${config.fields.length}] Created ${field.type} on page ${field.page}`);
    }

    console.log('All fields created');
    await page.pause();

    return { success: true, data: null };
  } catch (e) {
    const error = e as Error;
    return {
      success: false,
      error: {
        code: 'document_load_failed',
        message: `Automation failed: ${error.name}:${error.message}`,
      },
    };
  }
};

const buildEditorUrl = ({ document, baseUrl }: { document: string; baseUrl: string }): string => {
  if (document.startsWith('http://') || document.startsWith('https://')) {
    return `${baseUrl}/editor?open=${encodeURIComponent(document)}`;
  }

  const absolutePath = path.isAbsolute(document) ? document : path.resolve(process.cwd(), document);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  return `${baseUrl}/editor?localFile=${encodeURIComponent(absolutePath)}`;
};

export { runAutomation, AutomationResult };
