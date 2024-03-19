export type Locale = "de" | "en" | "es" | "fr" | "it" | "pt";

export type EditorConfig = {
  getFromConfig: (key: "companyIdentifier" | "locale") => string | null;
  log: (message: string, details: Record<string, unknown>) => void;
};

export type SimplePDF = {
  disableInit?: boolean;
  companyIdentifier?: string;
  locale?: Locale;
  closeEditor: () => void;
  openEditor: (params: {
    href: string | null;
    context?: Record<string, unknown>;
  }) => void;
};
