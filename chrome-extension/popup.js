chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
  chrome.scripting.executeScript(
    {
      target: { tabId: tab.id },
      func: () => {
        return { isPDF: document.contentType === "application/pdf" };
      },
    },
    (tab) => {
      if (!tab) {
        openEditorButton.textContent = "Open SimplePDF";
        return;
      }

      const [
        {
          result: { isPDF },
        },
      ] = tab;

      openEditorButton.textContent = isPDF
        ? "Edit with SimplePDF"
        : "Open SimplePDF";
    }
  );
});

openEditorButton.addEventListener("click", async () => {
  const setConfig = () => {
    window.simplePDF = {
      isDebug: false,
      companyIdentifier: "chrome",
      disableInit: true,
    };
  };

  const openEditor = () => {
    const currentURL = document.location.href;

    const isPDF = document.contentType === "application/pdf";

    const href = isPDF ? currentURL : null;

    window.simplePDF.createModal({ href });
  };

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: setConfig,
    });

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["./node_modules/@simplepdf/web-embed-pdf/dist/index.js"],
    });

    await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: openEditor });

    window.close();
  } catch(e) {
    openEditorButton.style.display = "none";
    errorMessage.textContent = "The SimplePDF editor cannot be opened in this tab";
    errorDetails.textContent = "Try navigating to a different website and opening the extension again";
  }
});
