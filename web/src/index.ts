import {
  getSimplePDFElements,
  handleAttachOnClick,
  handleOpenEditor,
  closeEditor,
} from "./shared";
import type { EditorConfig, Locale, SimplePDF } from "./types";

export { Locale, EditorConfig, SimplePDF };

const locale = ((): Locale => {
  const languageCode = (() => {
    try {
      const locale = new Intl.Locale(document.documentElement.lang);
      return locale.language;
    } catch (e) {
      return null;
    }
  })();

  const inputLocale = (window["simplePDF"]?.locale ??
    document.currentScript?.getAttribute("locale") ??
    languageCode ??
    "en") as Locale;

  switch (inputLocale) {
    case "en":
    case "de":
    case "es":
    case "fr":
    case "it":
    case "pt":
      return inputLocale;
    default:
      inputLocale satisfies never;
      return "en";
  }
})();

const disableInit =
  window["simplePDF"]?.disableInit ??
  document.currentScript?.getAttribute("disableInit") !== null ??
  false;
const isDebug = document.currentScript?.getAttribute("debug") !== null;

const companyIdentifier =
  window["simplePDF"]?.companyIdentifier ??
  document.currentScript?.getAttribute("companyIdentifier") ??
  "embed";

const log = (message: string, details: Record<string, unknown>) => {
  if (!isDebug) {
    return;
  }

  console.warn(`@simplepdf/web-embed-pdf: ${message}`, details);
};

const editorConfig: EditorConfig = {
  getFromConfig: (key: "companyIdentifier" | "locale") =>
    window["simplePDF"]?.[key] ?? null,
  log,
};

const init = () => {
  if (disableInit === true) {
    return;
  }

  const attachOnClick = handleAttachOnClick(editorConfig);

  const elements = getSimplePDFElements();
  attachOnClick({ elements });
};

init();

window["simplePDF"] = {
  locale,
  disableInit,
  companyIdentifier,
  openEditor: handleOpenEditor(editorConfig),
  closeEditor,
};
