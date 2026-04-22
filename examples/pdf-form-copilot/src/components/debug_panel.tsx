import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { BridgeResult, IframeBridge } from '../lib/iframe_bridge'

type DebugPanelProps = {
  bridge: IframeBridge | null
  isEditorReady: boolean
}

type LogEntry = {
  id: string
  tool: string
  args: unknown
  result: BridgeResult<unknown> | { success: false; error: { code: string; message: string } }
  at: number
}

const short = (value: unknown): string => {
  const text = JSON.stringify(value)
  if (text === undefined) return ''
  return text.length > 220 ? `${text.slice(0, 217)}...` : text
}

export const DebugPanel = ({ bridge, isEditorReady }: DebugPanelProps) => {
  const { t } = useTranslation()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [pinnedFieldId, setPinnedFieldId] = useState<string | null>(null)

  const log = useCallback((tool: string, args: unknown, result: BridgeResult<unknown>): void => {
    setLogs((prev) =>
      [
        {
          id: `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
          tool,
          args,
          result,
          at: Date.now(),
        },
        ...prev,
      ].slice(0, 50),
    )
  }, [])

  const run = useCallback(
    async <TData,>(
      tool: string,
      args: unknown,
      call: () => Promise<BridgeResult<TData>>,
    ): Promise<BridgeResult<TData>> => {
      if (bridge === null) {
        const result: BridgeResult<TData> = {
          success: false,
          error: { code: 'no_bridge', message: t('debugPanel.errors.noBridge') },
        }
        log(tool, args, result)
        return result
      }
      const result = await call()
      log(tool, args, result)
      return result
    },
    [bridge, log],
  )

  const handleGetFields = useCallback(async () => {
    const result = await run('getFields', {}, () => (bridge as IframeBridge).getFields())
    if (result.success && result.data.fields.length > 0) {
      setPinnedFieldId(result.data.fields[0].field_id)
    }
  }, [bridge, run])

  const handleFocusField = useCallback(async () => {
    if (pinnedFieldId === null) {
      await run('focusField', { note: 'no_pinned_field' }, async () => ({
        success: false,
        error: { code: 'no_field', message: t('debugPanel.errors.noField') },
      }))
      return
    }
    await run('focusField', { fieldId: pinnedFieldId }, () =>
      (bridge as IframeBridge).focusField({ fieldId: pinnedFieldId }),
    )
  }, [bridge, pinnedFieldId, run])

  const handleSetFieldValue = useCallback(async () => {
    if (pinnedFieldId === null) {
      await run('setFieldValue', { note: 'no_pinned_field' }, async () => ({
        success: false,
        error: { code: 'no_field', message: t('debugPanel.errors.noField') },
      }))
      return
    }
    await run('setFieldValue', { fieldId: pinnedFieldId, value: 'Debug panel' }, () =>
      (bridge as IframeBridge).setFieldValue({ fieldId: pinnedFieldId, value: 'Debug panel' }),
    )
  }, [bridge, pinnedFieldId, run])

  const handleGoToPage1 = useCallback(async () => {
    await run('goTo', { page: 1 }, () => (bridge as IframeBridge).goTo({ page: 1 }))
  }, [bridge, run])

  const handleDetectFields = useCallback(async () => {
    await run('detectFields', {}, () => (bridge as IframeBridge).detectFields())
  }, [bridge, run])

  const handleGetContent = useCallback(async () => {
    await run('getDocumentContent', { extractionMode: 'auto' }, () =>
      (bridge as IframeBridge).getDocumentContent({ extractionMode: 'auto' }),
    )
  }, [bridge, run])

  const handleSelectText = useCallback(async () => {
    await run('selectTool', { tool: 'TEXT' }, () => (bridge as IframeBridge).selectTool({ tool: 'TEXT' }))
  }, [bridge, run])

  const handleSubmitDownload = useCallback(async () => {
    await run('submit', { downloadCopy: true }, () =>
      (bridge as IframeBridge).submit({ downloadCopy: true }),
    )
  }, [bridge, run])

  const handleRemoveAll = useCallback(async () => {
    await run('removeFields', {}, () => (bridge as IframeBridge).removeFields())
  }, [bridge, run])

  const handleClear = useCallback(() => {
    setLogs([])
  }, [])

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">{t('debugPanel.title')}</h2>
        <p className="text-xs text-slate-500">
          {isEditorReady ? t('debugPanel.statusReady') : t('debugPanel.statusWaiting')}
          {pinnedFieldId !== null ? ` · ${t('debugPanel.pinnedFieldPrefix')} ${pinnedFieldId.slice(0, 8)}…` : ''}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 border-b border-slate-200 px-3 py-3 text-xs">
        <DebugButton label={t('debugPanel.buttons.getFields')} onClick={handleGetFields} disabled={!isEditorReady} />
        <DebugButton label={t('debugPanel.buttons.focusField')} onClick={handleFocusField} disabled={!isEditorReady} />
        <DebugButton label={t('debugPanel.buttons.setFieldValue')} onClick={handleSetFieldValue} disabled={!isEditorReady} />
        <DebugButton label={t('debugPanel.buttons.goToPage1')} onClick={handleGoToPage1} disabled={!isEditorReady} />
        <DebugButton label={t('debugPanel.buttons.detectFields')} onClick={handleDetectFields} disabled={!isEditorReady} />
        <DebugButton label={t('debugPanel.buttons.getDocumentContent')} onClick={handleGetContent} disabled={!isEditorReady} />
        <DebugButton label={t('debugPanel.buttons.selectToolText')} onClick={handleSelectText} disabled={!isEditorReady} />
        <DebugButton label={t('debugPanel.buttons.removeFieldsAll')} onClick={handleRemoveAll} disabled={!isEditorReady} />
        <DebugButton label={t('debugPanel.buttons.submitDownload')} onClick={handleSubmitDownload} disabled={!isEditorReady} />
        <DebugButton label={t('debugPanel.clearLog')} onClick={handleClear} tone="ghost" />
      </div>
      <div className="flex-1 overflow-y-auto p-3 text-xs">
        {logs.length === 0 ? (
          <p className="text-slate-400">{t('debugPanel.emptyLog')}</p>
        ) : (
          <ul className="space-y-2">
            {logs.map((entry) => (
              <li key={entry.id} className="rounded border border-slate-200 bg-slate-50 p-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold text-slate-800">{entry.tool}</span>
                  <span
                    className={
                      entry.result.success
                        ? 'rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700'
                        : 'rounded bg-rose-100 px-1.5 py-0.5 text-rose-700'
                    }
                  >
                    {entry.result.success ? t('debugPanel.resultOk') : entry.result.error.code}
                  </span>
                </div>
                <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all text-[11px] text-slate-500">
                  {t('toolInvocation.argsLabel')} {short(entry.args)}
                  {'\n'}
                  {short(entry.result)}
                </pre>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

type DebugButtonProps = {
  label: string
  onClick: () => void | Promise<void>
  disabled?: boolean
  tone?: 'default' | 'ghost'
}

const DebugButton = ({ label, onClick, disabled, tone = 'default' }: DebugButtonProps) => {
  const base = 'rounded border px-2 py-1 text-left font-mono transition disabled:cursor-not-allowed disabled:opacity-40'
  const theme =
    tone === 'ghost'
      ? 'border-slate-200 bg-white text-slate-500 hover:bg-slate-100'
      : 'border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-300 hover:bg-sky-100'
  return (
    <button type="button" className={`${base} ${theme}`} onClick={onClick} disabled={disabled}>
      {label}
    </button>
  )
}
