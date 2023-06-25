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

async function handleOpenEditor () {
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
    chrome.tabs.create({ url: 'https://simplePDF.eu/editor', active: false });
    openEditorButton.style.display = "none";
    errorDetails.textContent = "The SimplePDF editor was not allowed to be opened in the current tab";
    errorMessage.textContent = "We opened the editor in a new tab for you";

    await fetch('https://chrome.simplePDF.eu/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: 'mutation Track($input: TrackEventInput!) { track(input: $input) }',
        variables: {
          input: {
            type: 'ERROR',
            name: 'Chrome extension error',
            data: JSON.stringify({ name: e.name, message: e.message}),
          },
        },
      }),
    });
  }
}

openEditorButton.addEventListener("click", handleOpenEditor);
