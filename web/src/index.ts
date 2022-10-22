import {
  getSimplePDFElements,
  attachOnClick,
  openEditor,
  closeEditor,
} from "./shared";

const init = () => {
  if (window["simplePDF"]?.disableInit === true) {
    return;
  }

  const elements = getSimplePDFElements();
  attachOnClick({ elements });
};

const simplePDF = {
  isDebug:
    window["simplePDF"]?.isDebug ??
    document.currentScript?.getAttribute("debug") === "true"
      ? true
      : false,
  companyIdentifier:
    window["simplePDF"]?.companyIdentifier ??
    document.currentScript?.getAttribute("companyIdentifier") ??
    "embed",
  disableInit: window["simplePDF"]?.disableInit ?? false,
  attachOnClick,
  openEditor,
  closeEditor,
};

init();

window["simplePDF"] = simplePDF;
