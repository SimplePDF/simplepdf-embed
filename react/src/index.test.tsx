/// <reference types="@testing-library/jest-dom" />

import * as React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmbedPDF } from './index';
import type { EmbedActions } from './hook';

vi.mock('./styles.scss', () => ({}));

/**
 * These tests focus on user-facing behavior:
 * - What users see (iframe, modal, styling)
 * - How users interact (clicking triggers, calling ref methods)
 * - What users receive (events via callbacks)
 *
 * Tests intentionally avoid implementation details like:
 * - Internal postMessage protocol format
 * - Internal state machine transitions
 * - Internal timing workarounds
 */

type MessageEventHandler = (event: MessageEvent) => void;

const createMessageEvent = ({
  origin,
  source,
  data,
}: {
  origin: string;
  source: Window | null;
  data: string;
}): MessageEvent => ({ origin, source, data }) as MessageEvent;

const getIframe = (): HTMLIFrameElement => {
  const iframe = screen.getByTitle('SimplePDF');
  return iframe as HTMLIFrameElement;
};

const getIframeSrcUrl = (): URL => {
  const iframe = getIframe();
  const src = iframe.getAttribute('src');
  if (src === null) {
    throw new Error('Expected iframe to have src attribute');
  }
  return new URL(src);
};

class MockFileReader {
  result: string | null = 'data:application/pdf;base64,dGVzdA==';
  onload: ((e: ProgressEvent) => void) | null = null;
  onerror: ((e: ProgressEvent) => void) | null = null;

  readAsDataURL(): void {
    queueMicrotask(() => {
      this.onload?.({} as ProgressEvent);
    });
  }
}

class MockFileReaderWithError {
  result: string | null = null;
  onload: ((e: ProgressEvent) => void) | null = null;
  onerror: ((e: ProgressEvent) => void) | null = null;

  readAsDataURL(): void {
    queueMicrotask(() => {
      this.onerror?.({} as ProgressEvent);
    });
  }
}

describe('EmbedPDF', () => {
  let messageHandler: MessageEventHandler | null = null;

  beforeEach(() => {
    vi.spyOn(window, 'addEventListener').mockImplementation((type, handler) => {
      if (type === 'message') {
        messageHandler = handler as MessageEventHandler;
      }
    });
    vi.spyOn(window, 'removeEventListener').mockImplementation(() => {});
  });

  afterEach(() => {
    messageHandler = null;
  });

  describe('inline mode', () => {
    it('renders an iframe with title', () => {
      render(<EmbedPDF mode="inline" />);

      expect(screen.getByTitle('SimplePDF')).toBeInTheDocument();
    });

    it('applies className prop to iframe', () => {
      render(<EmbedPDF mode="inline" className="custom-class" />);

      expect(screen.getByTitle('SimplePDF')).toHaveClass('custom-class');
    });

    it('applies style prop to iframe with border: 0', () => {
      render(<EmbedPDF mode="inline" style={{ width: '100%', height: 500 }} />);

      const iframe = screen.getByTitle('SimplePDF');
      expect(iframe).toHaveStyle({ width: '100%', height: '500px', border: '0px' });
    });

    it.each([
      { baseDomain: undefined, companyIdentifier: undefined, expectedOrigin: 'https://react-editor.simplepdf.com' },
      { baseDomain: 'custom.com', companyIdentifier: 'myco', expectedOrigin: 'https://myco.custom.com' },
      { baseDomain: 'simplepdf.nil:3000', companyIdentifier: 'e2e', expectedOrigin: 'http://e2e.simplepdf.nil:3000' },
    ])(
      'sets iframe src with correct domain ($expectedOrigin)',
      async ({ baseDomain, companyIdentifier, expectedOrigin }) => {
        render(<EmbedPDF mode="inline" baseDomain={baseDomain} companyIdentifier={companyIdentifier} />);

        await waitFor(() => {
          const url = getIframeSrcUrl();
          expect(url.origin).toBe(expectedOrigin);
          expect(url.pathname).toBe('/en/editor');
        });
      },
    );

    it.each([
      { locale: undefined, expectedPath: '/en/editor' },
      { locale: 'fr' as const, expectedPath: '/fr/editor' },
      { locale: 'de' as const, expectedPath: '/de/editor' },
    ])('sets correct locale in URL path ($expectedPath)', async ({ locale, expectedPath }) => {
      render(<EmbedPDF mode="inline" locale={locale} />);

      await waitFor(() => {
        const url = getIframeSrcUrl();
        expect(url.pathname).toBe(expectedPath);
      });
    });

    it('adds loadingPlaceholder param when documentURL provided', async () => {
      render(<EmbedPDF mode="inline" documentURL="https://example.com/doc.pdf" />);

      await waitFor(() => {
        const url = getIframeSrcUrl();
        expect(url.searchParams.get('loadingPlaceholder')).toBe('true');
      });
    });

    it('adds context param when context provided', async () => {
      render(<EmbedPDF mode="inline" context={{ key: 'value' }} />);

      await waitFor(() => {
        const url = getIframeSrcUrl();
        const encodedContext = url.searchParams.get('context');
        if (encodedContext === null) {
          throw new Error('Expected context param to be present');
        }
        const decodedContext = JSON.parse(atob(decodeURIComponent(encodedContext)));
        expect(decodedContext).toEqual({ key: 'value' });
      });
    });

    it('sets up message event listener on mount', () => {
      render(<EmbedPDF mode="inline" />);

      expect(window.addEventListener).toHaveBeenCalledWith('message', expect.any(Function), false);
    });

    it('removes message event listener on unmount', () => {
      const { unmount } = render(<EmbedPDF mode="inline" />);

      unmount();

      expect(window.removeEventListener).toHaveBeenCalledWith('message', expect.any(Function));
    });
  });

  describe('modal mode', () => {
    it('renders children trigger element', () => {
      render(
        <EmbedPDF>
          <button>Open PDF Editor</button>
        </EmbedPDF>,
      );

      expect(screen.getByRole('button', { name: 'Open PDF Editor' })).toBeInTheDocument();
    });

    it('does not render modal initially', () => {
      render(
        <EmbedPDF>
          <button>Open PDF Editor</button>
        </EmbedPDF>,
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('opens modal when trigger clicked', async () => {
      const user = userEvent.setup();
      render(
        <EmbedPDF>
          <button>Open PDF Editor</button>
        </EmbedPDF>,
      );

      await user.click(screen.getByRole('button', { name: 'Open PDF Editor' }));

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('renders modal with aria-modal attribute', async () => {
      const user = userEvent.setup();
      render(
        <EmbedPDF>
          <button>Open PDF Editor</button>
        </EmbedPDF>,
      );

      await user.click(screen.getByRole('button', { name: 'Open PDF Editor' }));

      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    });

    it('renders close button with aria-label', async () => {
      const user = userEvent.setup();
      render(
        <EmbedPDF>
          <button>Open PDF Editor</button>
        </EmbedPDF>,
      );

      await user.click(screen.getByRole('button', { name: 'Open PDF Editor' }));

      expect(screen.getByRole('button', { name: 'Close PDF editor modal' })).toBeInTheDocument();
    });

    it('closes modal when close button clicked', async () => {
      const user = userEvent.setup();
      render(
        <EmbedPDF>
          <button>Open PDF Editor</button>
        </EmbedPDF>,
      );

      await user.click(screen.getByRole('button', { name: 'Open PDF Editor' }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Close PDF editor modal' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders iframe inside modal', async () => {
      const user = userEvent.setup();
      render(
        <EmbedPDF>
          <button>Open PDF Editor</button>
        </EmbedPDF>,
      );

      await user.click(screen.getByRole('button', { name: 'Open PDF Editor' }));

      expect(screen.getByTitle('SimplePDF')).toBeInTheDocument();
    });

    it('sets iframe src with editor URL when modal opens', async () => {
      const user = userEvent.setup();
      render(
        <EmbedPDF companyIdentifier="testco">
          <button>Open PDF Editor</button>
        </EmbedPDF>,
      );

      await user.click(screen.getByRole('button', { name: 'Open PDF Editor' }));

      const url = getIframeSrcUrl();
      expect(url.origin).toBe('https://testco.simplepdf.com');
      expect(url.pathname).toBe('/en/editor');
    });

    it('extracts href from anchor child for document loading', async () => {
      const user = userEvent.setup();
      render(
        <EmbedPDF>
          <a href="https://example.com/doc.pdf">Edit PDF</a>
        </EmbedPDF>,
      );

      await user.click(screen.getByRole('link', { name: 'Edit PDF' }));

      const url = getIframeSrcUrl();
      expect(url.searchParams.get('loadingPlaceholder')).toBe('true');
    });

    it('renders null for non-element children', () => {
      render(<EmbedPDF>{'plain text'}</EmbedPDF>);

      expect(screen.queryByText('plain text')).not.toBeInTheDocument();
    });
  });

  describe('ref handlers', () => {
    it('exposes action methods via ref', async () => {
      const ref = React.createRef<EmbedActions>();

      render(<EmbedPDF mode="inline" ref={ref} />);

      await waitFor(() => {
        expect(ref.current).not.toBeNull();
      });

      expect(typeof ref.current?.goTo).toBe('function');
      expect(typeof ref.current?.selectTool).toBe('function');
      expect(typeof ref.current?.createField).toBe('function');
      expect(typeof ref.current?.clearFields).toBe('function');
      expect(typeof ref.current?.getDocumentContent).toBe('function');
      expect(typeof ref.current?.submit).toBe('function');
    });

    describe('action methods before modal opens (iframe not available)', () => {
      it.each([
        { action: 'goTo' as const, args: { page: 1 } },
        { action: 'selectTool' as const, args: 'TEXT' as const },
        {
          action: 'createField' as const,
          args: { type: 'TEXT' as const, page: 1, x: 0, y: 0, width: 100, height: 20 },
        },
        { action: 'clearFields' as const, args: {} },
        { action: 'getDocumentContent' as const, args: {} },
        { action: 'submit' as const, args: { downloadCopyOnDevice: false } },
      ])('$action returns error when iframe not available (modal not opened)', async ({ action, args }) => {
        const ref = React.createRef<EmbedActions>();

        render(
          <EmbedPDF ref={ref}>
            <button>Open PDF Editor</button>
          </EmbedPDF>,
        );

        await waitFor(() => {
          expect(ref.current).not.toBeNull();
        });

        if (ref.current === null) {
          throw new Error('Expected ref to be available');
        }

        const result = await (ref.current[action] as (arg: never) => Promise<unknown>)(args as never);

        expect(result).toEqual({
          success: false,
          error: {
            code: 'unexpected:iframe_not_available',
            message: 'Iframe not available',
          },
        });
      });
    });

    describe('action methods when editor is ready (inline mode)', () => {
      interface MockContentWindow {
        postMessage: ReturnType<typeof vi.fn>;
      }

      const setupMockContentWindow = (iframe: HTMLIFrameElement): MockContentWindow => {
        const mockContentWindow: MockContentWindow = {
          postMessage: vi.fn(),
        };
        Object.defineProperty(iframe, 'contentWindow', {
          value: mockContentWindow,
          writable: true,
        });
        return mockContentWindow;
      };

      const simulateEditorReady = async (
        iframe: HTMLIFrameElement,
        mockContentWindow: MockContentWindow,
      ): Promise<void> => {
        await act(async () => {
          messageHandler?.(
            createMessageEvent({
              origin: 'https://react-editor.simplepdf.com',
              source: mockContentWindow as unknown as Window,
              data: JSON.stringify({ type: 'EDITOR_READY', data: {} }),
            }),
          );
        });

        await act(async () => {
          messageHandler?.(
            createMessageEvent({
              origin: 'https://react-editor.simplepdf.com',
              source: mockContentWindow as unknown as Window,
              data: JSON.stringify({ type: 'DOCUMENT_LOADED', data: { document_id: 'doc123' } }),
            }),
          );
        });

        // Allow editor ready promise to resolve
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 250));
        });
      };

      const extractRequestId = (mockContentWindow: MockContentWindow): string => {
        const calls = mockContentWindow.postMessage.mock.calls;
        const lastCall = calls[calls.length - 1];
        if (!lastCall || typeof lastCall[0] !== 'string') {
          throw new Error('Expected postMessage to be called with a string');
        }
        const parsed = JSON.parse(lastCall[0]);
        return parsed.request_id;
      };

      const simulateActionResponse = async ({
        mockContentWindow,
        result,
      }: {
        mockContentWindow: MockContentWindow;
        result: { success: true } | { success: true; data: unknown };
      }): Promise<void> => {
        const requestId = extractRequestId(mockContentWindow);

        await act(async () => {
          messageHandler?.(
            createMessageEvent({
              origin: 'https://react-editor.simplepdf.com',
              source: mockContentWindow as unknown as Window,
              data: JSON.stringify({
                type: 'REQUEST_RESULT',
                data: { request_id: requestId, result },
              }),
            }),
          );
        });
      };

      it('goTo resolves with success when iframe responds', async () => {
        const ref = React.createRef<EmbedActions>();

        render(<EmbedPDF mode="inline" ref={ref} />);

        const iframe = getIframe();
        const mockContentWindow = setupMockContentWindow(iframe);

        await simulateEditorReady(iframe, mockContentWindow);

        if (ref.current === null) {
          throw new Error('Expected ref to be available');
        }

        const resultPromise = ref.current.goTo({ page: 2 });

        await waitFor(() => {
          expect(mockContentWindow.postMessage).toHaveBeenCalled();
        });

        await simulateActionResponse({
          mockContentWindow,
          result: { success: true },
        });

        const result = await resultPromise;
        expect(result).toEqual({ success: true });
      });

      it('submit resolves with success when iframe responds', async () => {
        const ref = React.createRef<EmbedActions>();

        render(<EmbedPDF mode="inline" ref={ref} />);

        const iframe = getIframe();
        const mockContentWindow = setupMockContentWindow(iframe);

        await simulateEditorReady(iframe, mockContentWindow);

        if (ref.current === null) {
          throw new Error('Expected ref to be available');
        }

        const resultPromise = ref.current.submit({ downloadCopyOnDevice: false });

        await waitFor(() => {
          expect(mockContentWindow.postMessage).toHaveBeenCalled();
        });

        await simulateActionResponse({
          mockContentWindow,
          result: { success: true },
        });

        const result = await resultPromise;
        expect(result).toEqual({ success: true });
      });

      it('getDocumentContent resolves with data when iframe responds', async () => {
        const ref = React.createRef<EmbedActions>();

        render(<EmbedPDF mode="inline" ref={ref} />);

        const iframe = getIframe();
        const mockContentWindow = setupMockContentWindow(iframe);

        await simulateEditorReady(iframe, mockContentWindow);

        if (ref.current === null) {
          throw new Error('Expected ref to be available');
        }

        const resultPromise = ref.current.getDocumentContent({ extractionMode: 'auto' });

        await waitFor(() => {
          expect(mockContentWindow.postMessage).toHaveBeenCalled();
        });

        await simulateActionResponse({
          mockContentWindow,
          result: {
            success: true,
            data: {
              name: 'document.pdf',
              pages: [{ page: 1, content: 'Hello world' }],
            },
          },
        });

        const result = await resultPromise;
        expect(result).toEqual({
          success: true,
          data: {
            name: 'document.pdf',
            pages: [{ page: 1, content: 'Hello world' }],
          },
        });
      });
    });
  });

  describe('event handling', () => {
    it('calls onEmbedEvent when EDITOR_READY received', async () => {
      const onEmbedEvent = vi.fn();

      render(<EmbedPDF mode="inline" onEmbedEvent={onEmbedEvent} />);

      const iframe = getIframe();

      await act(async () => {
        messageHandler?.(
          createMessageEvent({
            origin: 'https://react-editor.simplepdf.com',
            source: iframe.contentWindow,
            data: JSON.stringify({ type: 'EDITOR_READY', data: {} }),
          }),
        );
      });

      expect(onEmbedEvent).toHaveBeenCalledWith({ type: 'EDITOR_READY', data: {} });
    });

    it.each([
      { type: 'DOCUMENT_LOADED', data: { document_id: 'doc123' } },
      { type: 'PAGE_FOCUSED', data: { previous_page: 1, current_page: 2, total_pages: 5 } },
      { type: 'SUBMISSION_SENT', data: { document_id: 'doc123', submission_id: 'sub456' } },
    ])('calls onEmbedEvent for $type', async ({ type, data }) => {
      const onEmbedEvent = vi.fn();

      render(<EmbedPDF mode="inline" onEmbedEvent={onEmbedEvent} />);

      const iframe = getIframe();

      await act(async () => {
        messageHandler?.(
          createMessageEvent({
            origin: 'https://react-editor.simplepdf.com',
            source: iframe.contentWindow,
            data: JSON.stringify({ type, data }),
          }),
        );
      });

      expect(onEmbedEvent).toHaveBeenCalledWith({ type, data });
    });

    it('ignores events from different origins', async () => {
      const onEmbedEvent = vi.fn();

      render(<EmbedPDF mode="inline" onEmbedEvent={onEmbedEvent} />);

      await act(async () => {
        messageHandler?.(
          createMessageEvent({
            origin: 'https://malicious.com',
            source: null,
            data: JSON.stringify({ type: 'EDITOR_READY', data: {} }),
          }),
        );
      });

      expect(onEmbedEvent).not.toHaveBeenCalled();
    });

    it('ignores events from untrusted iframe source', async () => {
      const onEmbedEvent = vi.fn();

      render(<EmbedPDF mode="inline" onEmbedEvent={onEmbedEvent} />);

      await act(async () => {
        messageHandler?.(
          createMessageEvent({
            origin: 'https://react-editor.simplepdf.com',
            source: {} as Window,
            data: JSON.stringify({ type: 'EDITOR_READY', data: {} }),
          }),
        );
      });

      expect(onEmbedEvent).not.toHaveBeenCalled();
    });

    it('handles invalid JSON in message gracefully', async () => {
      const onEmbedEvent = vi.fn();
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<EmbedPDF mode="inline" onEmbedEvent={onEmbedEvent} />);

      const iframe = getIframe();

      await act(async () => {
        messageHandler?.(
          createMessageEvent({
            origin: 'https://react-editor.simplepdf.com',
            source: iframe.contentWindow,
            data: 'not valid json',
          }),
        );
      });

      expect(onEmbedEvent).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to parse iFrame event payload');
    });

    it('handles error when onEmbedEvent throws', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const onEmbedEvent = vi.fn().mockRejectedValue(new Error('Handler error'));

      render(<EmbedPDF mode="inline" onEmbedEvent={onEmbedEvent} />);

      const iframe = getIframe();

      await act(async () => {
        messageHandler?.(
          createMessageEvent({
            origin: 'https://react-editor.simplepdf.com',
            source: iframe.contentWindow,
            data: JSON.stringify({ type: 'EDITOR_READY', data: {} }),
          }),
        );
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('onEmbedEvent failed to execute'));
    });
  });

  describe('document loading', () => {
    let originalFetch: typeof globalThis.fetch;
    let originalFileReader: typeof globalThis.FileReader;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
      originalFileReader = globalThis.FileReader;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
      globalThis.FileReader = originalFileReader;
    });

    it('calls fetch with documentURL when provided', async () => {
      const fetchMock = vi.fn().mockImplementation(
        () =>
          new Promise(() => {
            // Never resolve to prevent state updates
          }),
      );
      globalThis.fetch = fetchMock;

      render(<EmbedPDF mode="inline" documentURL="https://example.com/document.pdf" />);

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith('https://example.com/document.pdf', {
          method: 'GET',
          credentials: 'same-origin',
        });
      });
    });

    it('adds open param to URL when CORS fallback is triggered', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('CORS error'));

      render(<EmbedPDF mode="inline" documentURL="https://example.com/doc.pdf" />);

      await waitFor(() => {
        const url = getIframeSrcUrl();
        expect(url.searchParams.get('open')).toBe('https://example.com/doc.pdf');
      });
    });

    it('falls back to CORS proxy when fetch returns non-ok response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 });

      render(<EmbedPDF mode="inline" documentURL="https://example.com/forbidden.pdf" />);

      await waitFor(() => {
        const url = getIframeSrcUrl();
        expect(url.searchParams.get('open')).toBe('https://example.com/forbidden.pdf');
      });
    });

    it('loads document via fetch and FileReader when CORS allows', async () => {
      const mockBlob = new Blob(['pdf content'], { type: 'application/pdf' });
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      globalThis.FileReader = MockFileReader as unknown as typeof FileReader;

      render(<EmbedPDF mode="inline" documentURL="https://example.com/doc.pdf" />);

      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalledWith('https://example.com/doc.pdf', {
          method: 'GET',
          credentials: 'same-origin',
        });
      });
    });

    it('falls back to CORS proxy when FileReader fails', async () => {
      const mockBlob = new Blob(['pdf content'], { type: 'application/pdf' });
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      globalThis.FileReader = MockFileReaderWithError as unknown as typeof FileReader;

      render(<EmbedPDF mode="inline" documentURL="https://example.com/doc.pdf" />);

      await waitFor(() => {
        const url = getIframeSrcUrl();
        expect(url.searchParams.get('open')).toBe('https://example.com/doc.pdf');
      });
    });

    it('handles unmount during fetch without errors', async () => {
      let resolveFetch: (value: Response) => void;
      globalThis.fetch = vi.fn().mockReturnValue(
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
      );
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { unmount } = render(<EmbedPDF mode="inline" documentURL="https://example.com/doc.pdf" />);

      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalled();
      });

      unmount();

      await act(async () => {
        resolveFetch!({
          ok: true,
          blob: () => Promise.resolve(new Blob(['pdf'], { type: 'application/pdf' })),
        } as Response);
      });

      expect(consoleErrorSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("Can't perform a React state update on an unmounted component"),
      );
    });
  });

  describe('context changes', () => {
    it('re-encodes context when it changes', () => {
      const decodeContext = (url: URL): unknown => {
        const encoded = url.searchParams.get('context');
        if (encoded === null) {
          throw new Error('Expected context param to be present');
        }
        return JSON.parse(atob(decodeURIComponent(encoded)));
      };

      const { rerender } = render(<EmbedPDF mode="inline" context={{ v: 1 }} />);

      const initialUrl = getIframeSrcUrl();
      expect(decodeContext(initialUrl)).toEqual({ v: 1 });

      rerender(<EmbedPDF mode="inline" context={{ v: 2 }} />);

      const newUrl = getIframeSrcUrl();
      expect(decodeContext(newUrl)).toEqual({ v: 2 });
    });
  });

  describe('unknown event types', () => {
    it('ignores unknown event types', async () => {
      const onEmbedEvent = vi.fn();

      render(<EmbedPDF mode="inline" onEmbedEvent={onEmbedEvent} />);

      const iframe = getIframe();

      await act(async () => {
        messageHandler?.(
          createMessageEvent({
            origin: 'https://react-editor.simplepdf.com',
            source: iframe.contentWindow,
            data: JSON.stringify({ type: 'UNKNOWN_EVENT', data: {} }),
          }),
        );
      });

      expect(onEmbedEvent).not.toHaveBeenCalled();
    });
  });
});
