import * as React from 'react';
import { generateRandomID } from './utils';

const DEFAULT_REQUEST_TIMEOUT_IN_MS = 30000;

type ExtractionMode = 'auto' | 'ocr';

type ToolType = 'TEXT' | 'BOXED_TEXT' | 'CHECKBOX' | 'PICTURE' | 'SIGNATURE';

type ErrorCodePrefix = 'bad_request' | 'unexpected' | 'forbidden';

type ErrorResult = {
  success: false;
  error: { code: `${ErrorCodePrefix}:${string}`; message: string };
};

type SuccessResult<TData = undefined> = TData extends undefined ? { success: true } : { success: true; data: TData };

type ActionResult<TData = undefined> = SuccessResult<TData> | ErrorResult;

type DocumentContentPage = {
  page: number;
  content: string;
};

type DocumentContentResult = {
  name: string;
  pages: DocumentContentPage[];
};

type RemoveFieldsResult = {
  removed_count: number;
};

export type EmbedActions = {
  goTo: (options: { page: number }) => Promise<ActionResult>;

  selectTool: (toolType: ToolType | null) => Promise<ActionResult>;

  detectFields: () => Promise<ActionResult>;

  removeFields: (options?: { fieldIds?: string[]; page?: number }) => Promise<ActionResult<RemoveFieldsResult>>;

  getDocumentContent: (options: { extractionMode: ExtractionMode }) => Promise<ActionResult<DocumentContentResult>>;

  submit: (options: { downloadCopyOnDevice: boolean }) => Promise<ActionResult>;
};

export type EventPayload = {
  type: string;
  data: unknown;
};

type RequestResultEvent<TData = unknown> = {
  type: 'REQUEST_RESULT';
  data: {
    request_id: string;
    result: ActionResult<TData>;
  };
};

export const sendEvent = <TData = undefined,>(
  iframe: HTMLIFrameElement,
  payload: EventPayload,
): Promise<ActionResult<TData>> => {
  const requestId = generateRandomID();
  return new Promise<ActionResult<TData>>((resolve) => {
    const handleMessage = (event: MessageEvent<string>) => {
      const parsedEvent: RequestResultEvent<TData> | null = (() => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type !== 'REQUEST_RESULT') {
            return null;
          }
          return parsed;
        } catch {
          return null;
        }
      })();

      if (parsedEvent === null) {
        return;
      }

      const isTargetIframe = event.source === iframe.contentWindow;
      const isMatchingResponse = parsedEvent.data.request_id === requestId;

      if (isTargetIframe && isMatchingResponse) {
        resolve(parsedEvent.data.result);
        window.removeEventListener('message', handleMessage);
        clearTimeout(timeoutId);
      }
    };

    window.addEventListener('message', handleMessage);

    iframe.contentWindow?.postMessage(JSON.stringify({ ...payload, request_id: requestId }), '*');

    const timeoutId = setTimeout(() => {
      resolve({
        success: false,
        error: {
          code: 'unexpected:request_timed_out',
          message: 'The request timed out: try again',
        },
      });
      window.removeEventListener('message', handleMessage);
    }, DEFAULT_REQUEST_TIMEOUT_IN_MS);
  });
};

export const useEmbed = (): { embedRef: React.RefObject<EmbedActions | null>; actions: EmbedActions } => {
  const embedRef = React.useRef<EmbedActions>(null);

  const createAction = <TArgs extends unknown[], TResult = undefined>(
    actionFn: (ref: EmbedActions, ...args: TArgs) => Promise<ActionResult<TResult>>,
  ): ((...args: TArgs) => Promise<ActionResult<TResult>>) => {
    return async (...args: TArgs): Promise<ActionResult<TResult>> => {
      if (embedRef.current === null) {
        return {
          success: false,
          error: {
            code: 'bad_request:embed_ref_not_available',
            message: 'embedRef is not available: make sure to pass embedRef to the <Embed /> component',
          },
        };
      }
      return actionFn(embedRef.current, ...args);
    };
  };

  const handleGoTo = React.useCallback(
    createAction<[{ page: number }]>(async (ref, options) => {
      return ref.goTo(options);
    }),
    [],
  );

  const handleSelectTool = React.useCallback(
    createAction<[ToolType | null]>(async (ref, toolType) => {
      return ref.selectTool(toolType);
    }),
    [],
  );

  const handleDetectFields = React.useCallback(
    createAction(async (ref) => {
      return ref.detectFields();
    }),
    [],
  );

  const handleRemoveFields = React.useCallback(
    createAction<[{ fieldIds?: string[]; page?: number }?], RemoveFieldsResult>(async (ref, options) => {
      return ref.removeFields(options);
    }),
    [],
  );

  const handleGetDocumentContent = React.useCallback(
    createAction<[{ extractionMode: ExtractionMode }], DocumentContentResult>(async (ref, options) => {
      return ref.getDocumentContent(options);
    }),
    [],
  );

  const handleSubmit = React.useCallback(
    createAction<[{ downloadCopyOnDevice: boolean }]>(async (ref, options) => {
      return ref.submit(options);
    }),
    [],
  );

  return {
    embedRef,
    actions: {
      goTo: handleGoTo,
      selectTool: handleSelectTool,
      detectFields: handleDetectFields,
      removeFields: handleRemoveFields,
      getDocumentContent: handleGetDocumentContent,
      submit: handleSubmit,
    },
  };
};
