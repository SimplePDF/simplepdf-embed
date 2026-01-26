type IframeAction =
  | { action: 'LOAD_DOCUMENT'; data: { data_url: string; name?: string; page?: number } }
  | { action: 'CREATE_FIELD'; data: { type: string; page: number; x: number; y: number; width: number; height: number; value?: string } }
  | { action: 'GET_DOCUMENT_CONTENT'; data: { extraction_mode: string } }
  | { action: 'GO_TO'; data: { page: number } }
  | { action: 'SUBMIT'; data: { download_copy: boolean } }
  | { action: 'CLEAR_FIELDS'; data: { field_ids?: string[]; page?: number } };

type IframeEvent =
  | { type: 'EDITOR_READY'; data: Record<string, never> }
  | { type: 'DOCUMENT_LOADED'; data: { document_id: string } }
  | { type: 'PAGE_FOCUSED'; data: { previous_page: number | null; current_page: number; total_pages: number } }
  | { type: 'SUBMISSION_SENT'; data: { document_id: string; submission_id: string } }
  | { type: 'REQUEST_RESULT'; data: { request_id: string; result: { success: boolean; data?: unknown; error?: { code: string; message: string } } } };

type AppState = {
  isEditorReady: boolean;
  currentPage: number | null;
  totalPages: number | null;
  documentId: string | null;
  pendingRequests: Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }>;
};

const SIMPLEPDF_EDITOR_URL = 'https://embed.simplepdf.com/editor';
const REQUEST_TIMEOUT_MS = 30000;

const state: AppState = {
  isEditorReady: false,
  currentPage: null,
  totalPages: null,
  documentId: null,
  pendingRequests: new Map(),
};

let iframe: HTMLIFrameElement | null = null;

const generateRequestId = (): string => {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
};

const sendIframeEvent = <TData = unknown>(
  eventType: string,
  data: Record<string, unknown>
): Promise<TData> => {
  return new Promise((resolve, reject) => {
    if (!iframe?.contentWindow) {
      reject(new Error('Iframe not available'));
      return;
    }

    const requestId = generateRequestId();
    state.pendingRequests.set(requestId, {
      resolve: resolve as (value: unknown) => void,
      reject,
    });

    iframe.contentWindow.postMessage(
      JSON.stringify({ type: eventType, request_id: requestId, data }),
      '*'
    );

    setTimeout(() => {
      const pending = state.pendingRequests.get(requestId);
      if (pending) {
        state.pendingRequests.delete(requestId);
        pending.reject(new Error('Request timed out'));
      }
    }, REQUEST_TIMEOUT_MS);
  });
};

const handleIframeMessage = (event: MessageEvent<string>): void => {
  let payload: IframeEvent;
  try {
    payload = JSON.parse(event.data);
  } catch {
    return;
  }

  switch (payload.type) {
    case 'EDITOR_READY':
      state.isEditorReady = true;
      console.log('[SimplePDF MCP] Editor ready');
      break;

    case 'DOCUMENT_LOADED':
      state.documentId = payload.data.document_id;
      console.log('[SimplePDF MCP] Document loaded:', payload.data.document_id);
      break;

    case 'PAGE_FOCUSED':
      state.currentPage = payload.data.current_page;
      state.totalPages = payload.data.total_pages;
      console.log('[SimplePDF MCP] Page:', payload.data.current_page, '/', payload.data.total_pages);
      break;

    case 'SUBMISSION_SENT':
      console.log('[SimplePDF MCP] Submission sent:', payload.data.submission_id);
      break;

    case 'REQUEST_RESULT': {
      const pending = state.pendingRequests.get(payload.data.request_id);
      if (pending) {
        state.pendingRequests.delete(payload.data.request_id);
        if (payload.data.result.success) {
          pending.resolve(payload.data.result.data);
        } else {
          pending.reject(new Error(payload.data.result.error?.message ?? 'Unknown error'));
        }
      }
      break;
    }
  }
};

const executeAction = async (action: IframeAction): Promise<unknown> => {
  if (!state.isEditorReady && action.action !== 'LOAD_DOCUMENT') {
    throw new Error('Editor not ready');
  }

  switch (action.action) {
    case 'LOAD_DOCUMENT':
      return sendIframeEvent('LOAD_DOCUMENT', action.data);

    case 'CREATE_FIELD':
      return sendIframeEvent('CREATE_FIELD', action.data);

    case 'GET_DOCUMENT_CONTENT':
      return sendIframeEvent('GET_DOCUMENT_CONTENT', action.data);

    case 'GO_TO':
      return sendIframeEvent('GO_TO', action.data);

    case 'SUBMIT':
      return sendIframeEvent('SUBMIT', action.data);

    case 'CLEAR_FIELDS':
      return sendIframeEvent('CLEAR_FIELDS', action.data);

    default: {
      const exhaustiveCheck: never = action;
      throw new Error(`Unknown action: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }
};

const createUI = (): void => {
  const root = document.getElementById('root');
  if (!root) {
    console.error('[SimplePDF MCP] Root element not found');
    return;
  }

  const container = document.createElement('div');
  container.className = 'simplepdf-container';

  iframe = document.createElement('iframe');
  iframe.className = 'simplepdf-iframe';
  iframe.src = SIMPLEPDF_EDITOR_URL;
  iframe.title = 'SimplePDF Editor';
  iframe.referrerPolicy = 'no-referrer-when-downgrade';

  container.appendChild(iframe);
  root.appendChild(container);

  window.addEventListener('message', handleIframeMessage);
};

const init = (): void => {
  createUI();

  (window as unknown as { simplePdfMcp: { executeAction: typeof executeAction; getState: () => AppState } }).simplePdfMcp = {
    executeAction,
    getState: () => ({ ...state, pendingRequests: new Map() }),
  };

  console.log('[SimplePDF MCP] App initialized');
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
