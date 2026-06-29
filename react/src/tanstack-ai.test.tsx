/// <reference types="@testing-library/jest-dom" />

import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { BridgeResult } from '@simplepdf/embed';
import { useEmbed } from './index';
import { useEmbedTanstackTools } from './tanstack-ai';

// useEmbed pulls in <EmbedPDF>, which imports scss (a build concern, irrelevant here).
vi.mock('./styles.scss', () => ({}));

describe('useEmbedTanstackTools', () => {
  it('returns TanStack client tools, each execute null-safe before <EmbedPDF> mounts', async () => {
    const captured: ReturnType<typeof useEmbedTanstackTools>[] = [];
    const Probe = (): null => {
      const { embedRef } = useEmbed();
      captured.push(useEmbedTanstackTools(embedRef));
      return null;
    };
    render(<Probe />);
    const tools = captured[0];
    if (tools === undefined) {
      throw new Error('expected useEmbedTanstackTools to have rendered');
    }
    const goTo = tools.find((tool) => tool.name === 'goTo');
    if (goTo === undefined || goTo.execute === undefined) {
      throw new Error('expected a goTo client tool with an execute');
    }
    const result: BridgeResult<unknown> = await goTo.execute({ page: 1 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('unexpected:iframe_not_mounted');
    }
  });
});
