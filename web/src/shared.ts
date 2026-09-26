import { createEmbed, EmbedConfigError, type WebMCPOptions } from '@simplepdf/embed';
import type { ConfigSetter, EditorConfig, EditorContext, Locale } from './types';

const MODAL_ID = 'simplePDF_modal' as const;
const MODAL_CLOSE_BUTTON_ID = 'simplePDF_modal_close_button' as const;
const MODAL_STYLE_ID = 'simplePDF_modal_style' as const;
const IFRAME_ID = 'simplePDF_iframe' as const;
const IFRAME_CONTAINER_SELECTOR = `#${MODAL_ID} .simplePDF_iframeContainer`;

const UNEXPECTED_ERROR_INITIALIZATION = 'Unexpected: window.simplePDF not initialized';

const SUPPORTED_LOCALES = {
  de: true,
  en: true,
  es: true,
  fr: true,
  it: true,
  ja: true,
  nl: true,
  pt: true,
} satisfies Record<Locale, true>;

const editorContext: EditorContext = {
  log: (message: string, details: Record<string, unknown>) => {
    const debugAttribute = document.currentScript?.getAttribute('debug');
    const isDebug = debugAttribute !== null && debugAttribute !== undefined;

    if (!isDebug) {
      return;
    }

    console.warn(`@simplepdf/web-embed-pdf: ${message}`, details);
  },
  autoOpenListeners: window.simplePDF?._ctx.listenersMap ?? new Map(),
  activeEmbed: null,
};

const readScriptAttribute = (name: string): string | null => document.currentScript?.getAttribute(name) ?? null;

const isSimplePDFLink = (url: string) => {
  const regex = /^https:\/\/[^.]+\.simplepdf\.com(\/[^\/]+)?\/(form|documents)\/.+/;
  return regex.test(url);
};

const isPDFLink = (url: string) => url.endsWith('.pdf');

const isLocale = (value: string): value is Locale => Object.prototype.hasOwnProperty.call(SUPPORTED_LOCALES, value);

const getLocale = (): Locale => {
  const languageCode = (() => {
    try {
      const locale = new Intl.Locale(document.documentElement.lang);
      return locale.language;
    } catch (e) {
      return null;
    }
  })();

  const inputLocale = window.simplePDF?.config?.locale ?? readScriptAttribute('locale') ?? languageCode ?? 'en';

  return isLocale(inputLocale) ? inputLocale : 'en';
};

const readWebMCPAttribute = (): WebMCPOptions | null => {
  const webMCPAttribute = readScriptAttribute('webmcp');
  if (webMCPAttribute === null) {
    return null;
  }

  return webMCPAttribute === 'false' ? { enabled: false } : { enabled: true };
};

const scriptBaseDomain = readScriptAttribute('baseDomain');
const scriptWebMCP = readWebMCPAttribute();

export const config: EditorConfig = {
  locale: getLocale(),
  companyIdentifier: window.simplePDF?.config?.companyIdentifier ?? readScriptAttribute('companyIdentifier') ?? 'embed',
  autoOpen: false,
  ...(scriptBaseDomain !== null ? { baseDomain: scriptBaseDomain } : {}),
  ...(scriptWebMCP !== null ? { webMCP: scriptWebMCP } : {}),
};

export const setConfig: ConfigSetter = (params) => {
  if (!window.simplePDF) {
    throw Error(UNEXPECTED_ERROR_INITIALIZATION);
  }

  if (params.autoOpen !== undefined) {
    editorContext.log('Update config', { configKey: 'autoOpen', configValue: params.autoOpen });
    if (params.autoOpen) {
      enableAutoOpen();
    } else {
      disableAutoOpen();
    }
  }

  const definedParams = Object.fromEntries(
    Object.entries(params).filter(([, configValue]) => configValue !== undefined),
  );
  editorContext.log('Update config', definedParams);
  Object.assign(config, definedParams);

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

const removeModal = (): void => {
  document.getElementById(MODAL_ID)?.remove();
  document.getElementById(MODAL_STYLE_ID)?.remove();
  document.body.style.overflow = 'initial';
};

export const closeEditor = (): void => {
  editorContext.activeEmbed?.lifecycle.dispose();
  editorContext.activeEmbed = null;
  removeModal();
};

const MODAL_HTML = `
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
      </div>
    </div>
  </div>
 `;

export const openEditor = ({ href, context }: { href: string | null; context?: Record<string, unknown> }): void => {
  const { log } = editorContext;

  if (document.getElementById(IFRAME_ID)) {
    log('Editor already opened', {});
    return;
  }

  const { companyIdentifier, locale, baseDomain, webMCP } = window.simplePDF?.config ?? config;

  log('Creating the modal', { companyIdentifier, href });
  document.body.style.overflow = 'hidden';
  document.body.insertAdjacentHTML('beforebegin', MODAL_HTML);

  const iframeContainer = document.querySelector<HTMLElement>(IFRAME_CONTAINER_SELECTOR);
  if (iframeContainer === null) {
    removeModal();
    return;
  }

  const embed = (() => {
    try {
      return createEmbed({
        target: iframeContainer,
        companyIdentifier,
        baseDomain,
        locale,
        context,
        document: href ? { url: href } : undefined,
        iframeAttrs: { className: 'simplePDF_iframe' },
        webMCP,
      });
    } catch (e) {
      if (e instanceof EmbedConfigError) {
        console.error(`@simplepdf/web-embed-pdf: ${e.message}`);
        return null;
      }
      throw e;
    }
  })();

  if (embed === null) {
    removeModal();
    return;
  }

  iframeContainer.querySelector('iframe')?.setAttribute('id', IFRAME_ID);
  editorContext.activeEmbed = embed;

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
