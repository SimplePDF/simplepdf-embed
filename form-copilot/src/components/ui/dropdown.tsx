import {
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

type DropdownSearchConfig<T> = {
  placeholder: string
  filter: (query: string) => readonly T[]
  noMatchesLabel: string
}

type DropdownProps<T> = {
  label: string
  items: readonly T[]
  selectedItem: T
  getItemKey: (item: T) => string
  renderTriggerValue: (item: T) => ReactNode
  renderItem: (item: T) => ReactNode
  onSelect: (item: T) => void
  disabled?: boolean
  search?: DropdownSearchConfig<T>
  panelWidthClass?: string
}

export const Dropdown = <T,>({
  label,
  items,
  selectedItem,
  getItemKey,
  renderTriggerValue,
  renderItem,
  onSelect,
  disabled = false,
  search,
  panelWidthClass = 'w-60',
}: DropdownProps<T>): ReactElement => {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlightIndex, setHighlightIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const visibleItems: readonly T[] = search !== undefined && query !== '' ? search.filter(query) : items

  // When the dropdown becomes disabled while open (e.g. the LanguagePicker
  // disables on `isStreaming` and a tool-call retry keeps streaming true for
  // a long stretch), the trigger button's HTML `disabled` attribute blocks
  // its own onClick, leaving the panel visually open with no way to close it
  // via the trigger. Auto-close matches the semantic of disabled ("no
  // interactions") and is more predictable than relying on click-outside or
  // Escape as the only escape hatches.
  useEffect(() => {
    if (disabled && isOpen) {
      setIsOpen(false)
    }
  }, [disabled, isOpen])

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
    if (!isOpen) {
      setQuery('')
      return
    }
    if (search !== undefined) {
      setHighlightIndex(0)
      searchInputRef.current?.focus()
      return
    }
    const selectedIndex = items.findIndex((item) => getItemKey(item) === getItemKey(selectedItem))
    setHighlightIndex(selectedIndex === -1 ? 0 : selectedIndex)
  }, [isOpen, search, items, selectedItem, getItemKey])

  const handleSelect = useCallback(
    (item: T): void => {
      onSelect(item)
      setIsOpen(false)
    },
    [onSelect],
  )

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (!isOpen) {
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlightIndex((prev) => Math.min(prev + 1, visibleItems.length - 1))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlightIndex((prev) => Math.max(prev - 1, 0))
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const target = visibleItems[highlightIndex]
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

  const selectedKey = getItemKey(selectedItem)

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
        onKeyDown={search === undefined ? handleKeyDown : undefined}
        className="flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-slate-700 transition hover:border-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="mt-[2px] text-[10px] font-medium uppercase tracking-wide text-slate-400">
          {label}
        </span>
        <span className="font-medium">{renderTriggerValue(selectedItem)}</span>
        <span className="text-slate-400">▾</span>
      </button>
      {isOpen ? (
        <div
          className={`absolute right-0 z-10 mt-1 ${panelWidthClass} rounded-md border border-slate-200 bg-white shadow-lg`}
        >
          {search !== undefined ? (
            <div className="border-b border-slate-100 p-2">
              <input
                ref={searchInputRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setHighlightIndex(0)
                }}
                onKeyDown={handleKeyDown}
                placeholder={search.placeholder}
                className="w-full rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 placeholder-slate-400 focus:border-sky-600 focus:outline-none"
              />
            </div>
          ) : null}
          <ul className="max-h-60 overflow-y-auto py-1">
            {visibleItems.length === 0 ? (
              <li className="px-3 py-2 text-slate-400">{search?.noMatchesLabel ?? ''}</li>
            ) : (
              visibleItems.map((item, index) => {
                const isHighlighted = index === highlightIndex
                const isSelected = getItemKey(item) === selectedKey
                return (
                  <li key={getItemKey(item)}>
                    <button
                      type="button"
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setHighlightIndex(index)}
                      className={`flex w-full items-center justify-between px-3 py-1.5 text-left ${
                        isHighlighted ? 'bg-sky-50 text-sky-700' : 'text-slate-700'
                      }`}
                    >
                      <span className="flex-1">{renderItem(item)}</span>
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
