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

// Browser tools are the documented `AnyClientTool[]` (the clientTools-ready shape).
expectTypeOf<ReturnType<typeof createSimplePDFTools>>().toEqualTypeOf<AnyClientTool[]>()
