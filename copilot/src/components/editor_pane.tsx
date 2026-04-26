import { forwardRef } from 'react'

type EditorPaneProps = {
  editorSrc: string
  iframeKey: string
}

export const EditorPane = forwardRef<HTMLIFrameElement, EditorPaneProps>(({ editorSrc, iframeKey }, ref) => {
  return (
    <iframe
      ref={ref}
      key={iframeKey}
      title="SimplePDF editor"
      src={editorSrc}
      className="h-full w-full border-0"
      allow="clipboard-read; clipboard-write"
    />
  )
})

EditorPane.displayName = 'EditorPane'
