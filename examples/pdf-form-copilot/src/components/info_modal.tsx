import { useEffect } from 'react'
import { createPortal } from 'react-dom'

type InfoModalProps = {
  open: boolean
  onClose: () => void
}

export const InfoModal = ({ open, onClose }: InfoModalProps) => {
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

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="info-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-w-lg rounded-lg bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="info-modal-title" className="text-lg font-semibold text-slate-900">
            AI-assisted form filling, humans in the loop
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M4 4L12 12M12 4L4 12"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className="mt-4 space-y-4 text-sm leading-relaxed text-slate-700">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Why it matters</h3>
            <p className="mt-1">
              AI is undeniably great at automating tasks, including filling forms. But the trust is not there yet.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              SimplePDF fills forms with AI while the user stays in control:
            </h3>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>The human sees fields getting filled in real time, in the editor.</li>
              <li>The AI can hand off to the user for fields it should not auto-fill (for example signatures).</li>
              <li>
                Privacy-first by architecture: documents are processed locally and, on paid plans, shipped straight to
                your own storage (S3, Azure Blob Storage, or SharePoint) without round-tripping through our servers.
              </li>
            </ul>
          </div>
          <p className="text-xs text-slate-500">
            This demo is anonymous and rate-limited; tool execution stays client-side, the server is a streaming proxy
            only.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  )
}
