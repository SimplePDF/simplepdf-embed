import type { ReactElement } from 'react'

// Shared action row for the model-picker tabs (Chat + Speech-to-Text). Both
// tabs were hand-rolling their own Cancel / primary / Forget buttons with
// drifting styling; this is the single owner so they stay identical. Labels and
// handlers are injected; the markup is fixed.
export const ModalFooterActions = ({
  showForget,
  forgetLabel,
  onForget,
  cancelLabel,
  onCancel,
  primaryLabel,
  primaryDisabled,
  onPrimary,
}: {
  showForget: boolean
  forgetLabel: string
  onForget: () => void
  cancelLabel: string
  onCancel: () => void
  primaryLabel: string
  primaryDisabled: boolean
  onPrimary: () => void
}): ReactElement => (
  <section className="flex items-center justify-between gap-2 border-t border-slate-100 pt-4">
    {showForget ? (
      <button
        type="button"
        onClick={onForget}
        className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-rose-600 hover:border-rose-300 hover:text-rose-700"
      >
        {forgetLabel}
      </button>
    ) : (
      <span />
    )}
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:border-slate-300"
      >
        {cancelLabel}
      </button>
      <button
        type="button"
        disabled={primaryDisabled}
        onClick={onPrimary}
        className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {primaryLabel}
      </button>
    </div>
  </section>
)
