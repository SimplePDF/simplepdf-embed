import { vi } from 'vitest'
import type { BridgeResult, Embed, IframeActions } from '../src/types'

const okResult: BridgeResult<unknown> = { success: true, data: null }

// A fully-stubbed actions group: every editor operation is a vi.fn resolving to a
// success Result. Shared by the tools + adapter tests.
export const makeActionsStub = (): IframeActions => {
  const method = (): Promise<BridgeResult<unknown>> => Promise.resolve(okResult)
  return {
    createField: vi.fn(method),
    deleteFields: vi.fn(method),
    deletePages: vi.fn(method),
    detectFields: vi.fn(method),
    download: vi.fn(method),
    focusField: vi.fn(method),
    getDocumentContent: vi.fn(method),
    getFields: vi.fn(method),
    goTo: vi.fn(method),
    loadDocument: vi.fn(method),
    movePage: vi.fn(method),
    rotatePage: vi.fn(method),
    selectTool: vi.fn(method),
    setFieldValue: vi.fn(method),
    submit: vi.fn(method),
  }
}

// A minimal Embed handle wrapping stubbed actions (events + lifecycle are no-ops);
// enough for adapters that only dispatch through embed.actions.
export const makeEmbedStub = (): Embed => ({
  actions: makeActionsStub(),
  events: { on: () => () => {} },
  lifecycle: { dispose: () => {} },
})
