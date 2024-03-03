import * as React from "react";
import { createPortal } from "react-dom";

import "./styles.scss";

export type EmbedEvent =
  | { type: "DOCUMENT_LOADED"; data: { document_id: string } }
  | { type: "SUBMISSION_SENT"; data: { submission_id: string } };

type Props = InlineProps | ModalProps;

interface InlineProps {
  mode: "inline";
  className?: string;
  style?: React.CSSProperties;
  companyIdentifier?: string;
  documentURL?: string;
  context?: Record<string, unknown>;
  onEmbedEvent?: (event: EmbedEvent) => Promise<void> | void;
}

interface ModalProps {
  mode?: "modal";
  children: React.ReactElement;
  companyIdentifier?: string;
  context?: Record<string, unknown>;
  onEmbedEvent?: (event: EmbedEvent) => Promise<void> | void;
}

interface InternalProps {
  simplePDFUrl: string;
  embedEventHandler: (event: MessageEvent<string>) => Promise<void>;
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

const isInlineComponent = (props: Props): props is InlineProps =>
  (props as InlineProps).mode === "inline";

const InlineComponent: React.FC<
  InternalProps & Pick<InlineProps, "className" | "style">
> = ({ simplePDFUrl, embedEventHandler, className, style }) => {
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  React.useEffect(() => {
    if (!iframeRef.current) {
      window.removeEventListener("message", embedEventHandler);
      return;
    }

    window.addEventListener("message", embedEventHandler, false);

    return () => window.removeEventListener("message", embedEventHandler);
  }, [iframeRef, embedEventHandler]);

  return (
    <iframe
      ref={iframeRef}
      src={simplePDFUrl}
      className={className}
      style={{ border: 0, ...style }}
    />
  );
};

const ModalComponent: React.FC<
  InternalProps & Pick<ModalProps, "children">
> = ({ children, embedEventHandler, simplePDFUrl }) => {
  const [shouldDisplayModal, setShouldDisplayModal] = React.useState(false);

  React.useEffect(() => {
    if (!shouldDisplayModal) {
      window.removeEventListener("message", embedEventHandler);
      return;
    }

    window.addEventListener("message", embedEventHandler, false);

    return () => window.removeEventListener("message", embedEventHandler);
  }, [shouldDisplayModal, embedEventHandler]);

  const handleAnchorClick = React.useCallback((e: Event) => {
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
                  referrerPolicy="no-referrer-when-downgrade"
                  className="simplePDF_iframe"
                  src={simplePDFUrl}
                />
              </div>
            </div>
          </div>,
          document.body
        )}

      {React.cloneElement(children, { onClick: handleAnchorClick })}
    </>
  );
};

export const EmbedPDF: React.FC<Props> = (props) => {
  const { context, companyIdentifier } = props;

  const url: string | undefined = isInlineComponent(props)
    ? props.documentURL
    : props.children?.props?.href;

  const editorDomain = React.useMemo(
    () => `https://${companyIdentifier ?? "embed"}.simplepdf.eu`,
    [companyIdentifier]
  );

  const embedEventHandler = React.useCallback(
    async (event: MessageEvent<string>) => {
      if (props.onEmbedEvent === undefined) {
        return;
      }

      if (event.origin !== editorDomain) {
        return;
      }

      const payload: EmbedEvent | null = (() => {
        try {
          return JSON.parse(event.data);
        } catch (e) {
          console.error("Failed to parse iFrame event payload");
          return null;
        }
      })();

      switch (payload?.type) {
        case "DOCUMENT_LOADED":
        case "SUBMISSION_SENT":
          await props.onEmbedEvent(payload);
          return;

        default:
          return;
      }
    },
    [props.onEmbedEvent, editorDomain]
  );

  const simplePDFUrl = React.useMemo(() => {
    const baseURL = `${editorDomain}/editor`;

    const encodedContext = (() => {
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
    })();

    if (!url) {
      return `${baseURL}${encodedContext ? `?context=${encodedContext}` : ""}`;
    }

    const sanitizedOpenURL = encodeURIComponent(url);

    return `${baseURL}?open=${sanitizedOpenURL}${
      encodedContext ? `&context=${encodedContext}` : ""
    }`;
  }, [editorDomain, url, context]);

  if (isInlineComponent(props)) {
    return (
      <InlineComponent
        className={props.className}
        style={props.style}
        simplePDFUrl={simplePDFUrl}
        embedEventHandler={embedEventHandler}
      />
    );
  }

  return (
    <ModalComponent
      children={props.children}
      simplePDFUrl={simplePDFUrl}
      embedEventHandler={embedEventHandler}
    />
  );
};
