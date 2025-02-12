import * as React from 'react';

const DEFAULT_REQUEST_TIMEOUT_IN_MS = 5000;

const generateRandomID = () => {
  return Math.random().toString(36).substring(2, 15);
};

export type EmbedActions = {
  submit: (options: { downloadCopyOnDevice: boolean }) => Promise<Result['data']['result']>;
  selectTool: (
    toolType: 'TEXT' | 'BOXED_TEXT' | 'CHECKBOX' | 'PICTURE' | 'SIGNATURE' | null,
  ) => Promise<Result['data']['result']>;
};

export type EventPayload = {
  type: string;
  data: unknown;
};

export function sendEvent(iframe: HTMLIFrameElement, payload: EventPayload) {
  const requestId = generateRandomID();
  return new Promise<Result['data']['result']>((resolve) => {
    try {
      const handleMessage = (event: MessageEvent<string>) => {
        const parsedEvent: Result = (() => {
          try {
            const parsedEvent = JSON.parse(event.data);

            if (parsedEvent.type !== 'REQUEST_RESULT') {
              return {
                data: {
                  request_id: null,
                },
              };
            }

            return parsedEvent;
          } catch (e) {
            return null;
          }
        })();
        const isTargetIframe = event.source === iframe.contentWindow;
        const isMatchingResponse = parsedEvent.data.request_id === requestId;

        if (isTargetIframe && isMatchingResponse) {
          resolve(parsedEvent.data.result);
          window.removeEventListener('message', handleMessage);
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
        } satisfies Result['data']['result']);
        window.removeEventListener('message', handleMessage);
      }, DEFAULT_REQUEST_TIMEOUT_IN_MS);

      const cleanup = () => clearTimeout(timeoutId);
      window.addEventListener('message', cleanup);
    } catch (e) {
      const error = e as Error;
      resolve({
        success: false,
        error: {
          code: 'unexpected:failed_processing_request',
          message: `The following error happened: ${error.name}:${error.message}`,
        },
      });
    }
  });
}

type ErrorCodePrefix = 'bad_request' | 'unexpected';

type Result = {
  type: 'REQUEST_RESULT';
  data: {
    request_id: string;
    result:
      | { success: true }
      | {
          success: false;
          error: { code: `${ErrorCodePrefix}:${string}`; message: string };
        };
  };
};

export const useEmbed = (): { embedRef: React.RefObject<EmbedRefHandlers | null>; actions: EmbedActions } => {
  const embedRef = React.useRef<EmbedRefHandlers>(null);

  const handleSubmit: EmbedRefHandlers['submit'] = React.useCallback(
    async ({ downloadCopyOnDevice }): Promise<Result['data']['result']> => {
      if (embedRef.current === null) {
        return Promise.resolve({
          success: false as const,
          error: {
            code: 'bad_request:embed_ref_not_available' as const,
            message: 'embedRef is not available: make sure to pass embedRef to the <Embed /> component',
          },
        });
      }

      const result = await embedRef.current.submit({ downloadCopyOnDevice });

      return result;
    },
    [],
  );

  const handleSelectTool: EmbedRefHandlers['selectTool'] = React.useCallback(
    async (toolType): Promise<Result['data']['result']> => {
      if (embedRef.current === null) {
        return Promise.resolve({
          success: false as const,
          error: {
            code: 'bad_request:embed_ref_not_available' as const,
            message: 'embedRef is not available: make sure to pass embedRef to the <Embed /> component',
          },
        });
      }

      const result = await embedRef.current.selectTool(toolType);

      return result;
    },
    [],
  );

  return {
    embedRef,
    actions: {
      submit: handleSubmit,
      selectTool: handleSelectTool,
    },
  };
};

export type EmbedRefHandlers = EmbedActions;
