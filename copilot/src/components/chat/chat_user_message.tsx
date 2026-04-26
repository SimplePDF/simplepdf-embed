import { isTextUIPart, type UIMessage } from 'ai'
import type { ReactElement } from 'react'
import ReactMarkdown from 'react-markdown'

type ChatUserMessageProps = {
  message: UIMessage
}

// Right-aligned sky-600 bubble for user input. User messages are
// text-only by construction (the input field only emits text parts), so
// this component ignores any other part shape that might arrive on the
// wire. Tool invocations and tool-group rendering live in
// ChatLLMMessage.
export const ChatUserMessage = ({ message }: ChatUserMessageProps): ReactElement | null => {
  const text = message.parts
    .filter(isTextUIPart)
    .map((part) => part.text)
    .join('\n\n')
  if (text === '') {
    return null
  }
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-[22px] bg-sky-600 px-3 py-2 text-sm leading-relaxed text-white">
        <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0">
          <ReactMarkdown
            components={{
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
            }}
          >
            {text}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  )
}
