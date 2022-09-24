import { getPDFAnchors, attachOnClick, createModal } from "./shared";

const init = ({ companyIdentifier }: { companyIdentifier: string }) => {
  if (window["simplePDF"]?.disableInit === true) {
    return;
  }

  const pdfAnchors = getPDFAnchors();
  attachOnClick({ companyIdentifier, anchors: pdfAnchors });
};

const simplePDF = {
  isDebug:
    document.currentScript?.getAttribute("debug") === "true" ? true : false,
  companyIdentifier:
    window["simplePDF"]?.companyIdentifier ??
    document.currentScript?.getAttribute("companyIdentifier") ??
    "embed",
  disableInit: window["simplePDF"]?.disableInit ?? false,
  attachOnClick,
  createModal,
};

init({ companyIdentifier: simplePDF.companyIdentifier });

window["simplePDF"] = simplePDF;
