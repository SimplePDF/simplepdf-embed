import * as React from 'react';
import { createPortal } from 'react-dom';
import { sendEvent, EmbedActions, useEmbed } from './hook';
import { buildEditorDomain, encodeContext, buildEditorURL, extractDocumentName, type Locale } from './utils';

import './styles.scss';

export { useEmbed };

export type EmbedEvent =
  | { type: 'EDITOR_READY'; data: Record<string, never> }
  | { type: 'DOCUMENT_LOADED'; data: { document_id: string } }
  | { type: 'PAGE_FOCUSED'; data: { previous_page: number | null; current_page: number; total_pages: number } }
  | { type: 'SUBMISSION_SENT'; data: { document_id: string; submission_id: string } };

type Props = InlineProps | ModalProps;

interface CommonProps {
  companyIdentifier?: string;
  context?: Record<string, unknown>;
  onEmbedEvent?: (event: EmbedEvent) => Promise<void> | void;
  locale?: Locale;
  /**
   * Override the base domain for self-hosted deployments (e.g., "yourdomain.com").
   * Interested in enterprise self-hosting? Contact sales@simplepdf.com
   */
  baseDomain?: string;
}

interface InlineProps extends CommonProps {
  mode: 'inline';
  className?: string;
  style?: React.CSSProperties;
  documentURL?: string;
}

interface ModalProps extends CommonProps {
  mode?: 'modal';
  children: React.ReactNode;
}

interface InternalProps {
  editorURL: string;
}

const CloseIcon: React.FC = () => (
  <svg height="512" viewBox="0 0 512 512" width="512" xmlSpace="preserve" xmlns="http://www.w3.org/2000/svg">
    <path d="M443.6 387.1 312.4 255.4l131.5-130c5.4-5.4 5.4-14.2 0-19.6l-37.4-37.6c-2.6-2.6-6.1-4-9.8-4-3.7 0-7.2 1.5-9.8 4L256 197.8 124.9 68.3c-2.6-2.6-6.1-4-9.8-4-3.7 0-7.2 1.5-9.8 4L68 105.9c-5.4 5.4-5.4 14.2 0 19.6l131.5 130L68.4 387.1c-2.6 2.6-4.1 6.1-4.1 9.8 0 3.7 1.4 7.2 4.1 9.8l37.4 37.6c2.7 2.7 6.2 4.1 9.8 4.1 3.5 0 7.1-1.3 9.8-4.1L256 313.1l130.7 131.1c2.7 2.7 6.2 4.1 9.8 4.1 3.5 0 7.1-1.3 9.8-4.1l37.4-37.6c2.6-2.6 4.1-6.1 4.1-9.8-.1-3.6-1.6-7.1-4.2-9.7z" />
  </svg>
);

const isInlineComponent = (props: Props): props is InlineProps => (props as InlineProps).mode === 'inline';

const InlineComponent = React.forwardRef<HTMLIFrameElement, Pick<InlineProps, 'className' | 'style'>>(
  ({ className, style }, iframeRef) => {
    return <iframe ref={iframeRef} title="SimplePDF" className={className} style={{ border: 0, ...style }} />;
  },
);

const ModalComponent = React.forwardRef<HTMLIFrameElement, InternalProps & Pick<ModalProps, 'children'>>(
  ({ children, editorURL }, iframeRef) => {
    const [shouldDisplayModal, setShouldDisplayModal] = React.useState(false);

    const handleAnchorClick = React.useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      setShouldDisplayModal(true);
    }, []);

    const handleCloseModal = React.useCallback(() => {
      setShouldDisplayModal(false);
    }, []);

    return (
      <>
        {shouldDisplayModal &&
          createPortal(
            <div className="simplePDF_container" role="dialog" aria-modal="true">
              <div className="simplePDF_content">
                <button onClick={handleCloseModal} className="simplePDF_close" aria-label="Close PDF editor modal">
                  <CloseIcon />
                </button>
                <div className="simplePDF_iframeContainer">
                  <iframe
                    ref={iframeRef}
                    title="SimplePDF"
                    referrerPolicy="no-referrer-when-downgrade"
                    className="simplePDF_iframe"
                    src={editorURL}
                  />
                </div>
              </div>
            </div>,
            document.body,
          )}

        {React.isValidElement(children)
          ? React.cloneElement(children as React.ReactElement<{ onClick?: React.MouseEventHandler }>, {
              onClick: handleAnchorClick,
            })
          : null}
      </>
    );
  },
);

type DocumentToLoadState =
  | { type: null; value: null; isEditorReady: boolean }
  | {
      type: 'iframe_event';
      value: string | null;
      isEditorReady: boolean;
      documentName: string;
    }
  | {
      type: 'cors_proxy_fallback';
      value: string | null;
      isEditorReady: boolean;
    };

export const EmbedPDF = React.forwardRef<EmbedActions, Props>((props, ref) => {
  const { context, companyIdentifier, locale, baseDomain } = props;
  const editorActionsReadyRef = React.useRef<Promise<void> | null>(null);
  const editorActionsReadyResolveRef = React.useRef<(() => void) | null>(null);
  const [documentState, setDocumentState] = React.useState<DocumentToLoadState>({
    type: null,
    value: null,
    isEditorReady: false,
  });
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  const editorDomain = React.useMemo(
    () => buildEditorDomain({ baseDomain, companyIdentifier }),
    [baseDomain, companyIdentifier],
  );

  const ensureEditorReady = async (): Promise<void> => {
    if (editorActionsReadyRef.current) {
      await editorActionsReadyRef.current;
    }
  };

  const loadDocument = React.useCallback(
    async ({ dataUrl, name, page }: { dataUrl: string; name?: string; page?: number }) => {
      if (!iframeRef.current) {
        return {
          success: false as const,
          error: { code: 'unexpected:iframe_not_available' as const, message: 'Iframe not available' },
        };
      }
      await ensureEditorReady();
      return sendEvent(iframeRef.current, {
        type: 'LOAD_DOCUMENT',
        data: { data_url: dataUrl, name, page },
      });
    },
    [],
  );

  const goTo: EmbedActions['goTo'] = React.useCallback(async ({ page }) => {
    if (!iframeRef.current) {
      return { success: false, error: { code: 'unexpected:iframe_not_available', message: 'Iframe not available' } };
    }
    await ensureEditorReady();
    return sendEvent(iframeRef.current, {
      type: 'GO_TO',
      data: { page },
    });
  }, []);

  const selectTool: EmbedActions['selectTool'] = React.useCallback(async (toolType) => {
    if (!iframeRef.current) {
      return { success: false, error: { code: 'unexpected:iframe_not_available', message: 'Iframe not available' } };
    }
    await ensureEditorReady();
    return sendEvent(iframeRef.current, {
      type: 'SELECT_TOOL',
      data: { tool: toolType },
    });
  }, []);

  const createField: EmbedActions['createField'] = React.useCallback(async (options) => {
    if (!iframeRef.current) {
      return { success: false, error: { code: 'unexpected:iframe_not_available', message: 'Iframe not available' } };
    }
    await ensureEditorReady();
    return sendEvent(iframeRef.current, {
      type: 'CREATE_FIELD',
      data: options,
    });
  }, []);

  const clearFields: EmbedActions['clearFields'] = React.useCallback(async (options) => {
    if (!iframeRef.current) {
      return { success: false, error: { code: 'unexpected:iframe_not_available', message: 'Iframe not available' } };
    }
    await ensureEditorReady();
    return sendEvent(iframeRef.current, {
      type: 'CLEAR_FIELDS',
      data: { field_ids: options?.fieldIds, page: options?.page },
    });
  }, []);

  const getDocumentContent: EmbedActions['getDocumentContent'] = React.useCallback(async (options) => {
    if (!iframeRef.current) {
      return { success: false, error: { code: 'unexpected:iframe_not_available', message: 'Iframe not available' } };
    }
    await ensureEditorReady();
    return sendEvent(iframeRef.current, {
      type: 'GET_DOCUMENT_CONTENT',
      data: { extraction_mode: options.extractionMode },
    });
  }, []);

  const submit: EmbedActions['submit'] = React.useCallback(async ({ downloadCopyOnDevice }) => {
    if (!iframeRef.current) {
      return { success: false, error: { code: 'unexpected:iframe_not_available', message: 'Iframe not available' } };
    }
    await ensureEditorReady();
    return sendEvent(iframeRef.current, {
      type: 'SUBMIT',
      data: { download_copy: downloadCopyOnDevice },
    });
  }, []);

  React.useImperativeHandle(ref, () => ({
    loadDocument,
    goTo,
    selectTool,
    createField,
    clearFields,
    getDocumentContent,
    submit,
  }));

  React.useEffect(() => {
    editorActionsReadyRef.current = new Promise((resolve) => {
      editorActionsReadyResolveRef.current = resolve;
    });
  }, []);

  const url: string | null = isInlineComponent(props)
    ? (props.documentURL ?? null)
    : ((props.children as { props?: { href: string } })?.props?.href ?? null);

  React.useEffect(() => {
    if (!url) {
      return;
    }

    const fetchedDocumentBlob = async (): Promise<string> => {
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'same-origin',
      });

      if (!response.ok) {
        throw new Error(
          `Failed to retrieve the document: ${JSON.stringify({
            status: response.status,
            url,
          })}`,
        );
      }

      const blob = await response.blob();

      const reader = new FileReader();
      await new Promise((resolve, reject) => {
        reader.onload = resolve;
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      return reader.result as string;
    };

    const documentName = extractDocumentName(url);

    fetchedDocumentBlob()
      .then((dataURL) =>
        setDocumentState((prev) => ({
          ...prev,
          type: 'iframe_event',
          value: dataURL,
          documentName,
        })),
      )
      .catch(() => {
        setDocumentState((prev) => ({
          ...prev,
          type: 'cors_proxy_fallback',
          value: url,
        }));
      });
  }, [url]);

  React.useEffect(() => {
    if (!documentState.isEditorReady || documentState.type !== 'iframe_event' || documentState.value === null) {
      return;
    }

    const editorDomainURL = new URL(editorDomain);
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({
        type: 'LOAD_DOCUMENT',
        data: { data_url: documentState.value, name: documentState.documentName },
      }),
      editorDomainURL.origin,
    );
  }, [documentState, editorDomain]);

  const embedEventHandler = React.useCallback(
    async (event: MessageEvent<string>) => {
      const eventOrigin = new URL(event.origin).origin;
      const iframeOrigin = new URL(editorDomain).origin;

      if (eventOrigin !== iframeOrigin) {
        return;
      }

      const isTrustedIframe = event.source === iframeRef.current?.contentWindow;

      if (!isTrustedIframe) {
        return;
      }

      const payload: EmbedEvent | null = (() => {
        try {
          return JSON.parse(event.data);
        } catch {
          console.error('Failed to parse iFrame event payload');
          return null;
        }
      })();

      if (payload === null) {
        return;
      }

      const handleEmbedEvent = async (embedEvent: EmbedEvent): Promise<void> => {
        try {
          await props.onEmbedEvent?.(embedEvent);
        } catch (e) {
          console.error(`onEmbedEvent failed to execute: ${JSON.stringify(e)}`);
        }
      };

      switch (payload.type) {
        case 'EDITOR_READY':
          setDocumentState((prev) => ({ ...prev, isEditorReady: true }));
          await handleEmbedEvent(payload);
          return;
        case 'DOCUMENT_LOADED': {
          // EDGE-CASE handling
          // Timeout necessary for now due to a race condition on SimplePDF's end
          // Without it actions.submit prior to the editor being loaded resolves to "document not found"
          setTimeout(() => editorActionsReadyResolveRef.current?.(), 200);
          await handleEmbedEvent(payload);
          return;
        }
        case 'PAGE_FOCUSED': {
          await handleEmbedEvent(payload);
          return;
        }
        case 'SUBMISSION_SENT': {
          await handleEmbedEvent(payload);
          return;
        }

        default:
          return;
      }
    },
    [props.onEmbedEvent, editorDomain],
  );

  React.useEffect(() => {
    window.addEventListener('message', embedEventHandler, false);

    return () => window.removeEventListener('message', embedEventHandler);
  }, [embedEventHandler]);

  const encodedContext = React.useMemo(() => encodeContext(context), [JSON.stringify(context)]);

  const editorURL = React.useMemo(
    () =>
      buildEditorURL({
        editorDomain,
        locale,
        encodedContext,
        hasDocumentUrl: Boolean(url),
        corsProxyFallbackUrl:
          documentState?.type === 'cors_proxy_fallback' && documentState?.value !== null ? documentState.value : null,
      }),
    [editorDomain, url, encodedContext, documentState, locale],
  );

  const isInline = isInlineComponent(props);

  React.useEffect(() => {
    // SSR support for the inline component:
    // Set the iframe URL only once it's rendered client side so that we can listen to the "READY" event
    // (The modal component is already only rendered client side as it requires a user click to load the iframe)
    if (!isInline) {
      return;
    }

    if (iframeRef && iframeRef.current) {
      iframeRef.current.src = editorURL;
    }
  }, [editorURL, isInline]);

  if (isInline) {
    return <InlineComponent className={props.className} style={props.style} ref={iframeRef} />;
  }

  return <ModalComponent children={props.children} editorURL={editorURL} ref={iframeRef} />;
});
