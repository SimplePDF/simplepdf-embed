import { type ReactElement, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

// Icon SVGs mirrored verbatim from the parent `client/components/icons`
// surface so the demo renders the same brand marks without depending on
// the parent package. Fill comes from `currentColor` via the `fill-current`
// utility so the wrapper button drives colour.

const XTwitterIcon = ({ size = 14 }: { size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 512 512"
    width={size}
    height={size}
    className="fill-current"
    aria-hidden="true"
  >
    <path d="M389.2 48h70.6L305.6 224.2 487 464H345L233.7 318.6 106.5 464H35.8L200.7 275.5 26.8 48H172.4L272.9 180.9 389.2 48zM364.4 421.8h39.1L151.1 88h-42L364.4 421.8z" />
  </svg>
)

const LinkedInIcon = ({ size = 14 }: { size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 448 512"
    width={size}
    height={size}
    className="fill-current"
    aria-hidden="true"
  >
    <path d="M416 32H31.9C14.3 32 0 46.5 0 64.3v383.4C0 465.5 14.3 480 31.9 480H416c17.6 0 32-14.5 32-32.3V64.3c0-17.8-14.4-32.3-32-32.3zM135.4 416H69V202.2h66.5V416zm-33.2-243c-21.3 0-38.5-17.3-38.5-38.5S80.9 96 102.2 96c21.2 0 38.5 17.3 38.5 38.5 0 21.3-17.2 38.5-38.5 38.5zm282.1 243h-66.4V312c0-24.8-.5-56.7-34.5-56.7-34.6 0-39.9 27-39.9 54.9V416h-66.4V202.2h63.7v29.2h.9c8.9-16.8 30.6-34.5 62.9-34.5 67.2 0 79.7 44.3 79.7 101.9V416z" />
  </svg>
)

// Chain-link glyph for the Copy-link button. Fill via currentColor so the
// wrapping button drives colour.
const LinkIcon = ({ size = 14 }: { size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M14 11.9976C14 9.5059 11.683 7 8.85714 7C8.52241 7 7.41904 7.00001 7.14286 7.00001C4.30254 7.00001 2 9.23752 2 11.9976C2 14.376 3.70973 16.3664 6 16.8714C6.36756 16.9525 6.75006 16.9952 7.14286 16.9952" />
    <path d="M10 11.9976C10 14.4893 12.317 16.9952 15.1429 16.9952C15.4776 16.9952 16.581 16.9952 16.8571 16.9952C19.6975 16.9952 22 14.7577 22 11.9976C22 9.6192 20.2903 7.62884 18 7.12383C17.6324 7.04278 17.2499 6.99999 16.8571 6.99999" />
  </svg>
)

type SocialKind = 'linkedin' | 'x.com'

const COPIED_RESET_MS = 2000

// Share the exact URL the user is on right now. Preserves ?share, ?form,
// ?lang, and any other query params so the recipient lands on the same
// form, in the same locale, with the same invite / model config.
//
// Note: LinkedIn + X share dialogs need the URL to be publicly scrapable
// for the link-preview card to render. On localhost the popup opens but
// the card silently drops. Once the hosted demo URL is live this renders
// correctly; Copy link works regardless.
const getShareUrl = (): string => {
  if (typeof window === 'undefined') {
    return ''
  }
  return window.location.href
}

const buildShareHref = ({
  kind,
  url,
  tweetText,
}: {
  kind: SocialKind
  url: string
  tweetText: string
}): string => {
  switch (kind) {
    case 'linkedin':
      // Modern endpoint; the legacy `shareArticle?mini=true&url=…` path has
      // been flaky since LinkedIn's 2023 migration.
      return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`
    case 'x.com':
      // Canonical `/intent/post` endpoint on x.com. URL is appended to the
      // text so X's preview picks it up as a link card (the separate
      // `&url=` param stopped rendering a card reliably post-rename).
      return `https://x.com/intent/post?text=${encodeURIComponent(`${tweetText} ${url}`)}`
    default:
      kind satisfies never
      throw new Error(`Unsupported social kind: ${String(kind)}`)
  }
}

type SocialButton = {
  kind: SocialKind
  label: string
  icon: ReactElement
  bgClass: string
}

export const SocialShare = (): ReactElement => {
  const { t } = useTranslation()
  const tweetText = t('chat.shareTweetText')
  const [isCopied, setIsCopied] = useState(false)
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleCopy = async (): Promise<void> => {
    if (typeof navigator === 'undefined' || navigator.clipboard === undefined) {
      return
    }
    try {
      await navigator.clipboard.writeText(getShareUrl())
    } catch {
      return
    }
    setIsCopied(true)
    if (resetTimerRef.current !== null) {
      clearTimeout(resetTimerRef.current)
    }
    resetTimerRef.current = setTimeout(() => {
      setIsCopied(false)
      resetTimerRef.current = null
    }, COPIED_RESET_MS)
  }

  const socials: SocialButton[] = [
    {
      kind: 'linkedin',
      label: 'LinkedIn',
      icon: <LinkedInIcon size={15} />,
      bgClass: 'bg-[#0a66c2] hover:bg-[#084d94]',
    },
    {
      kind: 'x.com',
      label: 'X',
      icon: <XTwitterIcon size={15} />,
      bgClass: 'bg-black hover:bg-slate-800',
    },
  ]

  return (
    <div>
      <p className="text-[13px] font-medium">{t('chat.shareCtaLabel')}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {socials.map((social) => (
          <button
            key={social.kind}
            type="button"
            onClick={() => {
              // Build the href at click time so the shared URL reflects
              // the user's current tab state (share, form, lang, etc.).
              const href = buildShareHref({
                kind: social.kind,
                url: getShareUrl(),
                tweetText,
              })
              window.open(href, 'popupwindow', 'scrollbars=yes,width=720,height=480')
            }}
            className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[14px] font-medium leading-none text-white transition ${social.bgClass}`}
          >
            <span className="flex items-center">{social.icon}</span>
            <span>{social.label}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            void handleCopy()
          }}
          aria-label={isCopied ? t('chat.shareCopied') : t('chat.shareCopyLink')}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 text-[14px] font-medium leading-none text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
        >
          <span className="flex items-center">
            <LinkIcon size={15} />
          </span>
          <span>{isCopied ? t('chat.shareCopied') : t('chat.shareCopyLink')}</span>
        </button>
      </div>
    </div>
  )
}
