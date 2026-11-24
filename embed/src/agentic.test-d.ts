// Type-stability assertions for the agentic adapters. No runtime: this file is picked up
// by `test:types` (tsc --noEmit includes `src`) but NOT by the build (explicit tsup entries)
// nor the vitest runner (which globs `*.test.ts`, not `*.test-d.ts`). A change to a public
// agentic type fails CI here, forcing a deliberate review.
import { expectTypeOf } from 'vitest'
import type { AnyClientTool } from '@tanstack/ai'
import { createSimplePDFTools, simplePDFToolDefinitions, type SimplePDFToolName } from './tanstack-ai'

// `loadDocument` is not part of the agentic tool set (it is excluded from TOOL_DEFINITIONS).
expectTypeOf<SimplePDFToolName>().not.toEqualTypeOf<SimplePDFToolName | 'loadDocument'>()

// Server definitions stay name-strict: each element's `name` is the literal union, not `string`.
expectTypeOf<ReturnType<typeof simplePDFToolDefinitions>[number]['name']>().toEqualTypeOf<SimplePDFToolName>()

// Browser tools are the documented `AnyClientTool[]`, passed straight to useChat({ tools }).
expectTypeOf<ReturnType<typeof createSimplePDFTools>>().toEqualTypeOf<AnyClientTool[]>()

// Provider-compatible JSON must retain the canonical discriminated input in TypeScript.
import type { z } from 'zod'
import { SIMPLEPDF_TOOLS } from './tools'
import type { BuildPdfInput } from './types'
type AdvertisedBuildInput = z.infer<typeof SIMPLEPDF_TOOLS.buildPdf.inputSchema>
expectTypeOf<AdvertisedBuildInput>().toExtend<BuildPdfInput>()
expectTypeOf<{ action: 'build' }>().not.toExtend<AdvertisedBuildInput>()
expectTypeOf<Extract<AdvertisedBuildInput, { action: 'build' }>['code']>().toEqualTypeOf<string>()
