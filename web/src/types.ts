export type Locale = 'de' | 'en' | 'es' | 'fr' | 'it' | 'pt';

export type IncomingIframeEvent =
  | { type: 'DOCUMENT_LOADED'; data: { document_id: string } }
  | { type: 'SUBMISSION_SENT'; data: { submission_id: string } }
  | { type: 'EDITOR_READY' };

export type OutgoingIframeEvent = {
  type: 'LOAD_DOCUMENT';
  data: { data_url: string; name: string };
};

export type EditorContext = {
  getFromConfig: (key: 'baseDomain' | 'companyIdentifier' | 'locale') => string | null;
  log: (message: string, details: Record<string, unknown>) => void;
  autoOpenListeners: Map<Element, EventListener>;
  outgoingEventsQueue: OutgoingIframeEvent[];
  getEditor: () => {
    iframe: HTMLIFrameElement | null;
    modal: HTMLDivElement | null;
    styles: HTMLStyleElement | null;
  };
  isIframeReady: boolean;
};

export type EditorConfig = {
  autoOpen: boolean;
  baseDomain: string;
  companyIdentifier: string;
  locale: Locale;
};

export type ConfigSetter = (params: Partial<EditorConfig>) => EditorConfig;

export type SimplePDF = {
  config: EditorConfig;
  setConfig: ConfigSetter;
  closeEditor: () => void;
  openEditor: (params: { href: string | null; context?: Record<string, unknown> }) => void;
  _ctx: {
    listenersMap: Map<Element, EventListener>;
  };
};
