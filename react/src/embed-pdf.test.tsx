/// <reference types="@testing-library/jest-dom" />

import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmbedPDF, useEmbed, type EmbedActions } from './index';

// scss is a build concern; in tests it is irrelevant to behavior.
vi.mock('./styles.scss', () => ({}));

// User-facing behavior only: what renders, how the modal opens/closes, the
// onEmbedEvent contract, and the useEmbed contract (null-safe before mount).

describe('EmbedPDF (inline)', () => {
  it('renders the editor iframe inside the host element for the companyIdentifier origin', () => {
    const { container } = render(<EmbedPDF mode="inline" companyIdentifier="acme" />);
    const iframe = container.querySelector('iframe');
    if (!(iframe instanceof HTMLIFrameElement)) {
      throw new Error('expected an iframe under the host element');
    }
    const src = new URL(iframe.getAttribute('src') ?? '');
    expect(src.origin).toBe('https://acme.simplepdf.com');
    expect(src.pathname).toBe('/en/editor');
  });

  it('defaults companyIdentifier to the free no-account editor', () => {
    const { container } = render(<EmbedPDF mode="inline" />);
    const iframe = container.querySelector('iframe');
    if (!(iframe instanceof HTMLIFrameElement)) {
      throw new Error('expected an iframe under the host element');
    }
    expect(new URL(iframe.getAttribute('src') ?? '').origin).toBe('https://react-editor.simplepdf.com');
  });

  it('navigates straight to a SimplePDF documents URL (preserving its query)', () => {
    const { container } = render(
      <EmbedPDF
        mode="inline"
        companyIdentifier="acme"
        document={{ url: 'https://demo.simplepdf.com/documents/abc?prefill=p1' }}
      />,
    );
    const iframe = container.querySelector('iframe');
    if (!(iframe instanceof HTMLIFrameElement)) {
      throw new Error('expected an iframe under the host element');
    }
    const src = new URL(iframe.getAttribute('src') ?? '');
    expect(src.origin).toBe('https://demo.simplepdf.com');
    expect(src.pathname).toBe('/documents/abc');
    expect(src.searchParams.get('prefill')).toBe('p1');
  });

  it('accepts the deprecated documentURL as an alias for document (deprecated alias)', () => {
    const { container } = render(
      <EmbedPDF mode="inline" companyIdentifier="acme" documentURL="https://demo.simplepdf.com/documents/abc" />,
    );
    const iframe = container.querySelector('iframe');
    if (!(iframe instanceof HTMLIFrameElement)) {
      throw new Error('expected an iframe under the host element');
    }
    const src = new URL(iframe.getAttribute('src') ?? '');
    expect(src.origin).toBe('https://demo.simplepdf.com');
    expect(src.pathname).toBe('/documents/abc');
  });

  it('accepts a relative documentURL by resolving it against the page URL', () => {
    // Earlier versions fetched the documentURL (relative resolves against the page); the core now
    // requires an absolute URL, so the compat boundary resolves it — the editor must
    // still mount (the old core would throw in createEmbed and render no iframe).
    const { container } = render(<EmbedPDF mode="inline" companyIdentifier="acme" documentURL="/form.pdf" />);
    const iframe = container.querySelector('iframe');
    if (!(iframe instanceof HTMLIFrameElement)) {
      throw new Error('expected the editor to mount for a relative documentURL');
    }
    expect(new URL(iframe.getAttribute('src') ?? '').origin).toBe('https://acme.simplepdf.com');
  });

  it('forwards editor events to onEmbedEvent verbatim (the established EmbedEvent contract)', async () => {
    const onEmbedEvent = vi.fn();
    const { container } = render(<EmbedPDF mode="inline" companyIdentifier="acme" onEmbedEvent={onEmbedEvent} />);
    const iframe = container.querySelector('iframe');
    if (!(iframe instanceof HTMLIFrameElement)) {
      throw new Error('expected an iframe under the host element');
    }
    window.dispatchEvent(
      new MessageEvent('message', {
        data: JSON.stringify({ type: 'DOCUMENT_LOADED', data: { document_id: 'doc123' } }),
        origin: 'https://acme.simplepdf.com',
        source: iframe.contentWindow,
      }),
    );
    await waitFor(() => {
      expect(onEmbedEvent).toHaveBeenCalledWith({ type: 'DOCUMENT_LOADED', data: { document_id: 'doc123' } });
    });
  });
});

describe('EmbedPDF (modal, default)', () => {
  it('opens on the trigger and closes on the close button (modal is the default mode)', async () => {
    const user = userEvent.setup();
    render(
      <EmbedPDF companyIdentifier="acme">
        <button type="button">Open editor</button>
      </EmbedPDF>,
    );
    expect(document.querySelector('iframe')).toBeNull();

    await user.click(screen.getByText('Open editor'));
    expect(document.querySelector('iframe')).not.toBeNull();

    await user.click(screen.getByLabelText('Close PDF editor modal'));
    expect(document.querySelector('iframe')).toBeNull();
  });

  it("falls back to the trigger's href as the document when no document prop is given", async () => {
    const user = userEvent.setup();
    render(
      <EmbedPDF companyIdentifier="acme">
        <a href="https://demo.simplepdf.com/documents/abc?prefill=p1">Open</a>
      </EmbedPDF>,
    );
    await user.click(screen.getByText('Open'));
    const iframe = document.querySelector('iframe');
    if (!(iframe instanceof HTMLIFrameElement)) {
      throw new Error('expected an iframe after opening the modal');
    }
    const src = new URL(iframe.getAttribute('src') ?? '');
    expect(src.origin).toBe('https://demo.simplepdf.com');
    expect(src.pathname).toBe('/documents/abc');
  });
});

describe('useEmbed', () => {
  it('actions resolve to a not-mounted Result before <EmbedPDF> mounts', async () => {
    const captured: { actions: EmbedActions }[] = [];
    const Probe = (): null => {
      const { actions } = useEmbed();
      captured.push({ actions });
      return null;
    };
    render(<Probe />);
    const first = captured[0];
    if (first === undefined) {
      throw new Error('expected useEmbed to have rendered');
    }
    const result = await first.actions.goTo({ page: 1 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('unexpected:iframe_not_mounted');
    }
  });
});

describe('useEmbed action backward-compat (deprecated arg shapes)', () => {
  // Mount <EmbedPDF ref={embedRef}>, capture the live handle + actions, and spy the
  // iframe's postMessage — so a test can assert the deprecated argument shapes are
  // normalized all the way to the wire, BOTH through the forwarded ref handle and
  // through useEmbed().actions (the ref must carry the overloads, not just actions).
  const mountAndCapture = async (): Promise<{
    embed: EmbedActions;
    actions: EmbedActions;
    posted: { type: string; data: unknown }[];
  }> => {
    const captured: { value: { embedRef: React.RefObject<EmbedActions | null>; actions: EmbedActions } | null } = {
      value: null,
    };
    const Harness = (): React.ReactElement => {
      const result = useEmbed();
      captured.value = { embedRef: result.embedRef, actions: result.actions };
      return <EmbedPDF ref={result.embedRef} mode="inline" companyIdentifier="acme" />;
    };
    const { container } = render(<Harness />);
    await waitFor(() => {
      expect(captured.value?.embedRef.current).not.toBeNull();
    });
    const c = captured.value;
    if (c === null) {
      throw new Error('expected useEmbed to render');
    }
    const embed = c.embedRef.current;
    if (embed === null) {
      throw new Error('expected the embed to mount');
    }
    // The handle no longer exposes the iframe; reach it via the rendered DOM to spy postMessage.
    const iframe = container.querySelector('iframe');
    if (!(iframe instanceof HTMLIFrameElement) || iframe.contentWindow === null) {
      throw new Error('expected the iframe contentWindow');
    }
    const posted: { type: string; data: unknown }[] = [];
    vi.spyOn(iframe.contentWindow, 'postMessage').mockImplementation((message: unknown) => {
      if (typeof message === 'string') {
        posted.push(JSON.parse(message));
      }
    });
    return { embed, actions: c.actions, posted };
  };

  it('selectTool accepts the deprecated positional tool — via the ref handle and via actions', async () => {
    const { embed, actions, posted } = await mountAndCapture();
    void embed.selectTool('TEXT'); // deprecated positional, through the forwarded ref handle
    void actions.selectTool(null); // deprecated positional deselect, through useEmbed().actions
    void actions.selectTool({ tool: 'COMB_TEXT' }); // new shape passes through unchanged
    const calls = posted.filter((message) => message.type === 'SELECT_TOOL').map((message) => message.data);
    expect(calls).toEqual([{ tool: 'TEXT' }, { tool: null }, { tool: 'COMB_TEXT' }]);
  });

  it('submit accepts the deprecated { downloadCopyOnDevice } — via the ref handle and via actions', async () => {
    const { embed, actions, posted } = await mountAndCapture();
    void embed.submit({ downloadCopyOnDevice: true }); // deprecated shape, through the ref handle
    void actions.submit({ downloadCopy: false }); // new shape, through actions
    // The wire is snake_case (downloadCopy -> download_copy), proving normalize + transform.
    const calls = posted.filter((message) => message.type === 'SUBMIT').map((message) => message.data);
    expect(calls).toEqual([{ download_copy: true }, { download_copy: false }]);
  });
});
