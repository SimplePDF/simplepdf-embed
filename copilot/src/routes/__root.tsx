import { TanStackDevtools } from '@tanstack/react-devtools'
import { createRootRoute, HeadContent, Scripts } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { useTranslation } from 'react-i18next'

import '../lib/i18n'
import appCss from '../styles.css?url'

// Opt-in via `VITE_ENABLE_DEVTOOLS=true`. Default off so production + shared
// demo environments never render the router / devtools panel.
const DEVTOOLS_ENABLED = import.meta.env.VITE_ENABLE_DEVTOOLS === 'true'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'SimplePDF Copilot',
      },
      {
        name: 'description',
        content: 'SimplePDF Copilot: AI that helps users fill PDF forms step by step.',
      },
      // Meta image lives on the SimplePDF CDN (DO Spaces, aliased to
      // cdn.simplepdf.com) so a fork doesn't have to host the asset
      // themselves and social-card crawlers always resolve an absolute URL.
      {
        property: 'og:image',
        content: 'https://cdn.simplepdf.com/simple-pdf/assets/meta/form-copilot-welcome.png',
      },
      {
        property: 'og:image:width',
        content: '2017',
      },
      {
        property: 'og:image:height',
        content: '1142',
      },
      {
        property: 'og:title',
        content: 'SimplePDF Copilot',
      },
      {
        property: 'og:description',
        content: 'AI that helps users fill PDF forms step by step.',
      },
      {
        property: 'og:type',
        content: 'website',
      },
      {
        name: 'twitter:card',
        content: 'summary_large_image',
      },
      {
        name: 'twitter:image',
        content: 'https://cdn.simplepdf.com/simple-pdf/assets/meta/form-copilot-welcome.png',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      {
        rel: 'icon',
        href: 'https://simplepdf.com/favicon.ico',
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const { i18n: i18nInstance } = useTranslation()
  return (
    <html lang={i18nInstance.language}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        {DEVTOOLS_ENABLED ? (
          <TanStackDevtools
            config={{
              position: 'bottom-right',
            }}
            plugins={[
              {
                name: 'Tanstack Router',
                render: <TanStackRouterDevtoolsPanel />,
              },
            ]}
          />
        ) : null}
        <Scripts />
      </body>
    </html>
  )
}
