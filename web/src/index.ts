import {
  getPDFAnchors,
  attachOnClick,
  createModal,
  closeModal,
} from "./shared";

const init = () => {
  if (window["simplePDF"]?.disableInit === true) {
    return;
  }

  const pdfAnchors = getPDFAnchors();
  attachOnClick({ anchors: pdfAnchors });
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
  createModal,
  closeModal,
};

init();

window["simplePDF"] = simplePDF;
