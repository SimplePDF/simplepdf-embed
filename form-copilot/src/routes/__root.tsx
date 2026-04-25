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
        title: 'Form Copilot by SimplePDF',
      },
      {
        name: 'description',
        content: 'Form Copilot: AI that helps users fill PDF forms step by step.',
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
