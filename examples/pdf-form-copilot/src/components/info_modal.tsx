import { useEffect } from 'react'
import { createPortal } from 'react-dom'

type InfoModalProps = {
  open: boolean
  onClose: () => void
}

type UseCase = {
  title: string
  body: string
}

const USE_CASES: UseCase[] = [
  {
    title: 'Healthcare',
    body: 'Patient intake and claims (e.g. CMS-1500) are PHI-heavy. The copilot walks users through the form while the document stays in the browser, and submissions route straight to the provider\'s own storage and LLM provider.',
  },
  {
    title: 'Insurance',
    body: 'ACORD applications, claim forms and policy endorsements. Carriers and brokers cut customer friction by letting the copilot pre-fill known data, explain coverages and route the finished PDF to the underwriter\'s system.',
  },
  {
    title: 'State bureaucracy',
    body: 'Scanned government forms become instantly fillable thanks to SimplePDF\'s field detection. Particularly useful when the form is in a language the user does not speak — the copilot translates, explains, and fills step by step.',
  },
  {
    title: 'HR onboarding',
    body: 'NDAs, offer letters, W-9, I-9. The copilot prefills what it can from context, hands off to the human for signatures, and submits into the HR workflow.',
  },
]

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
        className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
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
              <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="mt-4 space-y-5 text-sm leading-relaxed text-slate-700">
          <section className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <p>
              Powered by the SimplePDF{' '}
              <a
                href="https://simplepdf.com/pricing"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-sky-600 hover:text-sky-700"
              >
                Pro plan
              </a>
              . Field detection, programmatic field control and bring-your-own-storage are all Pro features.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <a
                href="https://github.com/SimplePDF/simplepdf-embed/tree/main/examples/pdf-form-copilot"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-sky-600 hover:text-sky-700"
              >
                Source code on GitHub
              </a>
              <iframe
                title="Star SimplePDF/simplepdf-embed on GitHub"
                src="https://ghbtns.com/github-btn.html?user=SimplePDF&repo=simplepdf-embed&type=star&count=true"
                frameBorder={0}
                scrolling="0"
                width={110}
                height={20}
              />
            </div>
          </section>

          <section className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <p>
              This demo is anonymous and rate-limited; tool execution stays client-side, the server is a streaming
              proxy only.
            </p>
            <p>
              <strong>Heads up:</strong> data you type or dictate to the assistant is sent to the LLM provider
              (Anthropic for this demo). Do not share real personal information (SSN, BSN, DOB, medical data, etc.).
            </p>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-slate-900">Why it matters</h3>
            <p className="mt-1">
              AI is undeniably great at automating tasks, including filling forms. But the trust is not there yet.
            </p>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-slate-900">
              SimplePDF fills forms with AI while the user stays in control
            </h3>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>The human sees fields getting filled in real time, in the editor.</li>
              <li>The AI can hand off to the user for fields it should not auto-fill (for example signatures).</li>
              <li>
                Privacy-first by architecture: documents are processed locally and, on paid plans, shipped straight to
                your own storage (S3, Azure Blob Storage, or SharePoint) without round-tripping through our servers.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-slate-900">Saving time for everyone</h3>
            <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {USE_CASES.map((useCase) => (
                <div key={useCase.title} className="flex flex-col rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="text-sm font-semibold text-slate-900">{useCase.title}</div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">{useCase.body}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Switch between the examples using the <span className="font-medium">Use case</span> selector in the
              header.
            </p>
          </section>

        </div>
      </div>
    </div>,
    document.body,
  )
}
