import type { Metadata } from 'next'
import type { ReactElement, ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
  title: 'JEV-based PDF form filling · SimplePDF',
  description:
    'Fill a PDF from a CSV with JEV (Typesafe): auto-fill the fields, raise low-confidence and validation issues, human signs off. Built on the SimplePDF editor.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode
}>): ReactElement {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
