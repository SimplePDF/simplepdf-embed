// Type-stability assertions for the React agentic adapters. No runtime: checked by
// `test:types` (tsc), ignored by the build (explicit rollup inputs) and the vitest runner
// (`*.test.{ts,tsx}` glob). Locks the Vercel-vs-TanStack shape convention and the
// cross-package tool-name type.
import { expectTypeOf } from 'vitest';
import type { AnyClientTool } from '@tanstack/ai';
import type { SimplePDFToolName as CoreToolName } from '@simplepdf/embed/tanstack-ai';
import { useEmbedTools as useVercelTools, type EmbedTools } from './ai-sdk';
import { useEmbedTools as useTanstackTools, type SimplePDFToolName as ReactToolName } from './tanstack-ai';

// Same hook name, intentionally different shape (the import path picks the SDK):
// Vercel yields the AI-SDK `EmbedTools` record; TanStack yields the client-tool array.
expectTypeOf<ReturnType<typeof useVercelTools>>().toEqualTypeOf<EmbedTools>();
expectTypeOf<ReturnType<typeof useTanstackTools>>().toEqualTypeOf<AnyClientTool[]>();

// The re-exported tool-name type must not drift from the embed core's.
expectTypeOf<ReactToolName>().toEqualTypeOf<CoreToolName>();
