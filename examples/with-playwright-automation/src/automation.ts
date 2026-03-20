import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

type AutomationErrorCode =
  | 'detect_fields_failed'
  | 'document_load_failed';

type AutomationResult =
  | { success: true; data: null }
  | { success: false; error: { code: AutomationErrorCode; message: string } };

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

const isUrl = (value: string): boolean => value.startsWith('http://') || value.startsWith('https://');

const readFileAsDataUrl = ({ filePath }: { filePath: string }): string => {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  const buffer = fs.readFileSync(absolutePath);
  return `data:application/pdf;base64,${buffer.toString('base64')}`;
};

const runAutomation = async ({ document, baseUrl }: { document: string; baseUrl: string }): Promise<AutomationResult> => {
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ headless: false });

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });

    const page = await context.newPage();

    const editorUrl = isUrl(document)
      ? `${baseUrl}/editor?open=${encodeURIComponent(document)}`
      : `${baseUrl}/editor?loadingPlaceholder=true`;

    const { sendEvent, waitForEvent, waitForDocumentLoaded } = await setupIframePage({
      page,
      editorUrl,
    });

    if (!isUrl(document)) {
      console.log('Loading local file...');
      const dataUrl = readFileAsDataUrl({ filePath: document });
      const fileName = path.basename(document);
      await sendEvent({ type: 'LOAD_DOCUMENT', data: { data_url: dataUrl, name: fileName } });
    }

    console.log('Waiting for document to load...');
    await waitForDocumentLoaded();
    console.log('Document loaded');

    console.log('Detecting fields...');
    const detectRequestId = await sendEvent({ type: 'DETECT_FIELDS', data: {} });
    const detectResult = await waitForEvent('REQUEST_RESULT', { requestId: detectRequestId, timeout: 120000 });

    if (!isRequestResultData(detectResult.event.data) || !detectResult.event.data.result.success) {
      const errorMessage = isRequestResultData(detectResult.event.data)
        ? detectResult.event.data.result.error?.message ?? 'Unknown error'
        : 'Invalid response';
      return {
        success: false,
        error: { code: 'detect_fields_failed', message: `Failed to detect fields: ${errorMessage}` },
      };
    }
    console.log('Fields detected');

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

export { runAutomation, AutomationResult };
