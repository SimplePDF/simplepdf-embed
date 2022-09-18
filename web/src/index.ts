const getPDFAnchors = (): HTMLAnchorElement[] => {
  const anchors = Array.from(document.getElementsByTagName("a"));

  const anchorsWithPDF = anchors.filter((anchor) => {
    if (anchor.classList.contains("exclude-simplepdf")) {
      return false;
    }

    return (
      anchor.href.includes(".pdf") || anchor.classList.contains("simplepdf")
    );
  });

  return anchorsWithPDF;
};

const createModal = (companyIdentifier: string, href: string) => {
  const onModalClose = `(() => {document.getElementById("simplePDF_modal").remove(); document.getElementById("simplePDF_modal_style").remove(); })()`;

  const modal = `
    <style id="simplePDF_modal_style">
      .simplePDF_container {
        user-select: none;
        position: fixed;
        display: flex;
        box-sizing: border-box;
        align-items: center;
        justify-content: center;

        height: 100vh;
        width: 100%;
        z-index: 2;
        padding: 20px;
        top: 0;
        left: 0;
        background: rgba(0, 0, 0, 0.4);
      }

      .simplePDF_content {
        width: 94vw;
        height: 94vh;
        position: relative;
        box-sizing: border-box;
      }

      .simplePDF_iframeContainer {
        overflow: hidden;
        background: #f1f7ff;
        border-radius: 6px;
        width: 100%;
        height: 100%;
      }

      .simplePDF_iframe {
        border: none;
        border-radius: 6px;
        width: 100%;
        height: 100%;
      }

      .simplePDF_close {
        z-index: 1;
        position: absolute;
        top: -12px;
        right: -12px;

        border: none;
        padding: 6px;
        border-radius: 50px;

        display: flex;
        align-items: center;
        justify-content: center;

        box-shadow: 0 1px 3px rgb(0 0 0 / 10%), 0 1px 2px rgb(0 0 0 / 24%);

        cursor: pointer;
        background: #ff5959;
        text-shadow: 1px 1px #243889;
      }

      .simplePDF_close svg {
          fill: white;
          width: 14px;
          height: 14px;
      }

      .simplePDF_close:hover {
          box-shadow: 0 2px 4px rgb(0 0 0 / 10%), 0 4px 4px rgb(0 0 0 / 24%);
      }
  </style>
  <div class="simplePDF_container" aria-modal="true" id="simplePDF_modal">
    <div class="simplePDF_content">
      <button onclick='${onModalClose}' class="simplePDF_close" aria-label="Close PDF editor modal">
        <svg height="512" viewBox="0 0 512 512" width="512" xml-space="preserve" xmlns="http://www.w3.org/2000/svg">
          <path d="M443.6 387.1 312.4 255.4l131.5-130c5.4-5.4 5.4-14.2 0-19.6l-37.4-37.6c-2.6-2.6-6.1-4-9.8-4-3.7 0-7.2 1.5-9.8 4L256 197.8 124.9 68.3c-2.6-2.6-6.1-4-9.8-4-3.7 0-7.2 1.5-9.8 4L68 105.9c-5.4 5.4-5.4 14.2 0 19.6l131.5 130L68.4 387.1c-2.6 2.6-4.1 6.1-4.1 9.8 0 3.7 1.4 7.2 4.1 9.8l37.4 37.6c2.7 2.7 6.2 4.1 9.8 4.1 3.5 0 7.1-1.3 9.8-4.1L256 313.1l130.7 131.1c2.7 2.7 6.2 4.1 9.8 4.1 3.5 0 7.1-1.3 9.8-4.1l37.4-37.6c2.6-2.6 4.1-6.1 4.1-9.8-.1-3.6-1.6-7.1-4.2-9.7z" />
        </svg>
      </button>
      <div class="simplePDF_iframeContainer">
        <iframe referrerPolicy="no-referrer-when-downgrade" class="simplePDF_iframe" src="https://${companyIdentifier}.simplePDF.eu/editor?open=${href}" />
      </div>
    </div>
  </div>
 `;
  document.body.insertAdjacentHTML("beforebegin", modal);
};

const attachOnClick = (
  companyIdentifier: string,
  anchors: HTMLAnchorElement[]
) => {
  anchors.forEach((anchor) =>
    anchor.addEventListener("click", (e) => {
      e.preventDefault();
      createModal(companyIdentifier, anchor.href);
    })
  );
};

const simplePDF = () => {
  const pdfAnchors = getPDFAnchors();
  const companyIdentifier =
    document.currentScript?.getAttribute("companyIdentifier") ?? "embed";
  attachOnClick(companyIdentifier, pdfAnchors);
};

simplePDF();
