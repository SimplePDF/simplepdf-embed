import * as React from "react";
import { createPortal } from "react-dom";

import "./styles.scss";

export type EmbedEvent =
  | { type: "DOCUMENT_LOADED"; data: { document_id: string } }
  | { type: "SUBMISSION_SENT"; data: { submission_id: string } };

type Props = InlineProps | ModalProps;

interface CommonProps {
  companyIdentifier?: string;
  context?: Record<string, unknown>;
  onEmbedEvent?: (event: EmbedEvent) => Promise<void> | void;
  locale?: "en" | "de" | "es" | "fr" | "it" | "pt";
}

interface InlineProps extends CommonProps {
  mode: "inline";
  className?: string;
  style?: React.CSSProperties;
  documentURL?: string;
}

interface ModalProps extends CommonProps {
  mode?: "modal";
  children: React.ReactNode;
}

interface InternalProps {
  editorURL: string;
}

const CloseIcon: React.FC = () => (
  <svg
    height="512"
    viewBox="0 0 512 512"
    width="512"
    xmlSpace="preserve"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M443.6 387.1 312.4 255.4l131.5-130c5.4-5.4 5.4-14.2 0-19.6l-37.4-37.6c-2.6-2.6-6.1-4-9.8-4-3.7 0-7.2 1.5-9.8 4L256 197.8 124.9 68.3c-2.6-2.6-6.1-4-9.8-4-3.7 0-7.2 1.5-9.8 4L68 105.9c-5.4 5.4-5.4 14.2 0 19.6l131.5 130L68.4 387.1c-2.6 2.6-4.1 6.1-4.1 9.8 0 3.7 1.4 7.2 4.1 9.8l37.4 37.6c2.7 2.7 6.2 4.1 9.8 4.1 3.5 0 7.1-1.3 9.8-4.1L256 313.1l130.7 131.1c2.7 2.7 6.2 4.1 9.8 4.1 3.5 0 7.1-1.3 9.8-4.1l37.4-37.6c2.6-2.6 4.1-6.1 4.1-9.8-.1-3.6-1.6-7.1-4.2-9.7z" />
  </svg>
);

const loadDocument = async ({
  iframeRef,
  documentDataURL,
  documentName,
  editorDomain,
}: {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  documentDataURL: string;
  documentName: string;
  editorDomain: string;
}) => {
  const editorDomainURL = new URL(editorDomain);
  iframeRef.current?.contentWindow?.postMessage(
    JSON.stringify({
      type: "LOAD_DOCUMENT",
      data: { data_url: documentDataURL, name: documentName },
    }),
    editorDomainURL.origin,
  );
};

const DEFAULT_LOCALE = "en";

const isInlineComponent = (props: Props): props is InlineProps =>
  (props as InlineProps).mode === "inline";

const InlineComponent = React.forwardRef<
  HTMLIFrameElement,
  Pick<InlineProps, "className" | "style">
>(({ className, style }, iframeRef) => {
  return (
    <iframe
      ref={iframeRef}
      className={className}
      style={{ border: 0, ...style }}
    />
  );
});

const ModalComponent = React.forwardRef<
  HTMLIFrameElement,
  InternalProps & Pick<ModalProps, "children">
>(({ children, editorURL }, iframeRef) => {
  const [shouldDisplayModal, setShouldDisplayModal] = React.useState(false);

  const handleAnchorClick = React.useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      setShouldDisplayModal(true);
    },
    [],
  );

  const handleCloseModal = React.useCallback(() => {
    setShouldDisplayModal(false);
  }, []);

  return (
    <>
      {shouldDisplayModal &&
        createPortal(
          <div className="simplePDF_container" aria-modal="true">
            <div className="simplePDF_content">
              <button
                onClick={handleCloseModal}
                className="simplePDF_close"
                aria-label="Close PDF editor modal"
              >
                <CloseIcon />
              </button>
              <div className="simplePDF_iframeContainer">
                <iframe
                  ref={iframeRef}
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
        ? React.cloneElement(children as React.ReactElement<any>, {
            onClick: handleAnchorClick,
          })
        : null}
    </>
  );
});

type DocumentToLoadState =
  | { type: null; value: null; isEditorReady: boolean }
  | {
      type: "iframe_event";
      value: string | null;
      isEditorReady: boolean;
      documentName: string;
    }
  | {
      type: "cors_proxy_fallback";
      value: string | null;
      isEditorReady: boolean;
    };

export const EmbedPDF: React.FC<Props> = (props) => {
  const { context, companyIdentifier, locale } = props;
  const [documentState, setDocumentState] = React.useState<DocumentToLoadState>(
    { type: null, value: null, isEditorReady: false },
  );
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  const url: string | null = isInlineComponent(props)
    ? (props.documentURL ?? null)
    : ((props.children as { props?: { href: string } })?.props?.href ?? null);

  React.useEffect(() => {
    if (!url) {
      return;
    }

    const fetchedDocumentBlob = async () => {
      const response = await fetch(url, {
        method: "GET",
        credentials: "same-origin",
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

    const [documentName] = url.substring(url.lastIndexOf("/") + 1).split("?");

    fetchedDocumentBlob()
      .then((dataURL) =>
        setDocumentState((prev) => ({
          ...prev,
          type: "iframe_event",
          value: dataURL,
          documentName,
        })),
      )
      .catch(() => {
        setDocumentState((prev) => ({
          ...prev,
          type: "cors_proxy_fallback",
          value: url,
        }));
      });
  }, [url]);

  const editorDomain = React.useMemo(
    () => `https://${companyIdentifier ?? "react-editor"}.simplepdf.com`,
    [companyIdentifier],
  );

  React.useEffect(() => {
    if (
      !documentState.isEditorReady ||
      documentState.type !== "iframe_event" ||
      documentState.value === null
    ) {
      return;
    }

    loadDocument({
      iframeRef,
      documentDataURL: documentState.value,
      documentName: documentState.documentName,
      editorDomain,
    });
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

      const payload: (EmbedEvent | { type: "EDITOR_READY" }) | null = (() => {
        try {
          return JSON.parse(event.data);
        } catch (e) {
          console.error("Failed to parse iFrame event payload");
          return null;
        }
      })();

      switch (payload?.type) {
        case "EDITOR_READY":
          setDocumentState((prev) => ({ ...prev, isEditorReady: true }));
          return;
        case "DOCUMENT_LOADED":
        case "SUBMISSION_SENT":
          try {
            await props.onEmbedEvent?.(payload);
          } catch (e) {
            console.error(
              `onEmbedEvent failed to execute: ${JSON.stringify(e)}`,
            );
          }

          return;

        default:
          return;
      }
    },
    [props.onEmbedEvent, editorDomain],
  );

  React.useEffect(() => {
    window.addEventListener("message", embedEventHandler, false);

    return () => window.removeEventListener("message", embedEventHandler);
  }, [embedEventHandler]);

  const encodedContext: string | null = React.useMemo(() => {
    if (!context) {
      return null;
    }

    try {
      return encodeURIComponent(btoa(JSON.stringify(context)));
    } catch (e) {
      console.error(`Failed to encode the context: ${JSON.stringify(e)}`, {
        context,
      });
      return null;
    }
  }, [JSON.stringify(context)]);

  const editorURL = React.useMemo(() => {
    const simplePDFEditorURL = new URL(
      `/${locale ?? DEFAULT_LOCALE}/editor`,
      editorDomain,
    );

    if (encodedContext) {
      simplePDFEditorURL.searchParams.set("context", encodedContext);
    }

    if (url) {
      simplePDFEditorURL.searchParams.set("loadingPlaceholder", "true");
    }

    if (
      documentState?.type === "cors_proxy_fallback" &&
      documentState?.value !== null
    ) {
      simplePDFEditorURL.searchParams.set("open", documentState.value);
    }

    return simplePDFEditorURL.href;
  }, [editorDomain, url, encodedContext, documentState, locale]);

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
    return (
      <InlineComponent
        className={props.className}
        style={props.style}
        ref={iframeRef}
      />
    );
  }

  return (
    <ModalComponent
      children={props.children}
      editorURL={editorURL}
      ref={iframeRef}
    />
  );
};
