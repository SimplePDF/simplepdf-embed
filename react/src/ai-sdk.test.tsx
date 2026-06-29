/// <reference types="@testing-library/jest-dom" />

import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { useEmbed } from './index';
import { useEmbedTools, type EmbedTools } from './ai-sdk';

// useEmbed pulls in <EmbedPDF>, which imports scss (a build concern, irrelevant here).
vi.mock('./styles.scss', () => ({}));

describe('useEmbedTools', () => {
  it('exposes the agentic registry, each tool execute null-safe before <EmbedPDF> mounts', async () => {
    const captured: EmbedTools[] = [];
    const Probe = (): null => {
      const { embedRef } = useEmbed();
      captured.push(useEmbedTools(embedRef));
      return null;
    };
    render(<Probe />);
    const tools = captured[0];
    if (tools === undefined) {
      throw new Error('expected useEmbedTools to have rendered');
    }
    // The agentic registry is present, each entry an AI-SDK-ready tool.
    expect(typeof tools.goTo?.description).toBe('string');
    expect(tools.goTo?.inputSchema).toBeDefined();
    const result = await tools.goTo.execute({ page: 1 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('unexpected:iframe_not_mounted');
    }
  });
});
