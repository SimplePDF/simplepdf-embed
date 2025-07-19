import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SimplePDF - Custom Sidebar Demo',
  description: 'This example showcases the programmatic control of the editor together with custom sidebar design. Available under the PRO plan',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
