// User preferences change
chrome.storage.onChanged.addListener((changes, areaName) => {
  const hasPreferencesChanged = areaName === "local" && changes.userPreferences;

  if (!hasPreferencesChanged) {
    return;
  }

  toggleAutoOpenPDFLinksOnCurrentTab();
});

// Current tab switch
chrome.tabs.onActivated.addListener(() => {
  toggleAutoOpenPDFLinksOnCurrentTab();
});

// Current tab URL change
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") {
    return;
  }

  toggleAutoOpenPDFLinksOnCurrentTab();
});

function toggleAutoOpenPDFLinksOnCurrentTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];

    if (!currentTab || !currentTab.id || !currentTab.url) {
      return;
    }

    const isUnsupportedURL =
      currentTab.url.startsWith("chrome://") ||
      currentTab.url.startsWith("edge://");

    if (isUnsupportedURL) {
      return;
    }

    chrome.storage.local.get("userPreferences", ({ userPreferences }) => {
      const preferences = userPreferences ?? { autoOpen: false };

      chrome.scripting.executeScript(
        {
          target: { tabId: currentTab.id },
          files: ["./node_modules/@simplepdf/web-embed-pdf/dist/index.js"],
        },
        () => {
          if (chrome.runtime.lastError) {
            return;
          }

          chrome.scripting.executeScript({
            target: { tabId: currentTab.id },
            func: (preferences) => {
              if (!window.simplePDF) {
                return;
              }

              window.simplePDF.setConfig({
                autoOpen: preferences.autoOpen,
                companyIdentifier: "chrome",
              });
            },
            args: [preferences],
          });
        },
      );
    });
  });
}
