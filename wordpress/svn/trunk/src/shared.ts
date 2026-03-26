import { EditorConfig, EditorContext, Locale, ConfigSetter, OutgoingIframeEvent, IncomingIframeEvent } from './types';

const MODAL_ID = 'simplePDF_modal' as const;
const MODAL_CLOSE_BUTTON_ID = 'simplePDF_modal_close_button' as const;
const MODAL_STYLE_ID = 'simplePDF_modal_style' as const;
const IFRAME_ID = 'simplePDF_iframe' as const;

const UNEXPECTED_ERROR_INITIALIZATION = 'Unexpected: window.simplePDF not initialized';
const UNEXPECTED_ERROR_IFRAME_NOT_INSTANTIATED = 'Unexpected: SimplePDF iframe not instantiated';

const editorContext: EditorContext = {
  getFromConfig: (key: 'companyIdentifier' | 'locale') => window.simplePDF?.config?.[key] ?? null,
  log: (message: string, details: Record<string, unknown>) => {
    const debugAttribute = document.currentScript?.getAttribute('debug');
    const isDebug = debugAttribute !== null && debugAttribute !== undefined;

    if (!isDebug) {
      return;
    }

    console.warn(`@simplepdf/web-embed-pdf: ${message}`, details);
  },
  autoOpenListeners: window.simplePDF?._ctx.listenersMap ?? new Map(),
  outgoingEventsQueue: [],
  isIframeReady: false,
  getEditor: () => {
    return {
      iframe: document.getElementById(IFRAME_ID) as HTMLIFrameElement | null,
      modal: document.getElementById(MODAL_ID) as HTMLDivElement | null,
      styles: document.getElementById(MODAL_STYLE_ID) as HTMLStyleElement | null,
    };
  },
};

const isSimplePDFLink = (url: string) => {
  const regex = /^https:\/\/[^.]+\.simplepdf\.com(\/[^\/]+)?\/(form|documents)\/.+/;
  return regex.test(url);
};

const isPDFLink = (url: string) => url.endsWith('.pdf');

const getLocale = (): Locale => {
  const languageCode = (() => {
    try {
      const locale = new Intl.Locale(document.documentElement.lang);
      return locale.language;
    } catch (e) {
      return null;
    }
  })();

  const inputLocale = (editorContext.getFromConfig('locale') ??
    document.currentScript?.getAttribute('locale') ??
    languageCode ??
    'en') as Locale;

  switch (inputLocale) {
    case 'en':
    case 'de':
    case 'es':
    case 'fr':
    case 'it':
    case 'pt':
      return inputLocale;
    default:
      inputLocale satisfies never;
      return 'en';
  }
};

export const config: EditorConfig = {
  locale: getLocale(),
  companyIdentifier:
    editorContext.getFromConfig('companyIdentifier') ??
    document.currentScript?.getAttribute('companyIdentifier') ??
    'embed',
  autoOpen: false,
};

export const setConfig: ConfigSetter = (params) => {
  let config = window.simplePDF?.config;

  if (!config) {
    throw Error(UNEXPECTED_ERROR_INITIALIZATION);
  }

  Object.keys(params).forEach((paramKey) => {
    const configKey = paramKey as keyof EditorConfig;
    const configValue = params[configKey];

    if (configValue === undefined) {
      return;
    }

    editorContext.log('Update config', { configKey, configValue });

    switch (configKey) {
      case 'autoOpen': {
        if (configValue === true) {
          enableAutoOpen();
        } else {
          disableAutoOpen();
        }
        break;
      }
      default:
        break;
    }

    (config[configKey] as any) = configValue as any;
  });

  return config;
};

export const getSimplePDFElements = (document: Document): Element[] => {
  const getAnchors = (): HTMLAnchorElement[] => {
    const anchors = Array.from(document.getElementsByTagName('a'));

    const anchorsWithPDF = anchors.filter((anchor) => {
      if (anchor.classList.contains('exclude-simplepdf')) {
        return false;
      }

      return isPDFLink(anchor.href) || anchor.classList.contains('simplepdf') || isSimplePDFLink(anchor.href);
    });

    return anchorsWithPDF;
  };

  const getNonAnchors = (): Element[] => {
    const nonAnchorElements = Array.from(document.getElementsByClassName('simplepdf')).filter(
      (element) => !isAnchor(element),
    );

    return nonAnchorElements;
  };

  return [...getNonAnchors(), ...getAnchors()];
};

export const closeEditor = (): void => {
  removeIframe();
  document.body.style.overflow = 'initial';
};

const eventsListener = (event: MessageEvent) => {
  const { getEditor, outgoingEventsQueue, getFromConfig, log } = editorContext;
  const iframe = getEditor().iframe;
  const editorDomain = `https://${getFromConfig('companyIdentifier')}.simplepdf.com`;

  const eventOrigin = new URL(event.origin).origin;
  const iframeOrigin = new URL(editorDomain).origin;

  if (eventOrigin !== iframeOrigin) {
    log('Incoming message from untrusted origin', { eventOrigin, iframeOrigin });
    return;
  }

  const isTrustedIframe = event.source === iframe?.contentWindow;

  if (!isTrustedIframe) {
    log('Incoming message from untrusted iframe', { eventOrigin, iframeOrigin });
    return;
  }

  const payload: IncomingIframeEvent | null = (() => {
    try {
      return JSON.parse(event.data);
    } catch (e) {
      console.error('Failed to parse iFrame event payload');
      return null;
    }
  })();

  switch (payload?.type) {
    case 'EDITOR_READY':
      editorContext.isIframeReady = true;
      outgoingEventsQueue.forEach((queuedEvent) => {
        sendEventToIframe(queuedEvent);
      });
      outgoingEventsQueue.length = 0;
      return;
    case 'DOCUMENT_LOADED':
    case 'SUBMISSION_SENT':
    default:
      return;
  }
};

const onIframeLoaded = () => {
  window.addEventListener('message', eventsListener);
};

const removeIframe = () => {
  window.removeEventListener('message', eventsListener);
  editorContext.getEditor().modal?.remove();
  editorContext.getEditor().styles?.remove();
  editorContext.isIframeReady = false;
  editorContext.outgoingEventsQueue.length = 0;
};

function sendEventToIframe(event: OutgoingIframeEvent) {
  const { outgoingEventsQueue, log, isIframeReady } = editorContext;
  const editorDomainURL = new URL(editorContext.getEditor().iframe?.src ?? '');

  if (isIframeReady) {
    log('Send iframe event', { event });
    editorContext.getEditor().iframe?.contentWindow?.postMessage(JSON.stringify(event), editorDomainURL.origin);
    return;
  }

  log('Push event to queue', { event });
  outgoingEventsQueue.push(event);
}

export const openEditor = ({ href, context }: { href: string | null; context?: Record<string, unknown> }): void => {
  const { getFromConfig, log, getEditor } = editorContext;

  if (getEditor().iframe) {
    log('Editor already opened', {});
    return;
  }

  const companyIdentifier = getFromConfig('companyIdentifier');
  const locale = getFromConfig('locale');

  const encodedContext = (() => {
    if (!context) {
      return null;
    }

    try {
      return encodeURIComponent(btoa(JSON.stringify(context)));
    } catch (e) {
      log(`Failed to encode the context: ${JSON.stringify(e)}`, { context });
      return null;
    }
  })();

  const iframeURL = new URL(`/${locale}/editor`, `https://${companyIdentifier}.simplepdf.com`);

  if (href) {
    iframeURL.searchParams.set('loadingPlaceholder', 'true');
  }

  if (encodedContext) {
    iframeURL.searchParams.set('context', encodedContext);
  }

  const modal = `
    <style id="${MODAL_STYLE_ID}">
      .simplePDF_container {
        user-select: none;
        position: fixed;
        display: flex;
        box-sizing: border-box;
        align-items: center;
        justify-content: center;

        height: 100vh;
        width: 100%;
        z-index: 2147483647;
        padding: 16px;
        top: 0;
        left: 0;
        background: rgba(0, 0, 0, 0.4);
      }

      .simplePDF_content {
        width: 100%;
        height: 100%;
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
  <div class="simplePDF_container" aria-modal="true" id="${MODAL_ID}">
    <div class="simplePDF_content">
      <button id="${MODAL_CLOSE_BUTTON_ID}" class="simplePDF_close" aria-label="Close PDF editor modal">
        <svg height="512" viewBox="0 0 512 512" width="512" xml-space="preserve" xmlns="http://www.w3.org/2000/svg">
          <path d="M443.6 387.1 312.4 255.4l131.5-130c5.4-5.4 5.4-14.2 0-19.6l-37.4-37.6c-2.6-2.6-6.1-4-9.8-4-3.7 0-7.2 1.5-9.8 4L256 197.8 124.9 68.3c-2.6-2.6-6.1-4-9.8-4-3.7 0-7.2 1.5-9.8 4L68 105.9c-5.4 5.4-5.4 14.2 0 19.6l131.5 130L68.4 387.1c-2.6 2.6-4.1 6.1-4.1 9.8 0 3.7 1.4 7.2 4.1 9.8l37.4 37.6c2.7 2.7 6.2 4.1 9.8 4.1 3.5 0 7.1-1.3 9.8-4.1L256 313.1l130.7 131.1c2.7 2.7 6.2 4.1 9.8 4.1 3.5 0 7.1-1.3 9.8-4.1l37.4-37.6c2.6-2.6 4.1-6.1 4.1-9.8-.1-3.6-1.6-7.1-4.2-9.7z" />
        </svg>
      </button>
      <div class="simplePDF_iframeContainer">
        <iframe id="${IFRAME_ID}" referrerPolicy="no-referrer-when-downgrade" class="simplePDF_iframe" src="${
          iframeURL.href
        }" onload="${onIframeLoaded()}"/>
      </div>
    </div>
  </div>
 `;

  log('Creating the modal', {
    companyIdentifier: getFromConfig('companyIdentifier'),
    iframeURL: iframeURL,
  });
  document.body.style.overflow = 'hidden';
  document.body.insertAdjacentHTML('beforebegin', modal);

  if (href) {
    const fetchedDocumentBlob = async (): Promise<string> => {
      const response = await fetch(href ?? '', {
        method: 'GET',
        credentials: 'same-origin',
      });

      if (!response.ok) {
        throw new Error(
          `Failed to retrieve the document: ${JSON.stringify({
            status: response.status,
            href,
          })}`,
        );
      }

      const blob = await response.blob();

      const reader = new FileReader();
      await new Promise((resolve, reject) => {
        reader.onload = resolve;
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      return reader.result as string;
    };

    fetchedDocumentBlob()
      .then((dataURL) => {
        const [documentName] = href.substring(href.lastIndexOf('/') + 1).split('?');
        sendEventToIframe({ type: 'LOAD_DOCUMENT', data: { data_url: dataURL, name: documentName } });
      })
      .catch(() => {
        const iframe = getEditor().iframe;
        if (!iframe) {
          throw Error(UNEXPECTED_ERROR_IFRAME_NOT_INSTANTIATED);
        }

        iframeURL.searchParams.delete('loadingPlaceholder');
        iframeURL.searchParams.set('open', href);

        iframe.src = iframeURL.href;
      });
  }

  log('Attach close modal listener', {});
  document.getElementById(MODAL_CLOSE_BUTTON_ID)?.addEventListener('click', closeEditor);
};

const isAnchor = (element: HTMLAnchorElement | Element): element is HTMLAnchorElement => element.hasAttribute('href');

const getListenersCount = (): number => editorContext.autoOpenListeners.size;

const enableAutoOpen = () => {
  const listenersCount = getListenersCount();
  if (listenersCount > 0) {
    editorContext.log('Listeners already attached', { listenersCount });
    return;
  }

  const elements = getSimplePDFElements(document);

  editorContext.log('Attaching listeners to anchors', {
    anchorsCount: elements.length,
  });

  elements.forEach((element) => {
    const handler: EventListenerOrEventListenerObject = (e) => {
      e.preventDefault();
      openEditor({ href: isAnchor(element) ? element.href : null });
    };

    element.addEventListener('click', handler);

    editorContext.autoOpenListeners.set(element, handler);
  });
};

const disableAutoOpen = () => {
  const listenersCount = getListenersCount();

  if (listenersCount === 0) {
    editorContext.log('No listeners to remove', {});
    return;
  }

  editorContext.log('Removing listeners', { listenersCount });

  editorContext.autoOpenListeners.forEach((handler, element) => {
    element.removeEventListener('click', handler);
  });
  editorContext.autoOpenListeners.clear();
};
