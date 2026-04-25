import { type ReactElement, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import type { FormId } from '../lib/forms'
import { buildSimplepdfUrl } from '../lib/simplepdf_url'
import { Modal, ModalCloseButton, ModalFooter } from './ui/modal'

type InfoModalProps = {
  open: boolean
  onClose: () => void
  // Click target for the use-case cards. The caller is expected to both set
  // the form AND flip the UI locale to English, since the cards always
  // showcase US forms regardless of the current locale.
  onSelectUseCaseForm: (formId: FormId) => void
  locale: string
}

type UseCaseKey = 'tax' | 'hr' | 'healthcare' | 'insurance'

type UseCase = {
  key: UseCaseKey
  formId: FormId | null
}

// Use-case cards always point to US English forms regardless of UI locale —
// the click handler flips ?lang=en so the chosen form appears in the picker.
const USE_CASES: UseCase[] = [
  { key: 'tax', formId: 'w9' },
  { key: 'hr', formId: 'i9' },
  { key: 'healthcare', formId: 'healthcare' },
  { key: 'insurance', formId: null },
]

type IconProps = { className?: string }

const IconDocumentShield = ({ className }: IconProps): ReactElement => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M20 12V5.74853C20 5.5894 19.9368 5.43679 19.8243 5.32426L16.6757 2.17574C16.5632 2.06321 16.4106 2 16.2515 2H4.6C4.26863 2 4 2.26863 4 2.6V21.4C4 21.7314 4.26863 22 4.6 22H13"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M8 10H16M8 6H12M8 14H11"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M16 2V5.4C16 5.73137 16.2686 6 16.6 6H20"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M19.9923 15.125L22.5477 15.774C22.8137 15.8416 23.0013 16.0833 22.9931 16.3576C22.8214 22.1159 19.5 23 19.5 23C19.5 23 16.1786 22.1159 16.0069 16.3576C15.9987 16.0833 16.1863 15.8416 16.4523 15.774L19.0077 15.125C19.3308 15.043 19.6692 15.043 19.9923 15.125Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const IconAi = ({ className }: IconProps): ReactElement => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M6.81815 22L6.81819 19.143C6.66235 17.592 5.63284 16.4165 4.68213 15M14.4545 22L14.4545 20.2858C19.3636 20.2858 18.8182 14.5717 18.8182 14.5717C18.8182 14.5717 21 14.5717 21 12.286L18.8182 8.8576C18.8182 4.28632 15.1094 2.04169 11.1818 2.00068C8.98139 1.97771 7.22477 2.53124 5.91201 3.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M13 7L15 9.5L13 12"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M5 7L3 9.5L5 12"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M10 6L8 13"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const IconStorage = ({ className }: IconProps): ReactElement => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <ellipse cx="12" cy="6" rx="8" ry="2.5" stroke="currentColor" strokeWidth="1.5" />
    <path d="M4 6v6c0 1.4 3.58 2.5 8 2.5s8-1.1 8-2.5V6" stroke="currentColor" strokeWidth="1.5" />
    <path d="M4 12v6c0 1.4 3.58 2.5 8 2.5s8-1.1 8-2.5v-6" stroke="currentColor" strokeWidth="1.5" />
  </svg>
)

const IconHealthcare = ({ className }: IconProps): ReactElement => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M3 12.5h3.2l1.9-4.5 3.1 9.5 2.1-5 1.5 2h6.2"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const IconInsurance = ({ className }: IconProps): ReactElement => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M12 3.2l8 3v5.6c0 4.6-3.55 8.2-8 9.1-4.45-.9-8-4.5-8-9.1V6.2l8-3z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <path
      d="M9 12.1l2.2 2.2L15 10.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const IconTax = ({ className }: IconProps): ReactElement => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path d="M3 20h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path
      d="M5 20V10.5M9 20V10.5M15 20V10.5M19 20V10.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path d="M2.5 10.5h19L12 3.5 2.5 10.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
)

const IconHR = ({ className }: IconProps): ReactElement => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
    <path
      d="M3 20c0-3 2.7-5.2 6-5.2s6 2.2 6 5.2"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path d="M17 11v4M15 13h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

const IconArrow = ({ className }: IconProps): ReactElement => (
  <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
    <path
      d="M3 8h10M9 4l4 4-4 4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const IconGithub = ({ className }: IconProps): ReactElement => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 2C6.48 2 2 6.58 2 12.25c0 4.54 2.87 8.39 6.84 9.75.5.1.68-.22.68-.49v-1.7c-2.78.62-3.37-1.36-3.37-1.36-.46-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.89 1.57 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.74-.1-.26-.45-1.3.1-2.71 0 0 .84-.27 2.75 1.05a9.3 9.3 0 0 1 5 0c1.91-1.32 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.71 1.03 1.62 1.03 2.74 0 3.93-2.35 4.8-4.58 5.05.36.32.68.94.68 1.9v2.81c0 .27.18.6.69.49A10.02 10.02 0 0 0 22 12.25C22 6.58 17.52 2 12 2z"
    />
  </svg>
)

const USE_CASE_ICONS: Record<UseCaseKey, (props: IconProps) => ReactElement> = {
  tax: IconTax,
  hr: IconHR,
  healthcare: IconHealthcare,
  insurance: IconInsurance,
}

const ARCHITECTURE_ICONS = [IconDocumentShield, IconAi, IconStorage] as const

const STEP_NUMBERS = [1, 2, 3] as const

type ArchitectureSegment = { text: string; blue?: boolean; large?: boolean }

// Two-tab architecture diagrams. The first tab shows what's actually
// happening when the user is looking at the demo (shared SimplePDF
// workspace, hosted AI provider, no webhooks, no BYOS, SimplePDF server
// only collects telemetry). The second tab shows the production picture
// a Pro/Premium customer would deploy: their own server, their own AI
// stack, BYOS for completed documents, optional webhooks.

const ARCHITECTURE_LINES_DEMO: ArchitectureSegment[][] = [
  [{ text: '  ┌──────────── Browser ────────────┐       ┌── Form Copilot demo ──┐       ┌── Hosted AI ──────┐' }],
  [{ text: '  │                                 │       │                       │       │                   │' }],
  [
    { text: '  │   ' },
    { text: '┌───────────────┐', blue: true },
    { text: '   chat      │       │   LLM proxy           │       │                   │' },
  ],
  [
    { text: '  │   ' },
    { text: '│  Form Copilot │', blue: true },
    { text: ' ────────────┼─────► │   (or BYOK direct)    │ ────► │     Demo LLM      │' },
  ],
  [
    { text: '  │   ' },
    { text: '└───────┬───────┘', blue: true },
    { text: '             │       │                       │       │                   │' },
  ],
  [
    { text: '  │           ' },
    { text: '│', blue: true },
    { text: '                     │       └───────────────────────┘       └───────────────────┘' },
  ],
  [{ text: '  │           ' }, { text: '│', blue: true }, { text: '                     │' }],
  [
    { text: '  │           ' },
    { text: '│', blue: true },
    { text: ' ' },
    { text: '⇅', large: true },
    { text: ' postMessage       │' },
  ],
  [{ text: '  │           ' }, { text: '│', blue: true }, { text: '   (client-side      │       ' }, { text: '┌─── SimplePDF server ────┐', blue: true }],
  [
    { text: '  │           ' },
    { text: '│', blue: true },
    { text: '    tool calls)      │       ' },
    { text: '│                         │', blue: true },
  ],
  [
    { text: '  │           ' },
    { text: '▼', blue: true },
    { text: '                     │       ' },
    { text: '│  · telemetry only ·     │', blue: true },
  ],
  [
    { text: '  │   ' },
    { text: '┌───────────────────────┐', blue: true },
    { text: '     │       ' },
    { text: '│   rate-limit metadata   │', blue: true },
  ],
  [
    { text: '  │   ' },
    { text: '│                       │', blue: true },
    { text: ' ────┼─────► ' },
    { text: '│   IP-hash counters      │', blue: true },
  ],
  [
    { text: '  │   ' },
    { text: '│   SimplePDF editor    │', blue: true },
    { text: '     │       ' },
    { text: '│   no document content   │', blue: true },
  ],
  [
    { text: '  │   ' },
    { text: '│       (iframe)        │', blue: true },
    { text: '     │       ' },
    { text: '└─────────────────────────┘', blue: true },
  ],
  [{ text: '  │   ' }, { text: '│                       │', blue: true }, { text: '     │' }],
  [{ text: '  │   ' }, { text: '└───────────────────────┘', blue: true }, { text: '     │' }],
  [{ text: '  │                                 │' }],
  [{ text: '  └─────────────────────────────────┘' }],
]

const ARCHITECTURE_LINES: ArchitectureSegment[][] = [
  [{ text: '  ┌──────────── Browser ────────────┐       ┌── Your server ──┐       ┌── Your AI stack ──┐' }],
  [{ text: '  │                                 │       │                 │       │                   │' }],
  [
    { text: '  │   ' },
    { text: '┌───────────────┐', blue: true },
    { text: '   chat      │       │   LLM proxy     │       │  Provider + keys  │' },
  ],
  [
    { text: '  │   ' },
    { text: '│  Form Copilot │', blue: true },
    { text: ' ────────────┼─────► │   (streaming)   │ ────► │  RAG + data       │' },
  ],
  [
    { text: '  │   ' },
    { text: '└───────┬───────┘', blue: true },
    { text: '             │       │                 │       │                   │' },
  ],
  [
    { text: '  │           ' },
    { text: '│', blue: true },
    { text: '                     │       └─┬───────────────┘       └───────────────────┘' },
  ],
  [{ text: '  │           ' }, { text: '│', blue: true }, { text: '                     │         ▲' }],
  [
    { text: '  │           ' },
    { text: '│', blue: true },
    { text: ' ' },
    { text: '⇅', large: true },
    { text: ' postMessage       │         │ webhook (optional)' },
  ],
  [{ text: '  │           ' }, { text: '│', blue: true }, { text: '   (client-side      │         │' }],
  [{ text: '  │           ' }, { text: '│', blue: true }, { text: '    tool calls)      │         │' }],
  [
    { text: '  │           ' },
    { text: '▼', blue: true },
    { text: '                     │       ' },
    { text: '┌─┴─ SimplePDF server ───┐', blue: true },
  ],
  [
    { text: '  │   ' },
    { text: '┌───────────────────────┐', blue: true },
    { text: '     │       ' },
    { text: '│                        │', blue: true },
  ],
  [
    { text: '  │   ' },
    { text: '│                       │', blue: true },
    { text: '     │       ' },
    { text: '│   · metadata only ·    │', blue: true },
  ],
  [
    { text: '  │   ' },
    { text: '│                       │', blue: true },
    { text: ' ────┼─────► ' },
    { text: '│   pre-signed URLs      │', blue: true },
  ],
  [
    { text: '  │   ' },
    { text: '│                       │', blue: true },
    { text: '     │       ' },
    { text: '│   never sees the doc   │', blue: true },
  ],
  [
    { text: '  │   ' },
    { text: '│   SimplePDF editor    │', blue: true },
    { text: '     │       ' },
    { text: '└────────────────────────┘', blue: true },
  ],
  [{ text: '  │   ' }, { text: '│       (iframe)        │', blue: true }, { text: '     │' }],
  [{ text: '  │   ' }, { text: '│                       │', blue: true }, { text: '     │' }],
  [
    { text: '  │   ' },
    { text: '│                       │', blue: true },
    { text: '     │       ┌───────────── Your storage ─────────────┐' },
  ],
  [
    { text: '  │   ' },
    { text: '│                       │', blue: true },
    { text: ' ════┼══════►│                                        │' },
  ],
  [
    { text: '  │   ' },
    { text: '└───────────────────────┘', blue: true },
    { text: '     │       │  S3 / Azure Blob Storage / SharePoint  │' },
  ],
  [{ text: '  │                                 │       │  direct upload                         │' }],
  [{ text: '  └─────────────────────────────────┘       └────────────────────────────────────────┘' }],
]

const STEP_HINT_KEYS: Record<number, string | null> = {
  1: 'infoModal.humanInTheLoopBullet1Hint',
  2: 'infoModal.humanInTheLoopBullet2Hint',
  3: 'infoModal.humanInTheLoopBullet3Hint',
}
const ARCHITECTURE_INDICES = [0, 1, 2] as const

type ArchitectureTab = 'demo' | 'production'

export const InfoModal = ({
  open,
  onClose,
  onSelectUseCaseForm,
  locale,
}: InfoModalProps): ReactElement | null => {
  const pricingHref = buildSimplepdfUrl({ locale, path: '/pricing', query: { s: 'form-copilot' } })
  const { t } = useTranslation()
  // Default to the demo tab: that's the architecture the visitor is
  // actually looking at right now. The production tab shows what they'd
  // build with their own SimplePDF account.
  const [activeArchitectureTab, setActiveArchitectureTab] = useState<ArchitectureTab>('demo')
  const architectureLinesByTab: Record<ArchitectureTab, ArchitectureSegment[][]> = {
    demo: ARCHITECTURE_LINES_DEMO,
    production: ARCHITECTURE_LINES,
  }
  const architectureDescriptionKey: Record<ArchitectureTab, string> = {
    demo: 'infoModal.architectureDemoDescription',
    production: 'infoModal.architectureDescription',
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="info-modal-title" size="lg">
      <header className="flex items-start justify-between gap-6 border-b border-slate-100 px-7 pt-6 pb-5">
        <div className="flex-1 space-y-3">
          <h2
            id="info-modal-title"
            className="max-w-[34ch] text-[22px] font-semibold leading-tight tracking-tight text-slate-900"
          >
            {t('infoModal.title')}
          </h2>
          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href="https://github.com/SimplePDF/simplepdf-embed/tree/main/form-copilot"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11.5px] font-medium text-slate-700 transition hover:border-sky-600 hover:text-sky-700"
            >
              <IconGithub className="h-3.5 w-3.5" />
              {t('infoModal.sourceCode')}
            </a>
            <iframe
              title={t('infoModal.githubStarTitle')}
              src="https://ghbtns.com/github-btn.html?user=SimplePDF&repo=simplepdf-embed&type=star&count=true"
              frameBorder={0}
              scrolling="0"
              width={110}
              height={20}
            />
          </div>
        </div>
        <ModalCloseButton onClose={onClose} />
      </header>

      <div className="flex-1 overflow-y-auto px-7 py-6">
        <div className="space-y-8">
          <section>
            <p className="text-[17px] font-semibold leading-snug text-slate-900">
              {t('infoModal.whyItMattersLead')}
            </p>
            <p className="mt-2 text-[14px] leading-relaxed text-slate-600">
              {t('infoModal.whyItMattersBody')}
            </p>
          </section>

          <section>
            <h3 className="text-[17px] font-semibold leading-snug text-slate-900">
              {t('infoModal.humanInTheLoopTitle')}
            </h3>
            <ol className="mt-5">
              {STEP_NUMBERS.map((n, idx) => {
                const isLast = idx === STEP_NUMBERS.length - 1
                const hintKey = STEP_HINT_KEYS[n]
                return (
                  <li key={n} className="flex gap-5">
                    <div className="flex flex-shrink-0 flex-col items-center">
                      <div className="flex h-[25px] w-[25px] items-center justify-center rounded-full bg-sky-600 text-[14px] font-bold text-white">
                        {n}
                      </div>
                      {!isLast ? <div className="w-[2px] flex-1 bg-slate-200" /> : null}
                    </div>
                    <div className={isLast ? 'pb-0' : 'pb-7'}>
                      <p className="text-[15px] leading-[1.7] text-slate-700">
                        {t(`infoModal.humanInTheLoopBullet${n}`)}
                      </p>
                      {hintKey !== null ? (
                        <p className="mt-1 text-[13px] leading-relaxed text-slate-500">{t(hintKey)}</p>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>

          <section>
            <h3 className="text-[17px] font-semibold leading-snug text-slate-900">
              {t('infoModal.aboutTitle')}
            </h3>
            <p className="mt-2 text-[14px] leading-relaxed text-slate-600">{t('infoModal.aboutIntro')}</p>
            <ul className="mt-4 grid gap-3 md:grid-cols-3">
              {ARCHITECTURE_INDICES.map((idx) => {
                const Icon = ARCHITECTURE_ICONS[idx]
                const bulletNumber = idx + 1
                return (
                  <li key={idx} className="rounded-2xl border border-slate-200 bg-[#f1f7ff] p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-[#002b5f]">
                      <Icon className="h-7 w-7" />
                    </div>
                    <div className="mt-4 text-[14px] font-semibold leading-snug text-[#002b5f]">
                      {t(`infoModal.aboutBullet${bulletNumber}Title`)}
                    </div>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-600">
                      {t(`infoModal.aboutBullet${bulletNumber}Body`)}
                    </p>
                  </li>
                )
              })}
            </ul>
          </section>

          <section>
            <h3 className="text-[17px] font-semibold leading-snug text-slate-900">
              {t('infoModal.useCasesTitle')}
            </h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {USE_CASES.map((useCase) => {
                const { formId } = useCase
                const Icon = USE_CASE_ICONS[useCase.key]
                const title = t(`infoModal.useCases.${useCase.key}.title`)
                const body = t(`infoModal.useCases.${useCase.key}.body`)
                const sharedClass =
                  'group flex h-full flex-col rounded-xl border p-3.5 text-left transition-all duration-200'

                if (formId === null) {
                  return (
                    <div
                      key={useCase.key}
                      className={`${sharedClass} border-dashed border-slate-200 bg-slate-50/60`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-10 w-10 items-center justify-center text-slate-400">
                          <Icon className="h-5 w-5" />
                        </span>
                        <div className="text-[13px] font-semibold text-slate-700">{title}</div>
                      </div>
                      <p className="mt-2.5 flex-1 text-[11.5px] leading-relaxed text-slate-500">{body}</p>
                    </div>
                  )
                }

                return (
                  <button
                    key={useCase.key}
                    type="button"
                    onClick={() => {
                      onSelectUseCaseForm(formId)
                      onClose()
                    }}
                    className={`${sharedClass} cursor-pointer border-slate-200 bg-white hover:bg-[#f1f7ff]`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-transparent text-[#002b5f] transition-colors duration-200 group-hover:bg-white">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="text-[13px] font-semibold text-slate-900 transition-colors duration-200 group-hover:text-[#002b5f]">
                        {title}
                      </div>
                    </div>
                    <p className="mt-2.5 flex-1 text-[11.5px] leading-relaxed text-slate-600">{body}</p>
                    <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-sky-600 transition-all duration-200 group-hover:gap-1.5 group-hover:text-[#002b5f]">
                      {t('infoModal.tryThisForm')}
                      <IconArrow className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </button>
                )
              })}
            </div>
            <p className="mt-3 text-[11.5px] text-slate-500">{t('infoModal.useCasesFooter')}</p>
          </section>

          <section>
            <h3 className="text-[17px] font-semibold leading-snug text-slate-900">
              {t('infoModal.architectureTitle')}
            </h3>
            <p className="mt-2 text-[14px] leading-relaxed text-slate-600">
              {t('infoModal.architectureSubtext')}
            </p>
            <div className="mt-4 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
              {(['demo', 'production'] as const).map((tab) => {
                const isActive = activeArchitectureTab === tab
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveArchitectureTab(tab)}
                    aria-pressed={isActive}
                    className={
                      isActive
                        ? 'rounded-md bg-white px-3 py-1.5 text-[12px] font-semibold text-[#002b5f] shadow-sm'
                        : 'rounded-md px-3 py-1.5 text-[12px] font-medium text-slate-500 hover:text-slate-700'
                    }
                  >
                    {t(`infoModal.architectureTabs.${tab}`)}
                  </button>
                )
              })}
            </div>
            <p className="sr-only">{t(architectureDescriptionKey[activeArchitectureTab])}</p>
            <pre
              aria-hidden="true"
              className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-[#f1f7ff] p-5 font-mono text-[11px] leading-[1.55] text-[#002b5f]"
            >
              {architectureLinesByTab[activeArchitectureTab].map((segments, lineIndex) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: the active diagram is a static constant; ordering is stable and content doesn't reorder.
                <span key={`line-${lineIndex}`}>
                  {segments.map((segment, segmentIndex) => {
                    const classes = [
                      segment.blue === true ? 'text-[#3665e1]' : null,
                      segment.large === true ? 'inline-block scale-[2] align-middle leading-none' : null,
                    ].filter((value): value is string => value !== null)
                    const className = classes.length > 0 ? classes.join(' ') : undefined
                    return (
                      // biome-ignore lint/suspicious/noArrayIndexKey: same static-diagram reasoning as the outer map.
                      <span key={`line-${lineIndex}-seg-${segmentIndex}`} className={className}>
                        {segment.text}
                      </span>
                    )
                  })}
                  {'\n'}
                </span>
              ))}
            </pre>
          </section>
        </div>
      </div>

      <ModalFooter variant="centered">
        <span>
          <Trans
            i18nKey="infoModal.availableOn"
            components={{
              plan: (
                // biome-ignore lint/a11y/useAnchorContent: children are injected at runtime by i18next <Trans>.
                <a
                  href={pricingHref}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-sky-600 hover:text-sky-700"
                />
              ),
            }}
          />
        </span>
      </ModalFooter>
    </Modal>
  )
}
