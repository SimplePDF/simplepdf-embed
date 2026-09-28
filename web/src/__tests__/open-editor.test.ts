// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// The script tag passes untyped values: whatever a page puts in the attributes or in setConfig
// must either open the editor or refuse with a console error, never throw on the page.
describe('openEditor with untyped configuration', () => {
  beforeAll(async () => {
    await import('../index');
  });

  afterEach(() => {
    window.simplePDF?.closeEditor();
    window.simplePDF?.setConfig({ companyIdentifier: 'embed' });
    vi.restoreAllMocks();
  });

  const openAndSettle = async (): Promise<void> => {
    window.simplePDF?.openEditor({ href: null });
    await new Promise((resolve) => setTimeout(resolve, 0));
  };

  const readEditorOrigin = (): string | null => {
    const source = document.getElementById('simplePDF_iframe')?.getAttribute('src');
    return source === undefined || source === null ? null : new URL(source).origin;
  };

  it('treats a null baseDomain as absent and opens the production editor', async () => {
    Object.assign(window.simplePDF?.config ?? {}, { baseDomain: null });

    await expect(openAndSettle()).resolves.toBeUndefined();

    expect(readEditorOrigin()).toBe('https://embed.simplepdf.com');
    Object.assign(window.simplePDF?.config ?? {}, { baseDomain: undefined });
  });

  it.each([
    ['simplepdf.com:00443', 'https://embed.simplepdf.com'],
    ['SIMPLEPDF.COM:08443', 'https://embed.simplepdf.com:8443'],
  ])('accepts the editor messages when baseDomain is %s', async (baseDomain, editorOrigin) => {
    const registeredTools: string[] = [];
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: {
        registerTool: (tool: { name: string }) => {
          registeredTools.push(tool.name);
        },
      },
    });
    window.simplePDF?.setConfig({ baseDomain });

    await openAndSettle();
    const iframe = document.getElementById('simplePDF_iframe');
    if (!(iframe instanceof HTMLIFrameElement)) {
      throw new Error('The editor iframe was not created');
    }
    window.dispatchEvent(
      new MessageEvent('message', {
        data: JSON.stringify({ type: 'EDITOR_READY', data: {} }),
        origin: editorOrigin,
        source: iframe.contentWindow,
      }),
    );

    await vi.waitFor(() => expect(registeredTools).toContain('simplepdf_embed_get_fields'));
    Object.assign(window.simplePDF?.config ?? {}, { baseDomain: undefined });
  });

  it.each(['simplepdf.com@evil.example', 'evil.example/x', '-.com', 'simplepdf', 42])(
    'refuses the baseDomain %s with a console error and opens nothing',
    async (baseDomain) => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      Object.assign(window.simplePDF?.config ?? {}, { baseDomain });

      await openAndSettle();

      expect(document.getElementById('simplePDF_modal')).toBeNull();
      expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('is not a domain name'));
      Object.assign(window.simplePDF?.config ?? {}, { baseDomain: undefined });
    },
  );

  it('reports a companyIdentifier that is not a string and closes the modal instead of throwing', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    Object.assign(window.simplePDF?.config ?? {}, { companyIdentifier: 123 });

    await expect(openAndSettle()).resolves.toBeUndefined();

    expect(document.getElementById('simplePDF_modal')).toBeNull();
    expect(consoleError).toHaveBeenCalledWith('@simplepdf/web-embed-pdf: the editor could not open', expect.anything());
  });
});
