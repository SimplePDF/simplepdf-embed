import type { Embed, Locale, WebMCPOptions } from '@simplepdf/embed';

export type { Locale };

export type EditorContext = {
  log: (message: string, details: Record<string, unknown>) => void;
  autoOpenListeners: Map<Element, EventListener>;
  activeEmbed: Embed | null;
  activeModal: object | null;
};

export type EditorConfig = {
  companyIdentifier: string;
  locale: Locale;
  autoOpen: boolean;
  baseDomain?: string;
  webMCP?: WebMCPOptions;
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
