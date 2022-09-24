openEditorButton.addEventListener("click", async () => {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: setConfig,
  });

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["./node_modules/@simplepdf/web-embed-pdf/dist/index.js"],
  });

  setTimeout(() => {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: openEditor,
    });

    window.close();
  }, 100);
});

const setConfig = () => {
  window.simplePDF = {
    isDebug: true,
    companyIdentifier: "chrome",
    disableInit: true,
  };
};

const openEditor = () => {
  window.simplePDF.createModal({ url: null });
};
