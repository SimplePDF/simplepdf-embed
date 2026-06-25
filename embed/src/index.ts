// Root entry: the zero-runtime-dependency mount path + bridge + error model.
// Action methods are typed; zod/ai/react live only in the /schemas, /tools,
// /ai-sdk, and /react subpaths.

export { buildEditorDomain, createEmbed, EmbedConfigError, encodeContext } from './mount'
export type { CreateEmbedArgs } from './mount'
export { NOOP_LOGGER } from './logger'
export type { BridgeLogger, LogPayload } from './logger'
export { isBridgeResultLike } from './result'
export { BridgeUnwrapError, unwrap } from './unwrap'
export type * from './types'
