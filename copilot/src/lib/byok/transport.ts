import { convertToModelMessages, streamText, type UIMessage } from 'ai'
import { buildSystemPrompt } from '../../server/tools'
import {
  DeleteFieldsInput,
  DeletePagesInput,
  DetectFieldsInput,
  FINALISATION_ACTION,
  FocusFieldInput,
  GetDocumentContentInput,
  GetFieldsInput,
  GoToPageInput,
  MovePageInput,
  RotatePageInput,
  SelectToolInput,
  SetFieldValueInput,
  withFinalisationTool,
} from '../embed-bridge-adapters/client-tools'
import { formatStreamError } from '../error-classifier'
import { monitoring, normalizeError } from '../monitoring'
import { buildBrowserModel } from './model'
import type { ByokConfig } from './providers'

const DEFAULT_SYSTEM_PROMPT = buildSystemPrompt({ action: FINALISATION_ACTION })

const MAX_OUTPUT_TOKENS = 500

const buildLanguageInstruction = (languageLabel: string): string =>
  `Language: reply in ${languageLabel}. If the form itself is in a different language, you may quote its original text verbatim but always explain and converse in ${languageLabel}.`

type BrowserChatBody = {
  messages: UIMessage[]
  language_label?: string
}

type RunByokStreamArgs = {
  config: ByokConfig
  init: RequestInit | undefined
}

export const runByokStream = async ({ config, init }: RunByokStreamArgs): Promise<Response> => {
  const rawBody = typeof init?.body === 'string' ? init.body : ''
  const parsed = ((): BrowserChatBody | null => {
    try {
      return JSON.parse(rawBody)
    } catch {
      return null
    }
  })()
  if (parsed === null || !Array.isArray(parsed.messages)) {
    return new Response(JSON.stringify({ error: 'bad_request' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })
  }
  const languageLabel =
    typeof parsed.language_label === 'string' && parsed.language_label.trim() !== ''
      ? parsed.language_label.trim()
      : 'English'

  const modelMessages = await convertToModelMessages(parsed.messages)
  // Default cached for the demo / no-customisation path; a custom prompt
  // changes per BYOK user so caching it would just churn the breakpoint.
  const systemContent =
    config.customInstructions === null
      ? DEFAULT_SYSTEM_PROMPT
      : buildSystemPrompt({
          action: FINALISATION_ACTION,
          customInstructions: config.customInstructions,
        })
  const cacheControl =
    config.customInstructions === null
      ? { anthropic: { cacheControl: { type: 'ephemeral' as const } } }
      : undefined
  monitoring.info('byok.system_prompt_built', {
    provider: config.provider,
    model: config.model,
    instructions_mode: config.customInstructions?.mode ?? null,
    instructions_length: config.customInstructions?.text.length ?? 0,
    system_prompt_length: systemContent.length,
  })
  const result = streamText({
    model: buildBrowserModel(config),
    messages: [
      { role: 'system', content: systemContent, providerOptions: cacheControl },
      { role: 'system', content: buildLanguageInstruction(languageLabel) },
      ...modelMessages,
    ],
    // useChat.stop() aborts the signal on `init`. forwarding it to
    // streamText is what makes the Stop button actually kill the inflight
    // provider request on the BYOK path. `RequestInit.signal` is typed as
    // `AbortSignal | null`; streamText wants `AbortSignal | undefined`, so
    // coalesce the null to undefined.
    abortSignal: init?.signal ?? undefined,
    maxRetries: 0,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    tools: withFinalisationTool({
      get_fields: {
        description: 'Lists every fillable field currently on the document.',
        inputSchema: GetFieldsInput,
      },
      get_document_content: {
        description: 'Extracts the textual content of the document page by page.',
        inputSchema: GetDocumentContentInput,
      },
      detect_fields: {
        description:
          'Asks the editor to auto-detect and create missing fields. Call this when get_fields returned 0 fields.',
        inputSchema: DetectFieldsInput,
      },
      delete_fields: {
        description:
          'Deletes fields from the document. field_ids targets specific fields by id; page targets a single page (1-indexed); both omitted clears all fields. Destructive — only call when the user explicitly asks to delete fields.',
        inputSchema: DeleteFieldsInput,
      },
      select_tool: {
        description:
          'Switches the editor tool (TEXT, BOXED_TEXT, CHECKBOX, SIGNATURE, PICTURE, or null for cursor).',
        inputSchema: SelectToolInput,
      },
      set_field_value: {
        description: 'Writes a value into a single field. Always focus_field first.',
        inputSchema: SetFieldValueInput,
      },
      focus_field: {
        description: 'Scrolls to and visually highlights a field.',
        inputSchema: FocusFieldInput,
      },
      go_to_page: {
        description: 'Scrolls the editor to a given 1-based page.',
        inputSchema: GoToPageInput,
      },
      move_page: {
        description:
          'Reorders pages: from_page and to_page are 1-indexed visible page positions. Destructive — only call when the user explicitly asks to reorder a page.',
        inputSchema: MovePageInput,
      },
      delete_pages: {
        description:
          'Permanently removes one or more visible pages (1-indexed) and any fields placed on them. Pass pages as a non-empty array. At least one visible page must remain — passing every visible page returns event_not_allowed. Destructive — only call when the user explicitly asks to delete pages.',
        inputSchema: DeletePagesInput,
      },
      rotate_page: {
        description:
          'Rotates a visible page (1-indexed) 90° clockwise per call (repeat for 180° / 270°). Destructive — only call when the user explicitly asks to rotate a page.',
        inputSchema: RotatePageInput,
      },
    }),
    onError: ({ error }) => {
      monitoring.error('byok.stream_error', { detail: normalizeError(error) })
    },
  })
  return result.toUIMessageStreamResponse({
    onError: formatStreamError,
  })
}
