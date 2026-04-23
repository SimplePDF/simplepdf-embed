import type { AnchorHTMLAttributes, ReactElement, ReactNode } from 'react'

type ExternalLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children'> & {
  href: string
  children: ReactNode
}

// Shared treatment for in-copy links (sky-600 → 700 hover with underline).
// External anchors get `target="_blank"` + `rel="noreferrer"` by default;
// callers can override any HTML attr they need.
export const ExternalLink = ({
  className,
  children,
  target = '_blank',
  rel = 'noreferrer',
  ...rest
}: ExternalLinkProps): ReactElement => {
  const classes = ['text-sky-600 hover:text-sky-700 hover:underline', className]
    .filter((segment): segment is string => typeof segment === 'string' && segment !== '')
    .join(' ')
  return (
    <a {...rest} target={target} rel={rel} className={classes}>
      {children}
    </a>
  )
}
