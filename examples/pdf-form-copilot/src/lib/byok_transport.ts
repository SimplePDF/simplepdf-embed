import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { convertToModelMessages, streamText, type UIMessage } from 'ai'
import type { ByokConfig } from './byok'
import { formatStreamError } from './error_classifier'
import {
  DetectFieldsInput,
  FocusFieldInput,
  GetDocumentContentInput,
  GetFieldsInput,
  GoToPageInput,
  SelectToolInput,
  SetFieldValueInput,
  SubmitDownloadInput,
  SYSTEM_PROMPT,
} from '../server/tools'

const MAX_OUTPUT_TOKENS = 500

const buildLanguageInstruction = (languageLabel: string): string =>
  `Language: reply in ${languageLabel}. If the form itself is in a different language, you may quote its original text verbatim but always explain and converse in ${languageLabel}.`

const buildModel = (config: ByokConfig) => {
  switch (config.provider) {
    case 'anthropic': {
      const anthropic = createAnthropic({
        apiKey: config.apiKey,
        // Required flag to allow API calls from the browser; SimplePDF never
        // sees this key, it lives only in tab memory.
        headers: { 'anthropic-dangerous-direct-browser-access': 'true' },
      })
      return anthropic(config.model)
    }
    case 'openai': {
      const openai = createOpenAI({ apiKey: config.apiKey })
      return openai(config.model)
    }
    default:
      config.provider satisfies never
      throw new Error(`Unsupported BYOK provider: ${String(config.provider)}`)
  }
}

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
  const result = streamText({
    model: buildModel(config),
    messages: [
      {
        role: 'system',
        content: SYSTEM_PROMPT,
        providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
      },
      { role: 'system', content: buildLanguageInstruction(languageLabel) },
      ...modelMessages,
    ],
    maxRetries: 0,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    tools: {
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
      select_tool: {
        description:
          'Switches the editor tool (TEXT, CHECKBOX, SIGNATURE, PICTURE, or null for cursor).',
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
      submit_download: {
        description: 'Finalizes the filled PDF and triggers a download.',
        inputSchema: SubmitDownloadInput,
      },
    },
    onError: ({ error }) => {
      console.error('[copilot] BYOK streamText error', error)
    },
  })
  return result.toUIMessageStreamResponse({
    onError: formatStreamError,
  })
}

