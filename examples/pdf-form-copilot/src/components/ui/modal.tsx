import { type ReactElement, type ReactNode, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

type ModalProps = {
  open: boolean
  onClose: () => void
  labelledBy?: string
  // Width preset for the panel. Defaults to 'md'. Use arbitrary classes via
  // `containerClassName` for bespoke widths.
  size?: 'sm' | 'md' | 'lg'
  containerClassName?: string
  children: ReactNode
}

const SIZE_CLASSES: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-[460px]',
  md: 'max-w-[640px]',
  lg: 'max-w-[936px]',
}

export const Modal = ({
  open,
  onClose,
  labelledBy,
  size = 'md',
  containerClassName,
  children,
}: ModalProps): ReactElement | null => {
  useEffect(() => {
    if (!open) {
      return
    }
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('keydown', handleKey)
    }
  }, [open, onClose])

  if (!open || typeof document === 'undefined') {
    return null
  }

  const sizeClass = SIZE_CLASSES[size]
  const panelClass =
    containerClassName ??
    `flex max-h-[92vh] w-full ${sizeClass} flex-col overflow-hidden rounded-lg bg-white shadow-2xl ring-1 ring-slate-900/5`

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: inner panel stops backdrop-close propagation, not interactive on its own. */}
      <div className={panelClass} onClick={(event) => event.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body,
  )
}

type ModalCloseButtonProps = {
  onClose: () => void
  ariaLabel?: string
}

export const ModalCloseButton = ({ onClose, ariaLabel }: ModalCloseButtonProps): ReactElement => {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label={ariaLabel ?? t('infoModal.close')}
      className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </button>
  )
}

// Shared title+close-button row used by the cerfa_dor, submit_demo, and
// model_picker modals. info_modal has a bespoke header with additional GitHub
// affordances and uses its own layout. Extra content (e.g. a brand image)
// slots in via `leftAccessory`.
type ModalHeaderProps = {
  titleId: string
  title: ReactNode
  onClose: () => void
  closeAriaLabel?: string
  className?: string
  leftAccessory?: ReactNode
}

export const ModalHeader = ({
  titleId,
  title,
  onClose,
  closeAriaLabel,
  className,
  leftAccessory,
}: ModalHeaderProps): ReactElement => {
  const wrapperClass =
    className ?? 'flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5'
  return (
    <div className={wrapperClass}>
      <div className="flex items-center gap-3">
        {leftAccessory}
        <h2 id={titleId} className="text-[17px] font-semibold leading-snug text-slate-900">
          {title}
        </h2>
      </div>
      <ModalCloseButton onClose={onClose} ariaLabel={closeAriaLabel} />
    </div>
  )
}

// Shared footer shell used by info_modal (centered variant) and
// download_modal (split variant with left + right action slots).
// Centralises the border / background / padding / text sizing so every
// modal's footer bar reads the same. Discriminated union keeps the two
// shapes mutually exclusive at the type level.
type ModalFooterCenteredProps = {
  variant: 'centered'
  children: ReactNode
  className?: string
}

type ModalFooterSplitProps = {
  variant: 'split'
  left: ReactNode
  right: ReactNode
  className?: string
}

type ModalFooterProps = ModalFooterCenteredProps | ModalFooterSplitProps

const MODAL_FOOTER_BASE_CLASS =
  'border-t border-slate-100 bg-slate-50/60 px-6 py-3.5 text-[11.5px] text-slate-500'

export const ModalFooter = (props: ModalFooterProps): ReactElement => {
  switch (props.variant) {
    case 'centered': {
      const wrapperClass = props.className ?? `${MODAL_FOOTER_BASE_CLASS} flex items-center justify-center`
      return <footer className={wrapperClass}>{props.children}</footer>
    }
    case 'split': {
      const wrapperClass =
        props.className ?? `${MODAL_FOOTER_BASE_CLASS} flex items-center justify-between gap-3`
      return (
        <footer className={wrapperClass}>
          <div className="flex items-center">{props.left}</div>
          <div className="flex items-center">{props.right}</div>
        </footer>
      )
    }
    default:
      props satisfies never
      throw new Error('Unsupported ModalFooter variant')
  }
}
