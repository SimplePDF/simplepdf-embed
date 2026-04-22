import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { filterLanguages, getLanguageByCode, LANGUAGES, type Language } from '../lib/languages'

type LanguagePickerProps = {
  value: string
  onChange: (code: string) => void
  disabled?: boolean
}

export const LanguagePicker = ({ value, onChange, disabled = false }: LanguagePickerProps) => {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlightIndex, setHighlightIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const selected = getLanguageByCode(value) ?? LANGUAGES[0]
  const matches = filterLanguages(query)

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
      setHighlightIndex(0)
      inputRef.current?.focus()
    } else {
      setQuery('')
    }
  }, [isOpen])

  const handleSelect = useCallback(
    (language: Language): void => {
      onChange(language.code)
      setIsOpen(false)
    },
    [onChange],
  )

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlightIndex((prev) => Math.min(prev + 1, matches.length - 1))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlightIndex((prev) => Math.max(prev - 1, 0))
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const target = matches[highlightIndex]
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
        className="flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-slate-700 transition hover:border-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{t('languagePicker.label')}</span>
        <span className="font-medium">{selected.label}</span>
        <span className="text-slate-400">▾</span>
      </button>
      {isOpen ? (
        <div className="absolute right-0 z-10 mt-1 w-60 rounded-md border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 p-2">
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setHighlightIndex(0)
              }}
              onKeyDown={handleKeyDown}
              placeholder={t('languagePicker.search')}
              className="w-full rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 placeholder-slate-400 focus:border-sky-400 focus:outline-none"
            />
          </div>
          <ul ref={listRef} className="max-h-60 overflow-y-auto py-1">
            {matches.length === 0 ? (
              <li className="px-3 py-2 text-slate-400">{t('languagePicker.noMatches')}</li>
            ) : (
              matches.map((language, index) => {
                const isHighlighted = index === highlightIndex
                const isSelected = language.code === value
                return (
                  <li key={language.code}>
                    <button
                      type="button"
                      onClick={() => handleSelect(language)}
                      onMouseEnter={() => setHighlightIndex(index)}
                      className={`flex w-full items-center justify-between px-3 py-1.5 text-left ${
                        isHighlighted ? 'bg-sky-50 text-sky-700' : 'text-slate-700'
                      }`}
                    >
                      <span>
                        {language.label}
                        <span className="ml-2 text-[11px] text-slate-400">{language.native}</span>
                      </span>
                      {isSelected ? <span className="text-xs text-sky-600">✓</span> : null}
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
