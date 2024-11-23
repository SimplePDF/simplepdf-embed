export type Locale = 'de' | 'en' | 'es' | 'fr' | 'it' | 'pt';

export type EditorContext = {
  getFromConfig: (key: 'companyIdentifier' | 'locale') => string | null;
  log: (message: string, details: Record<string, unknown>) => void;
  getListeners: () => Map<Element, EventListener>;
};

export type EditorConfig = {
  companyIdentifier: string;
  locale: Locale;
  autoOpen: boolean;
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
