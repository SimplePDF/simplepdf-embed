// Root entry: the zero-runtime-dependency mount path + bridge + error model.
// Action methods are typed; zod/ai live only in the /schemas, /tools, and
// /ai-sdk subpaths. The React layer lives in @simplepdf/react-embed-pdf.

export { buildEditorDomain, createEmbed, EmbedConfigError, encodeContext } from './mount'
export type { CreateEmbedArgs, EmbedDocument } from './mount'
export { NOOP_LOGGER } from './logger'
export type { BridgeLogger, LogPayload } from './logger'
export { isBridgeResultLike } from './result'
export { BridgeUnwrapError, unwrap } from './unwrap'
export type * from './types'
