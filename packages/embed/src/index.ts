// Root entry: the zero-runtime-dependency mount path + bridge + error model.
// Action methods are typed; zod/ai/react live only in the /schemas, /tools,
// /ai-sdk, and /react subpaths.

export { createEmbed } from './bridge'
export type { CreateEmbedArgs } from './bridge'
export { buildEditorDomain, EmbedConfigError, encodeContext, mountEmbed } from './mount'
export { NOOP_LOGGER } from './logger'
export type { BridgeLogger, LogPayload } from './logger'
export { isBridgeResultLike } from './result'
export type * from './types'
