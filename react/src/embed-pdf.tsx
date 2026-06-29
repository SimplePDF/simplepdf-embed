// The React home for embedding + agentically driving the SimplePDF editor, built
// on the framework-free @simplepdf/embed core.
//
//   <EmbedPDF companyIdentifier="acme" document={{ url }} onEmbedEvent={…} />   // render
//   const { embedRef, actions } = useEmbed()                                   // drive
//     - actions: imperative methods you call (actions.goTo({ page }))
//   The agentic tools are the opt-in @simplepdf/react-embed-pdf/ai-sdk subpath
//   (useEmbedTools(embedRef)), keeping zod off this entry.
//
// Config + actions are camelCase (JS/TS idiom); the bridge transforms to the
// snake_case wire. ONE deliberate exception: onEmbedEvent forwards the editor's
// outbound events VERBATIM (SCREAMING_SNAKE `type` + snake_case `data`) — the stable
// EmbedEvent contract. useEffect is deliberate: mounting / driving the editor
// iframe is exactly the "synchronize with an external system" case.

import * as React from 'react';
import { createPortal } from 'react-dom';
import { createEmbed, type EmbedDocument } from '@simplepdf/embed';
import type {
  BridgeLogger,
  BridgeResult,
  EditorEvent,
  EditorEventMap,
  Embed,
  IframeActions,
  Locale,
  LogPayload,
  SelectToolInput,
  SubmitInput,
} from '@simplepdf/embed';
import { notMounted } from './not-mounted';

import './styles.scss';

const DEFAULT_COMPANY_IDENTIFIER = 'react-editor';

const assignRef = (ref: React.ForwardedRef<EmbedActions | null>, value: EmbedActions | null): void => {
  if (typeof ref === 'function') {
    ref(value);
  } else if (ref !== null) {
    ref.current = value;
  }
};

// Deprecated argument shapes for the two imperative actions whose shape changed (the new
// shapes supersede them). Defined once at the single boundary to the (pure camelCase) core, so
// BOTH the forwarded ref handle and useEmbed().actions accept the deprecated forms.
const normalizeSelectTool = (input: SelectToolInput | SelectToolInput['tool']): SelectToolInput =>
  typeof input === 'object' && input !== null ? input : { tool: input };
const normalizeSubmit = (input: SubmitInput | { downloadCopyOnDevice: boolean }): SubmitInput =>
  'downloadCopyOnDevice' in input ? { downloadCopy: input.downloadCopyOnDevice } : input;

// Earlier published versions accepted a relative `documentURL` / trigger href (it fetched the URL, which resolves
// against the page); the core now requires an absolute URL, so resolve relative values here
// to stay backward-compatible. Absolute URLs pass through unchanged; under SSR (no window)
// or an unusable base (e.g. about:blank), the raw value is kept — the core then validates it.
const toAbsoluteUrl = (url: string): string => {
  if (typeof window === 'undefined') {
    return url;
  }
  try {
    return new URL(url, window.location.href).href;
  } catch {
    return url;
  }
};

// The forwarded ref is the FLAT EmbedActions (`embedRef.current.selectTool(...)`), not
// the core's grouped handle — so existing ref consumers keep working (this stays a
// non-breaking minor). It flattens the core's `embed.actions` group and overloads
// selectTool/submit for the deprecated argument shapes.
const toEmbedActions = (embed: Embed): EmbedActions => ({
  ...embed.actions,
  selectTool: (input) => embed.actions.selectTool(normalizeSelectTool(input)),
  submit: (input) => embed.actions.submit(normalizeSubmit(input)),
});

// --- EmbedPDF ---------------------------------------------------------------

// The editor's outbound events, forwarded to onEmbedEvent VERBATIM — the stable,
// established event contract (SCREAMING_SNAKE `type` + snake_case `data`). It is
// the core's EditorEvent re-exported (single owner; no restated copy).
export type EmbedEvent = EditorEvent;

type CommonEmbedPDFProps = {
  // Your companyIdentifier: the <companyIdentifier>.simplepdf.com subdomain from
  // your SimplePDF account (defaults to the free no-account 'react-editor').
  companyIdentifier?: string;
  baseDomain?: string;
  // The document to open, same typed shape as createEmbed: one of { url } |
  // { dataUrl } | { file }. A SimplePDF documents URL loads directly (prefill etc.).
  document?: EmbedDocument;
  /** @deprecated Use `document={{ url: '…' }}` instead (still accepted). */
  documentURL?: string;
  context?: Record<string, unknown>;
  locale?: Locale;
  onEmbedEvent?: (event: EmbedEvent) => void | Promise<void>;
  // Optional: structured logging of the bridge lifecycle + errors.
  logger?: BridgeLogger;
};

type InlineEmbedPDFProps = CommonEmbedPDFProps & {
  // Opt into inline: the editor renders directly in your layout.
  mode: 'inline';
  className?: string;
  style?: React.CSSProperties;
};

type ModalEmbedPDFProps = CommonEmbedPDFProps & {
  // Modal is the DEFAULT (mode omitted === 'modal'): a click-to-open editor.
  mode?: 'modal';
  // The clickable trigger; clicking it opens the editor (loading `document`) in a modal.
  children: React.ReactNode;
};

export type EmbedPDFProps = InlineEmbedPDFProps | ModalEmbedPDFProps;

type SurfaceProps = {
  companyIdentifier: string;
  baseDomain?: string;
  document?: EmbedDocument;
  locale?: Locale;
  context?: Record<string, unknown>;
  logger?: BridgeLogger;
  onEmbedEvent?: (event: EmbedEvent) => void | Promise<void>;
  className?: string;
  style?: React.CSSProperties;
};

// Renders a container div and mounts the editor iframe inside it via createEmbed.
// Mount/unmount of this component drives create/dispose, so the modal gets the
// same lifecycle for free (it mounts the surface only while open).
const EmbedSurface = React.forwardRef<EmbedActions | null, SurfaceProps>((props, ref) => {
  const { companyIdentifier, baseDomain, document: embedDocument, locale, context, className, style } = props;
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Keep callbacks + logger in a ref so changing them does not remount the iframe.
  const callbacksRef = React.useRef({ onEmbedEvent: props.onEmbedEvent, logger: props.logger });
  callbacksRef.current = { onEmbedEvent: props.onEmbedEvent, logger: props.logger };

  // A stable logger that always delegates to the latest `logger` prop, so a
  // changed logger reaches the already-mounted bridge without a remount.
  const stableLogger = React.useMemo<BridgeLogger>(() => {
    const delegate =
      (level: 'debug' | 'info' | 'warn' | 'error') =>
      (event: string, payload: LogPayload): void => {
        // A consumer logger that throws must never break the bridge or event
        // forwarding (this is the catch sink for onEmbedEvent failures too).
        try {
          callbacksRef.current.logger?.[level](event, payload);
        } catch {
          // swallow: logging is best-effort.
        }
      };
    return { debug: delegate('debug'), info: delegate('info'), warn: delegate('warn'), error: delegate('error') };
  }, []);

  // Remount the iframe only when the editor config actually changes. Key a url /
  // data-URL on the string itself; key a File/Blob on object IDENTITY via a counter
  // that bumps when a different instance is passed (two distinct same-metadata Files
  // must still remount). A fresh `{ url }` literal each render does not remount.
  const currentFile = embedDocument !== undefined && 'file' in embedDocument ? embedDocument.file : null;
  const fileKeyRef = React.useRef<{ file: Blob | null; key: number }>({ file: null, key: 0 });
  if (currentFile !== fileKeyRef.current.file) {
    fileKeyRef.current = { file: currentFile, key: fileKeyRef.current.key + 1 };
  }
  const documentSource = ((): string | null => {
    if (embedDocument === undefined) {
      return null;
    }
    if ('url' in embedDocument) {
      return embedDocument.url;
    }
    if ('dataUrl' in embedDocument) {
      return embedDocument.dataUrl;
    }
    return `file:${fileKeyRef.current.key}`;
  })();
  const documentName = embedDocument?.name ?? null;
  const documentPage = embedDocument?.page ?? null;
  const contextKey = React.useMemo((): string => {
    if (context === undefined) {
      return 'null';
    }
    try {
      return JSON.stringify(context);
    } catch {
      // Circular / non-serializable context (a programmer error; encodeContext
      // drops it too). Key on the top-level shape so render never throws.
      return `unserializable:${Object.keys(context).sort().join(',')}`;
    }
  }, [context]);

  React.useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }
    const embed = createEmbed({
      target: container,
      companyIdentifier,
      baseDomain,
      document: embedDocument,
      locale,
      context,
      logger: stableLogger,
    });
    assignRef(ref, toEmbedActions(embed));
    // Forward each editor event to onEmbedEvent as the verbatim { type, data }. The
    // `forwarders` map is exhaustiveness-checked (satisfies) so a NEW editor event is a
    // compile error here until it is forwarded; the explicit per-type subscriptions below
    // keep each payload typed (no cast). The consumer callback is isolated so a throw /
    // rejected promise can't break the bridge.
    const forwardEvent = (event: EmbedEvent): void => {
      void Promise.resolve()
        .then(() => callbacksRef.current.onEmbedEvent?.(event))
        .catch((error) => {
          stableLogger.error('on_embed_event_failed', {
            message: error instanceof Error ? error.message : String(error),
          });
        });
    };
    const forwarders = {
      EDITOR_READY: (data) => forwardEvent({ type: 'EDITOR_READY', data }),
      DOCUMENT_LOADED: (data) => forwardEvent({ type: 'DOCUMENT_LOADED', data }),
      PAGE_FOCUSED: (data) => forwardEvent({ type: 'PAGE_FOCUSED', data }),
      SUBMISSION_SENT: (data) => forwardEvent({ type: 'SUBMISSION_SENT', data }),
    } satisfies { [TEventType in keyof EditorEventMap]: (data: EditorEventMap[TEventType]) => void };
    const unsubscribers = [
      embed.events.on('EDITOR_READY', forwarders.EDITOR_READY),
      embed.events.on('DOCUMENT_LOADED', forwarders.DOCUMENT_LOADED),
      embed.events.on('PAGE_FOCUSED', forwarders.PAGE_FOCUSED),
      embed.events.on('SUBMISSION_SENT', forwarders.SUBMISSION_SENT),
    ];
    return () => {
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
      embed.lifecycle.dispose();
      assignRef(ref, null);
    };
    // embedDocument/context are read here but fully determined by the document
    // primitives + contextKey deps below; stableLogger is stable. `ref` is deliberately
    // EXCLUDED: a stable object ref (the useEmbed norm) is captured once, and excluding it
    // means an unstable inline callback ref can't trigger a full iframe teardown + remount
    // (which would silently lose editor state) on every parent re-render.
  }, [companyIdentifier, baseDomain, locale, documentSource, documentName, documentPage, contextKey, stableLogger]);

  return <div ref={containerRef} className={className} style={style} />;
});
EmbedSurface.displayName = 'EmbedSurface';

const CloseIcon: React.FC = () => (
  <svg height="512" viewBox="0 0 512 512" width="512" xmlSpace="preserve" xmlns="http://www.w3.org/2000/svg">
    <path d="M443.6 387.1 312.4 255.4l131.5-130c5.4-5.4 5.4-14.2 0-19.6l-37.4-37.6c-2.6-2.6-6.1-4-9.8-4-3.7 0-7.2 1.5-9.8 4L256 197.8 124.9 68.3c-2.6-2.6-6.1-4-9.8-4-3.7 0-7.2 1.5-9.8 4L68 105.9c-5.4 5.4-5.4 14.2 0 19.6l131.5 130L68.4 387.1c-2.6 2.6-4.1 6.1-4.1 9.8 0 3.7 1.4 7.2 4.1 9.8l37.4 37.6c2.7 2.7 6.2 4.1 9.8 4.1 3.5 0 7.1-1.3 9.8-4.1L256 313.1l130.7 131.1c2.7 2.7 6.2 4.1 9.8 4.1 3.5 0 7.1-1.3 9.8-4.1l37.4-37.6c2.6-2.6 4.1-6.1 4.1-9.8-.1-3.6-1.6-7.1-4.2-9.7z" />
  </svg>
);

// A valid React element is assumed to accept onClick + carry an href (DOM elements
// + components that forward them). Narrowing via a type guard avoids an `as` cast
// at the clone / href read.
const isTriggerElement = (
  node: React.ReactNode,
): node is React.ReactElement<{ href?: string; onClick?: React.MouseEventHandler }> => React.isValidElement(node);

// The trigger child's href, the modal document fallback (the established pattern: a
// <a href="doc.pdf"> trigger opens that PDF). The `document` prop takes precedence.
const hrefOf = (node: React.ReactNode): string | undefined => (isTriggerElement(node) ? node.props.href : undefined);

// Click-to-open modal chrome. The editor surface is only mounted while open, so
// the embed is created on open and disposed on close.
const ModalChrome = ({
  trigger,
  children,
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
}): React.ReactElement => {
  const [isOpen, setIsOpen] = React.useState(false);
  const handleOpen = React.useCallback((event: React.MouseEvent): void => {
    event.preventDefault();
    setIsOpen(true);
  }, []);
  const handleClose = React.useCallback((): void => setIsOpen(false), []);
  return (
    <>
      {isOpen
        ? createPortal(
            <div className="simplePDF_container" role="dialog" aria-modal="true">
              <div className="simplePDF_content">
                <button
                  type="button"
                  onClick={handleClose}
                  className="simplePDF_close"
                  aria-label="Close PDF editor modal"
                >
                  <CloseIcon />
                </button>
                <div className="simplePDF_iframeContainer">{children}</div>
              </div>
            </div>,
            document.body,
          )
        : null}
      {isTriggerElement(trigger) ? React.cloneElement(trigger, { onClick: handleOpen }) : trigger}
    </>
  );
};

// The single React entry point for embedding the editor: a click-to-open modal by
// default, or inline with `mode="inline"`. Forwards the typed Embed handle.
export const EmbedPDF = React.forwardRef<EmbedActions | null, EmbedPDFProps>((props, ref) => {
  const companyIdentifier = props.companyIdentifier ?? DEFAULT_COMPANY_IDENTIFIER;
  // `document` wins; otherwise the deprecated `documentURL`, resolved if relative.
  const propDocument =
    props.document ?? (props.documentURL !== undefined ? { url: toAbsoluteUrl(props.documentURL) } : undefined);
  if (props.mode !== 'inline') {
    // Modal is the default. Document: `document` / `documentURL`, else the trigger
    // child's href (the established pattern). On click, open the editor in a portal.
    const triggerHref = hrefOf(props.children);
    const modalDocument = propDocument ?? (triggerHref !== undefined ? { url: toAbsoluteUrl(triggerHref) } : undefined);
    return (
      <ModalChrome trigger={props.children}>
        <EmbedSurface
          ref={ref}
          companyIdentifier={companyIdentifier}
          baseDomain={props.baseDomain}
          document={modalDocument}
          locale={props.locale}
          context={props.context}
          logger={props.logger}
          onEmbedEvent={props.onEmbedEvent}
          className="simplePDF_iframe"
        />
      </ModalChrome>
    );
  }
  // Inline: the editor renders directly in your layout.
  return (
    <EmbedSurface
      ref={ref}
      companyIdentifier={companyIdentifier}
      baseDomain={props.baseDomain}
      document={propDocument}
      locale={props.locale}
      context={props.context}
      logger={props.logger}
      onEmbedEvent={props.onEmbedEvent}
      className={props.className}
      style={props.style}
    />
  );
});
EmbedPDF.displayName = 'EmbedPDF';

// --- useEmbed ---------------------------------------------------------------

// The editor operations (the `embed.actions` group), derived from IframeActions so a new
// editor operation fails the build here until it is added. Two methods carry deprecated
// argument-shape overloads (their shapes changed this release): `selectTool` also
// accepts the old positional tool, and `submit` also accepts the old
// `{ downloadCopyOnDevice }`. Both normalize to the new shape before hitting the (pure
// camelCase) core — the deprecated forms keep existing callers working, so this stays a
// non-breaking minor.
export type EmbedActions = Omit<IframeActions, 'selectTool' | 'submit'> & {
  /** Pass `{ tool }`. The bare tool value is the deprecated positional form. */
  selectTool: (input: SelectToolInput | SelectToolInput['tool']) => Promise<BridgeResult>;
  /** Pass `{ downloadCopy }`. `{ downloadCopyOnDevice }` is the deprecated form. */
  submit: (input: SubmitInput | { downloadCopyOnDevice: boolean }) => Promise<BridgeResult>;
};

// The single hook. Attach `embedRef` to <EmbedPDF ref={embedRef} />, then drive the
// editor with `actions` (imperative), stable + null-safe before the editor mounts;
// lifecycle is observed via <EmbedPDF onEmbedEvent>. The agentic tools live in the
// opt-in `@simplepdf/react-embed-pdf/ai-sdk` subpath (useEmbedTools(embedRef)) — keeping
// `zod` off this entry, so a <EmbedPDF>-only app never loads it.
export const useEmbed = (): {
  embedRef: React.RefObject<EmbedActions | null>;
  actions: EmbedActions;
} => {
  const embedRef = React.useRef<EmbedActions | null>(null);

  const actions = React.useMemo<EmbedActions>(
    () => ({
      createField: (input) => embedRef.current?.createField(input) ?? notMounted(),
      deleteFields: (input) => embedRef.current?.deleteFields(input) ?? notMounted(),
      deletePages: (input) => embedRef.current?.deletePages(input) ?? notMounted(),
      detectFields: () => embedRef.current?.detectFields() ?? notMounted(),
      download: () => embedRef.current?.download() ?? notMounted(),
      focusField: (input) => embedRef.current?.focusField(input) ?? notMounted(),
      getDocumentContent: (input) => embedRef.current?.getDocumentContent(input) ?? notMounted(),
      getFields: () => embedRef.current?.getFields() ?? notMounted(),
      goTo: (input) => embedRef.current?.goTo(input) ?? notMounted(),
      loadDocument: (input) => embedRef.current?.loadDocument(input) ?? notMounted(),
      movePage: (input) => embedRef.current?.movePage(input) ?? notMounted(),
      rotatePage: (input) => embedRef.current?.rotatePage(input) ?? notMounted(),
      // selectTool/submit normalize the deprecated arg shapes inside
      // embedRef.current (the flat EmbedActions), so actions just delegate.
      selectTool: (input) => embedRef.current?.selectTool(input) ?? notMounted(),
      setFieldValue: (input) => embedRef.current?.setFieldValue(input) ?? notMounted(),
      submit: (input) => embedRef.current?.submit(input) ?? notMounted(),
    }),
    [],
  );

  return { embedRef, actions };
};
