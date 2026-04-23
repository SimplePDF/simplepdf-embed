import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls, type UIMessage } from 'ai'
import ReactMarkdown from 'react-markdown'
import { Trans, useTranslation } from 'react-i18next'
import { getRouteApi } from '@tanstack/react-router'
import type { BridgeResult, IframeBridge } from '../lib/iframe_bridge'
import { isClientToolName, type ClientToolName } from '../server/tools'
import { getLanguageByCode } from '../lib/languages'
import { findProvider, type ByokConfig } from '../lib/byok'
import { runByokStream } from '../lib/byok_transport'
import { classifyError, getErrorDisplayMessage } from '../lib/error_classifier'
import { LanguagePicker } from './language_picker'
import { ModelPickerModal } from './model_picker_modal'
import { SuggestedPrompts } from './suggested_prompts'
import { ThinkingIndicator } from './thinking_indicator'
import { ToolInvocationGroup, type ToolInvocationPart } from './tool_invocation_group'
import { ToolIcon } from './tool_icons'
import { Toolbar, type ToolbarTool } from './toolbar'

const homeRoute = getRouteApi('/')

type ChatPaneProps = {
  bridge: IframeBridge | null
  isReady: boolean
  requiresUserUpload: boolean
  language: string
  onLanguageChange: (code: string) => void
  documentId: string | null
}

// In-memory chat store keyed by document_id. Survives component remounts
// (e.g. form switches that tear down the ChatPane) but intentionally resets
// on page reload — we don't want chat transcripts persisted to disk.
const chatHistoryStore = new Map<string, UIMessage[]>()

const readPersistedMessages = (documentId: string | null): UIMessage[] => {
  if (documentId === null) {
    return []
  }
  return chatHistoryStore.get(documentId) ?? []
}

const writePersistedMessages = (documentId: string | null, messages: UIMessage[]): void => {
  if (documentId === null) {
    return
  }
  chatHistoryStore.set(documentId, messages)
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
  onOpenSubmitModal: () => void
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
      context.onOpenSubmitModal()
      return { success: true, data: { status: 'demo_submission_acknowledged' } }
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
  documentId,
}: ChatPaneProps) => {
  const { t } = useTranslation()
  const navigate = homeRoute.useNavigate()
  const search = homeRoute.useSearch()
  const isModelPickerOpen = search.show === 'model'
  const [draft, setDraft] = useState('')
  const [toolbarTool, setToolbarTool] = useState<ToolbarTool>(null)
  const bridgeRef = useRef(bridge)
  bridgeRef.current = bridge
  const languageRef = useRef(language)
  languageRef.current = language
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fieldBaselineRef = useRef<number | null>(null)
  const [byokConfig, setByokConfig] = useState<ByokConfig | null>(null)
  const byokConfigRef = useRef<ByokConfig | null>(byokConfig)
  byokConfigRef.current = byokConfig
  const [hasFilledField, setHasFilledField] = useState(false)

  const openModelPicker = useCallback((): void => {
    void navigate({
      search: (prev) => ({ ...prev, show: 'model' }),
    })
  }, [navigate])

  const closeModelPicker = useCallback((): void => {
    void navigate({
      search: ({ show: _omit, ...rest }) => rest,
    })
  }, [navigate])

  const openSubmitModal = useCallback((): void => {
    void navigate({
      search: (prev) => ({ ...prev, show: 'submit' }),
    })
  }, [navigate])

  const transport = useMemo(() => {
    const bodyFn = () => {
      const languageEntry = getLanguageByCode(languageRef.current)
      return { language_label: languageEntry !== null ? languageEntry.label : 'English' }
    }
    // Single stable transport. Routes per-request based on the current BYOK
    // config (read from a ref), so flipping BYOK on/off takes effect
    // immediately without re-creating the Chat instance.
    return new DefaultChatTransport({
      api: '/api/chat',
      body: bodyFn,
      fetch: (async (input: unknown, init: RequestInit | undefined) => {
        const activeConfig = byokConfigRef.current
        if (activeConfig !== null) {
          return runByokStream({ config: activeConfig, init })
        }
        return window.fetch(input as RequestInfo, init)
      }) as typeof fetch,
    })
  }, [])

  const [initialMessages] = useState<UIMessage[]>(() => readPersistedMessages(documentId))
  const hydratedDocumentIdRef = useRef<string | null>(documentId)

  const { messages, status, error, sendMessage, stop, addToolOutput, setMessages } = useChat({
    transport,
    messages: initialMessages,
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
        { languageLabel, useSummarizer: false, onToolbarChange: setToolbarTool, onOpenSubmitModal: openSubmitModal },
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
  const hasUserMessage = messages.some((message) => message.role === 'user')

  useEffect(() => {
    if (canSend) {
      inputRef.current?.focus()
    }
  }, [canSend])

  useEffect(() => {
    if (hydratedDocumentIdRef.current === documentId) {
      return
    }
    hydratedDocumentIdRef.current = documentId
    setMessages(readPersistedMessages(documentId))
  }, [documentId, setMessages])

  useEffect(() => {
    writePersistedMessages(documentId, messages)
  }, [documentId, messages])

  useEffect(() => {
    if (bridge === null || !isReady) {
      setHasFilledField(false)
      return
    }
    let cancelled = false
    const check = async (): Promise<void> => {
      const result = await bridge.getFields()
      if (cancelled || !result.success) {
        return
      }
      const next = result.data.fields.some((field) => field.value !== null && field.value !== '')
      setHasFilledField((prev) => (prev === next ? prev : next))
    }
    void check()
    const interval = setInterval(check, 1500)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [bridge, isReady])

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
              <h2 className="text-sm font-semibold text-slate-900">
                {byokConfig === null
                  ? t('chat.modelNameReady')
                  : findProvider(byokConfig.provider).models.find((m) => m.id === byokConfig.model)?.label ??
                    byokConfig.model}
              </h2>
              <button
                type="button"
                onClick={openModelPicker}
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
      <Toolbar
        selected={toolbarTool}
        onSelect={handleToolbarSelect}
        disabled={!isReady}
        submitEnabled={hasFilledField}
        onSubmit={openSubmitModal}
      />
      <PiiWarningBanner visible={hasUserMessage && byokConfig === null} />
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <SuggestedPrompts onSelect={handleSend} disabled={!canSend} />
        ) : (
          <div className="space-y-4 p-4">
            {messages.map((message) =>
              isFieldAddedHint(message) ? (
                <FieldAddedHint key={message.id} />
              ) : (
                <MessageView key={message.id} message={message} />
              ),
            )}
            {isStreaming ? <ThinkingIndicator /> : null}
            {error !== undefined ? (
              <ErrorBanner error={error} onSwitchModel={openModelPicker} />
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
      <ModelPickerModal
        open={isModelPickerOpen}
        onClose={closeModelPicker}
        activeConfig={byokConfig}
        onApply={setByokConfig}
        onReset={() => setByokConfig(null)}
      />
    </div>
  )
}

type MessageViewProps = {
  message: UIMessage
}

const FIELD_ADDED_HINT_PREFIXES = [
  'A new field was just added to the document',
  'new fields were just added to the document',
] as const

const isFieldAddedHint = (message: UIMessage): boolean => {
  if (message.role !== 'user') {
    return false
  }
  for (const part of message.parts) {
    if (part.type === 'text') {
      for (const prefix of FIELD_ADDED_HINT_PREFIXES) {
        if (part.text.includes(prefix)) {
          return true
        }
      }
    }
  }
  return false
}

const FieldAddedHint = () => {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-center gap-1.5 py-1 text-[11px] text-slate-400">
      <span className="text-slate-400">
        <ToolIcon kind="write" size={12} />
      </span>
      <span>{t('chat.newFieldHint')}</span>
    </div>
  )
}

type ErrorBannerProps = {
  error: Error
  onSwitchModel: () => void
}

const ErrorBanner = ({ error, onSwitchModel }: ErrorBannerProps) => {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(false)
  const kind = classifyError(error)

  if (kind === 'authentication') {
    return (
      <div className="rounded border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
        <div className="font-medium">{t('chat.errorAuthTitle')}</div>
        <div className="mt-1">
          <Trans
            i18nKey="chat.errorAuthBody"
            components={{
              switchModel: (
                <button
                  type="button"
                  onClick={onSwitchModel}
                  className="font-medium underline underline-offset-2 hover:text-rose-900"
                />
              ),
            }}
          />
        </div>
      </div>
    )
  }

  const displayMessage = getErrorDisplayMessage(error)

  if (kind === 'server') {
    return (
      <div className="rounded border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
        <div className="font-medium">{t('chat.errorServerTitle')}</div>
        <pre className="mt-2 max-h-48 overflow-auto rounded border border-rose-200 bg-white p-2 text-[11px] leading-relaxed text-slate-700">
          <code>{displayMessage}</code>
        </pre>
      </div>
    )
  }

  return (
    <div className="rounded border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
      <button
        type="button"
        onClick={() => setIsExpanded((value) => !value)}
        aria-expanded={isExpanded}
        className="flex w-full items-center justify-between gap-2 text-left font-medium"
      >
        <span>{t('chat.errorGenericTitle')}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
        >
          <path
            d="M6 9l6 6 6-6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {isExpanded ? (
        <pre className="mt-2 max-h-48 overflow-auto rounded border border-rose-200 bg-white p-2 text-[11px] leading-relaxed text-slate-700">
          <code>{displayMessage}</code>
        </pre>
      ) : null}
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
      }
      const toolName = toolPart.type.slice('tool-'.length)
      const entry: ToolInvocationPart = {
        key,
        toolName,
        state: toolPart.state,
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

const MessageView = ({ message }: MessageViewProps) => {
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
          return <ToolInvocationGroup key={block.key} parts={block.parts} />
        })}
      </div>
    </div>
  )
}

const PiiWarningBanner = ({ visible }: { visible: boolean }) => {
  const { t } = useTranslation()
  return (
    <div
      aria-hidden={!visible}
      className={`grid transition-[grid-template-rows] duration-300 ease-out ${
        visible ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
      }`}
    >
      <div className="overflow-hidden">
        <div
          role="note"
          className={`flex items-start gap-2.5 border-b border-[#CFE0FF] bg-[#F5F9FF] px-4 py-2.5 text-[11.5px] leading-relaxed text-[#23406E] transition-opacity duration-200 ease-out ${
            visible ? 'opacity-100 delay-100' : 'opacity-0'
          }`}
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="mt-[1px] h-3.5 w-3.5 flex-none text-[#23406E]">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
            <path d="M12 11v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="12" cy="8" r="0.9" fill="currentColor" />
          </svg>
          <p>{t('chat.piiWarning')}</p>
        </div>
      </div>
    </div>
  )
}
