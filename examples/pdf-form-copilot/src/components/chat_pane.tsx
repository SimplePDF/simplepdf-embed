import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls, type UIMessage } from 'ai'
import ReactMarkdown from 'react-markdown'
import { useTranslation } from 'react-i18next'
import type { BridgeResult, IframeBridge } from '../lib/iframe_bridge'
import { isClientToolName, type ClientToolName } from '../server/tools'
import { getLanguageByCode } from '../lib/languages'
import { LanguagePicker } from './language_picker'
import { ModelPickerModal } from './model_picker_modal'
import { SuggestedPrompts } from './suggested_prompts'
import { ThinkingIndicator } from './thinking_indicator'
import { ToolInvocationGroup, type ToolInvocationPart } from './tool_invocation_group'
import { Toolbar, type ToolbarTool } from './toolbar'

type ChatPaneProps = {
  bridge: IframeBridge | null
  isReady: boolean
  requiresUserUpload: boolean
  language: string
  onLanguageChange: (code: string) => void
  showToolDetails: boolean
}

type ToolInput = Record<string, unknown>

const MAX_CONTENT_CHARS_PER_PAGE = 1200
const MAX_CONTENT_PAGES = 1
const SUMMARIZE_THRESHOLD_CHARS = 1500

const compactGetFields = (result: BridgeResult<unknown>): BridgeResult<unknown> => {
  if (!result.success) {
    return result
  }
  const data = result.data as { fields?: Array<{ field_id: string; name: string | null; type: string; page: number; value: string | null }> }
  if (!Array.isArray(data.fields)) {
    return result
  }
  const compacted = data.fields.map((field) => {
    const entry: Record<string, unknown> = {
      id: field.field_id,
      type: field.type,
      page: field.page,
    }
    if (field.value !== null && field.value !== '') {
      entry.value = field.value
    }
    if (field.name !== null && field.name !== '' && field.name !== field.field_id) {
      entry.name = field.name
    }
    return entry
  })
  return { success: true, data: { fields: compacted } }
}

const truncatePages = (
  pages: Array<{ page: number; content: string }>,
): Array<{ page: number; content: string }> => {
  const kept = pages.slice(0, MAX_CONTENT_PAGES).map((page) => ({
    page: page.page,
    content:
      page.content.length > MAX_CONTENT_CHARS_PER_PAGE
        ? `${page.content.slice(0, MAX_CONTENT_CHARS_PER_PAGE)}… [truncated]`
        : page.content,
  }))
  if (pages.length > MAX_CONTENT_PAGES) {
    kept.push({
      page: -1,
      content: `[${pages.length - MAX_CONTENT_PAGES} more page(s) omitted to stay within token budget]`,
    })
  }
  return kept
}

const summaryCache = new Map<string, string>()

const compactGetDocumentContent = async (
  result: BridgeResult<unknown>,
  languageLabel: string,
  useSummarizer: boolean,
): Promise<BridgeResult<unknown>> => {
  if (!result.success) {
    return result
  }
  const data = result.data as { name?: string; pages?: Array<{ page: number; content: string }> }
  if (!Array.isArray(data.pages)) {
    return result
  }

  const totalChars = data.pages.reduce((sum, page) => sum + page.content.length, 0)
  if (!useSummarizer || totalChars < SUMMARIZE_THRESHOLD_CHARS) {
    return { success: true, data: { name: data.name ?? null, pages: truncatePages(data.pages) } }
  }

  const cacheKey = `${languageLabel}::${data.name ?? 'unknown'}::${totalChars}`
  const cached = summaryCache.get(cacheKey)
  if (cached !== undefined) {
    return { success: true, data: { name: data.name ?? null, summary: cached } }
  }

  try {
    const response = await fetch('/api/summarize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: data.name ?? null,
        pages: data.pages,
        language_label: languageLabel,
      }),
    })
    if (!response.ok) {
      throw new Error(`summarize_failed:${response.status}`)
    }
    const payload = (await response.json()) as { summary?: unknown }
    if (typeof payload.summary !== 'string' || payload.summary === '') {
      throw new Error('summarize_missing_summary')
    }
    summaryCache.set(cacheKey, payload.summary)
    return {
      success: true,
      data: { name: data.name ?? null, summary: payload.summary },
    }
  } catch {
    return { success: true, data: { name: data.name ?? null, pages: truncatePages(data.pages) } }
  }
}

type DispatchContext = {
  languageLabel: string
  useSummarizer: boolean
  onToolbarChange: (tool: ToolbarTool) => void
}

const isToolbarTool = (value: unknown): value is ToolbarTool =>
  value === null ||
  value === 'TEXT' ||
  value === 'CHECKBOX' ||
  value === 'SIGNATURE' ||
  value === 'PICTURE'

const dispatchTool = async (
  bridge: IframeBridge,
  context: DispatchContext,
  toolName: ClientToolName,
  input: ToolInput,
): Promise<BridgeResult<unknown>> => {
  switch (toolName) {
    case 'get_fields':
      return compactGetFields(await bridge.getFields())
    case 'get_document_content': {
      const extraction = input.extraction_mode === 'ocr' ? 'ocr' : 'auto'
      return compactGetDocumentContent(
        await bridge.getDocumentContent({ extractionMode: extraction }),
        context.languageLabel,
        context.useSummarizer,
      )
    }
    case 'detect_fields':
      return bridge.detectFields()
    case 'select_tool': {
      const rawTool = input.tool
      if (rawTool !== undefined && rawTool !== null && !isToolbarTool(rawTool)) {
        return { success: false, error: { code: 'bad_input', message: `Unsupported tool: ${String(rawTool)}` } }
      }
      const toolbarTool: ToolbarTool = rawTool === undefined ? null : (rawTool as ToolbarTool)
      const result = await bridge.selectTool({ tool: toolbarTool })
      if (result.success) {
        context.onToolbarChange(toolbarTool)
      }
      return result
    }
    case 'set_field_value': {
      const fieldId = typeof input.field_id === 'string' ? input.field_id : null
      const value = typeof input.value === 'string' ? input.value : null
      if (fieldId === null) {
        return { success: false, error: { code: 'bad_input', message: 'field_id is required' } }
      }
      return bridge.setFieldValue({ fieldId, value })
    }
    case 'focus_field': {
      const fieldId = typeof input.field_id === 'string' ? input.field_id : null
      if (fieldId === null) {
        return { success: false, error: { code: 'bad_input', message: 'field_id is required' } }
      }
      return bridge.focusField({ fieldId })
    }
    case 'go_to_page': {
      const page = typeof input.page === 'number' ? input.page : null
      if (page === null) {
        return { success: false, error: { code: 'bad_input', message: 'page must be a number' } }
      }
      return bridge.goTo({ page })
    }
    case 'submit_download':
      return bridge.submit({ downloadCopy: true })
    default:
      toolName satisfies never
      return { success: false, error: { code: 'unknown_tool', message: `Unknown tool: ${String(toolName)}` } }
  }
}

export const ChatPane = ({
  bridge,
  isReady,
  requiresUserUpload,
  language,
  onLanguageChange,
  showToolDetails,
}: ChatPaneProps) => {
  const { t } = useTranslation()
  const [draft, setDraft] = useState('')
  const [toolbarTool, setToolbarTool] = useState<ToolbarTool>(null)
  const bridgeRef = useRef(bridge)
  bridgeRef.current = bridge
  const languageRef = useRef(language)
  languageRef.current = language
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fieldBaselineRef = useRef<number | null>(null)
  const [isModelPickerOpen, setIsModelPickerOpen] = useState(false)

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        body: () => {
          const language = getLanguageByCode(languageRef.current)
          return { language_label: language !== null ? language.label : 'English' }
        },
      }),
    [],
  )

  const { messages, status, error, sendMessage, stop, addToolOutput } = useChat({
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onError: (err) => {
      console.error('[copilot] chat error', err)
    },
    onToolCall: ({ toolCall }) => {
      if (toolCall.dynamic) {
        return
      }
      const toolName = toolCall.toolName
      if (!isClientToolName(toolName)) {
        addToolOutput({
          tool: toolName,
          toolCallId: toolCall.toolCallId,
          state: 'output-error',
          errorText: `Unknown tool: ${toolName}`,
        })
        return
      }
      const activeBridge = bridgeRef.current
      if (activeBridge === null) {
        addToolOutput({
          tool: toolName,
          toolCallId: toolCall.toolCallId,
          state: 'output-error',
          errorText: 'Iframe bridge is not ready yet',
        })
        return
      }
      const languageLabel = getLanguageByCode(languageRef.current)?.label ?? 'English'
      const startedAt = performance.now()
      const callInput = (toolCall.input as ToolInput) ?? {}
      console.info('[copilot] tool call', toolName, callInput)
      void dispatchTool(
        activeBridge,
        { languageLabel, useSummarizer: false, onToolbarChange: setToolbarTool },
        toolName,
        callInput,
      ).then((result) => {
        const elapsedMs = Math.round(performance.now() - startedAt)
        if (result.success) {
          console.info(`[copilot] tool done ${toolName} ${elapsedMs}ms`, result.data)
        } else {
          console.warn(`[copilot] tool failed ${toolName} ${elapsedMs}ms`, { input: callInput, error: result.error })
        }
        addToolOutput({
          tool: toolName,
          toolCallId: toolCall.toolCallId,
          output: result,
        })
      })
    },
  })

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const turnStartAtRef = useRef<number | null>(null)
  const firstTokenLoggedRef = useRef(false)
  useEffect(() => {
    if (status === 'submitted') {
      turnStartAtRef.current = performance.now()
      firstTokenLoggedRef.current = false
      console.info('[copilot] turn start')
      return
    }
    if (status === 'streaming' && !firstTokenLoggedRef.current && turnStartAtRef.current !== null) {
      const elapsed = Math.round(performance.now() - turnStartAtRef.current)
      console.info(`[copilot] first-token ${elapsed}ms`)
      firstTokenLoggedRef.current = true
      return
    }
    if (status === 'ready' && turnStartAtRef.current !== null) {
      const elapsed = Math.round(performance.now() - turnStartAtRef.current)
      console.info(`[copilot] turn done ${elapsed}ms`)
      turnStartAtRef.current = null
    }
  }, [status])

  const handleToolbarSelect = useCallback(
    (tool: ToolbarTool): void => {
      setToolbarTool(tool)
      const activeBridge = bridgeRef.current
      if (activeBridge === null) {
        return
      }
      void activeBridge.selectTool({ tool })
    },
    [],
  )

  useEffect(() => {
    if (toolbarTool === null || bridge === null || !isReady) {
      fieldBaselineRef.current = null
      return
    }
    let cancelled = false
    const interval = setInterval(async () => {
      const activeBridge = bridgeRef.current
      if (activeBridge === null) {
        return
      }
      const result = await activeBridge.getFields()
      if (cancelled || !result.success) {
        return
      }
      const count = result.data.fields.length
      if (fieldBaselineRef.current === null) {
        fieldBaselineRef.current = count
        return
      }
      if (count > fieldBaselineRef.current) {
        const delta = count - fieldBaselineRef.current
        fieldBaselineRef.current = count
        void sendMessage({
          text:
            delta === 1
              ? 'A new field was just added to the document. Please continue helping me with it.'
              : `${delta} new fields were just added to the document. Please continue helping me with them.`,
        })
      }
    }, 500)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [toolbarTool, bridge, isReady, sendMessage])

  const isStreaming = status === 'streaming' || status === 'submitted'
  const canSend = isReady && !isStreaming

  useEffect(() => {
    if (canSend) {
      inputRef.current?.focus()
    }
  }, [canSend])

  const handleSend = useCallback(
    (prompt: string): void => {
      const trimmed = prompt.trim()
      if (trimmed === '') {
        return
      }
      void sendMessage({ text: trimmed })
      setDraft('')
    },
    [sendMessage],
  )

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <div>
          {isReady ? (
            <>
              <h2 className="text-sm font-semibold text-slate-900">{t('chat.modelNameReady')}</h2>
              <button
                type="button"
                onClick={() => setIsModelPickerOpen(true)}
                className="text-xs font-medium text-sky-600 hover:text-sky-700"
              >
                {t('chat.switchModel')}
              </button>
            </>
          ) : (
            <>
              <h2 className="text-sm font-semibold text-slate-900">{t('chat.heading')}</h2>
              <p className="text-xs text-slate-500">
                {requiresUserUpload ? t('chat.subtitleNoDocument') : t('chat.subtitleWaiting')}
              </p>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <LanguagePicker value={language} onChange={onLanguageChange} disabled={isStreaming} />
          {isStreaming ? (
            <button
              type="button"
              onClick={stop}
              className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
            >
              {t('chat.stop')}
            </button>
          ) : null}
        </div>
      </div>
      <Toolbar selected={toolbarTool} onSelect={handleToolbarSelect} disabled={!isReady} />
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <SuggestedPrompts onSelect={handleSend} disabled={!canSend} />
        ) : (
          <div className="space-y-4 p-4">
            {messages.map((message) => (
              <MessageView key={message.id} message={message} showToolDetails={showToolDetails} />
            ))}
            {isStreaming ? <ThinkingIndicator /> : null}
            {error !== undefined ? (
              <ErrorBanner error={error} messages={messages} showDetails={showToolDetails} />
            ) : null}
          </div>
        )}
      </div>
      <div className="border-t border-slate-200 p-3">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            handleSend(draft)
          }}
          className="flex gap-2"
        >
          <input
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={!canSend}
            placeholder={canSend ? t('chat.inputPlaceholderReady') : t('chat.inputPlaceholderWaiting')}
            className="flex-1 rounded-md border border-solid border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-sky-600 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
            style={{ borderWidth: '1px' }}
          />
          <button
            type="submit"
            disabled={!canSend || draft.trim() === ''}
            className="rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {t('chat.send')}
          </button>
        </form>
      </div>
      <ModelPickerModal open={isModelPickerOpen} onClose={() => setIsModelPickerOpen(false)} />
    </div>
  )
}

type MessageViewProps = {
  message: UIMessage
  showToolDetails: boolean
}

type ErrorBannerProps = {
  error: Error
  messages: UIMessage[]
  showDetails: boolean
}

const findLastAttemptedToolName = (messages: UIMessage[]): string | null => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]
    if (message.role !== 'assistant') {
      continue
    }
    for (let j = message.parts.length - 1; j >= 0; j -= 1) {
      const part = message.parts[j]
      if (part.type.startsWith('tool-')) {
        return part.type.slice('tool-'.length)
      }
    }
  }
  return null
}

const ErrorBanner = ({ error, messages, showDetails }: ErrorBannerProps) => {
  const { t } = useTranslation()
  const body = (() => {
    if (showDetails) {
      return <div className="mt-1 break-all">{error.message}</div>
    }
    const toolName = findLastAttemptedToolName(messages)
    if (toolName !== null) {
      const actionLabel = t(`toolInvocation.names.${toolName}`, {
        defaultValue: t('toolInvocation.fallbackName', { tool: toolName }),
      }).toLowerCase()
      return <div className="mt-1">{t('chat.errorFriendlyWithAction', { action: actionLabel })}</div>
    }
    return <div className="mt-1">{t('chat.errorFriendlyGeneric')}</div>
  })()
  return (
    <div className="rounded border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
      <div className="font-medium">{t('chat.errorTitle')}</div>
      {body}
    </div>
  )
}

type RenderBlock =
  | { kind: 'text'; key: string; text: string }
  | { kind: 'tool-group'; key: string; parts: ToolInvocationPart[] }

const toBlocks = (message: UIMessage): RenderBlock[] => {
  const blocks: RenderBlock[] = []
  message.parts.forEach((part, index) => {
    const key = `${message.id}_${index}`
    if (part.type === 'text') {
      blocks.push({ kind: 'text', key, text: part.text })
      return
    }
    if (part.type.startsWith('tool-')) {
      const toolPart = part as {
        type: `tool-${string}`
        toolCallId: string
        state: ToolInvocationPart['state']
        input?: unknown
        output?: unknown
        errorText?: string
      }
      const toolName = toolPart.type.slice('tool-'.length)
      const entry: ToolInvocationPart = {
        key,
        toolName,
        state: toolPart.state,
        input: toolPart.input,
        output: toolPart.output,
        errorText: toolPart.errorText,
      }
      const last = blocks[blocks.length - 1]
      if (last !== undefined && last.kind === 'tool-group') {
        last.parts.push(entry)
        return
      }
      blocks.push({ kind: 'tool-group', key, parts: [entry] })
    }
  })
  return blocks
}

const MessageView = ({ message, showToolDetails }: MessageViewProps) => {
  const isUser = message.role === 'user'
  const blocks = toBlocks(message)
  return (
    <div className={isUser ? 'flex justify-end' : 'flex justify-start'}>
      <div
        className={`rounded-lg px-3 py-2 text-sm leading-relaxed ${
          isUser
            ? 'max-w-[85%] bg-sky-600 text-white'
            : 'min-w-[296px] max-w-full bg-slate-100 text-slate-900'
        }`}
      >
        {blocks.map((block) => {
          if (block.kind === 'text') {
            return (
              <div key={block.key} className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0">
                <ReactMarkdown
                  components={{
                    strong: ({ children }) => (
                      <strong className={isUser ? 'font-semibold' : 'font-semibold text-sky-700'}>
                        {children}
                      </strong>
                    ),
                  }}
                >
                  {block.text}
                </ReactMarkdown>
              </div>
            )
          }
          return <ToolInvocationGroup key={block.key} parts={block.parts} showDetails={showToolDetails} />
        })}
      </div>
    </div>
  )
}
