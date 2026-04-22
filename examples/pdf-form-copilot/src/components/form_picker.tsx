import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { FormConfig, FormId, LocaleForms } from '../lib/forms'

type FormPickerProps = {
  value: FormId
  options: LocaleForms
  onChange: (id: FormId) => void
  disabled?: boolean
}

export const FormPicker = ({ value, options, onChange, disabled = false }: FormPickerProps) => {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const orderedForms: FormConfig[] = options.order.map((id) => options.forms[id])
  const selected = options.forms[value] ?? orderedForms[0]

  useEffect(() => {
    if (!isOpen) {
      return
    }
    const handleClickOutside = (event: MouseEvent): void => {
      if (containerRef.current !== null && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    window.addEventListener('mousedown', handleClickOutside)
    return () => {
      window.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      const index = orderedForms.findIndex((form) => form.id === value)
      setHighlightIndex(index === -1 ? 0 : index)
    }
  }, [isOpen, orderedForms, value])

  const handleSelect = useCallback(
    (form: FormConfig): void => {
      onChange(form.id)
      setIsOpen(false)
    },
    [onChange],
  )

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>): void => {
    if (!isOpen) {
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlightIndex((prev) => Math.min(prev + 1, orderedForms.length - 1))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlightIndex((prev) => Math.max(prev - 1, 0))
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const target = orderedForms[highlightIndex]
      if (target !== undefined) {
        handleSelect(target)
      }
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      setIsOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="relative text-xs">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) {
            return
          }
          setIsOpen((open) => !open)
        }}
        onKeyDown={handleKeyDown}
        className="flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-slate-700 transition hover:border-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{t('header.useCase')}</span>
        <span className="font-medium">{t(selected.labelKey)}</span>
        <span className="text-slate-400">▾</span>
      </button>
      {isOpen ? (
        <div className="absolute right-0 z-10 mt-1 w-64 rounded-md border border-slate-200 bg-white shadow-lg">
          <ul ref={listRef} className="max-h-60 overflow-y-auto py-1">
            {orderedForms.map((form, index) => {
              const isHighlighted = index === highlightIndex
              const isSelected = form.id === value
              return (
                <li key={form.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(form)}
                    onMouseEnter={() => setHighlightIndex(index)}
                    className={`flex w-full items-center justify-between px-3 py-1.5 text-left ${
                      isHighlighted ? 'bg-sky-50 text-sky-700' : 'text-slate-700'
                    }`}
                  >
                    <span>
                      <span className="block font-medium">{t(form.labelKey)}</span>
                      <span className="block text-[11px] text-slate-400">
                        {form.id === 'custom' ? t('forms.customPrivacyNote') : t(form.useCaseKey)}
                      </span>
                    </span>
                    {isSelected ? <span className="text-xs text-sky-600">✓</span> : null}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
