// Root entry: the zero-runtime-dependency mount path + bridge + error model.
// Action methods are typed; zod (and @tanstack/ai) live only in the /schemas,
// /tools, /ai-sdk, and /tanstack-ai subpaths. The React layer lives in @simplepdf/react-embed-pdf.

export { createEmbed, EmbedConfigError } from './mount'
export type { CreateEmbedArgs, EmbedDocument } from './mount'
export { NOOP_LOGGER } from './logger'
export type { BridgeLogger, LogPayload } from './logger'
export { BridgeUnwrapError, unwrap } from './unwrap'
export type * from './types'
