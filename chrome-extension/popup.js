chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
  chrome.scripting.executeScript(
    {
      target: { tabId: tab.id },
      func: () => {
        return { isPDF: document.contentType === 'application/pdf' };
      },
    },
    (tab) => {
      preferencesHeader.textContent = chrome.i18n.getMessage('preferencesHeader');
      autoOpenLabel.textContent = chrome.i18n.getMessage('autoOpenLabel');

      if (!tab) {
        openEditorButton.textContent = chrome.i18n.getMessage('openEditor');
        return;
      }

      const [
        {
          result: { isPDF },
        },
      ] = tab;

      openEditorButton.textContent = isPDF
        ? chrome.i18n.getMessage('editWithSimplePDF')
        : chrome.i18n.getMessage('openEditor');
    },
  );
});

async function handleOpenEditor() {
  const openEditor = () => {
    const currentURL = document.location.href;

    const isPDF = document.contentType === 'application/pdf';

    const href = isPDF ? currentURL : null;

    window.simplePDF.openEditor({ href });
  };

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    await chrome.scripting.executeScript(
      {
        target: { tabId: tab.id },
        files: ['./node_modules/@simplepdf/web-embed-pdf/dist/index.js'],
      },
      () => {
        if (chrome.runtime.lastError) {
          return;
        }

        chrome.scripting.executeScript({
          target: { tabId: currentTab.id },
          func: () => {
            if (!window.simplePDF) {
              return;
            }

            window.simplePDF.setConfig({
              companyIdentifier: 'chrome',
            });
          },
        });
      },
    );

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: openEditor,
    });

    window.close();
  } catch (e) {
    chrome.tabs.create({ url: 'https://simplePDF.com/editor', active: false });
    openEditorButton.style.display = 'none';
    errorDetails.textContent = chrome.i18n.getMessage('unableToOpenInCurrentTab');
    errorMessage.textContent = chrome.i18n.getMessage('openedInOtherTab');

    await fetch('https://chrome.simplePDF.com/graphql', {
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
            data: JSON.stringify({ name: e.name, message: e.message }),
          },
        },
      }),
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get('userPreferences', ({ userPreferences }) => {
    const isAutoOpenedDefined = userPreferences && typeof userPreferences.autoOpen !== 'undefined';

    if (isAutoOpenedDefined) {
      autoOpenRadio.checked = userPreferences.autoOpen;
      return;
    }

    autoOpenRadio.checked = false;
  });

  setTimeout(() => {
    toggle.classList.add('withTransition');
  }, 200);
});

const handleChangeAutoOpenPreferences = (e) => {
  const preferences = {
    autoOpen: e.currentTarget.checked,
  };
  chrome.storage.local.set({ userPreferences: preferences });
};

openEditorButton.addEventListener('click', handleOpenEditor);
autoOpenRadio.addEventListener('change', handleChangeAutoOpenPreferences);
