import {
  type DynamicToolUIPart,
  getToolName,
  isTextUIPart,
  isToolUIPart,
  type ToolUIPart,
  type UIMessage,
} from 'ai'
import type { ReactElement } from 'react'
import ReactMarkdown from 'react-markdown'
import { ToolInvocationGroup, type ToolInvocationPart } from './tool_invocation_group'

type ChatLLMMessageProps = {
  message: UIMessage
}

// The AI SDK's tool-part state union is wider than what
// ToolInvocationGroup renders today: the SDK adds approval-requested /
// approval-responded / output-denied for tools that go through the
// approval flow. Form Copilot doesn't use approvals, so those states
// never arrive at runtime, but the type system needs us to handle them
// to compile. Mapping: in-flight approvals fold into "input-available"
// (still running, waiting for human input), denials fold into
// "output-error" (the tool didn't produce output for the LLM to consume).
const toRenderableState = (
  state: ToolUIPart['state'] | DynamicToolUIPart['state'],
): ToolInvocationPart['state'] => {
  switch (state) {
    case 'input-streaming':
    case 'input-available':
    case 'output-available':
    case 'output-error':
      return state
    case 'approval-requested':
    case 'approval-responded':
      return 'input-available'
    case 'output-denied':
      return 'output-error'
    default:
      state satisfies never
      return 'input-streaming'
  }
}

// A single LLM turn is split into render blocks: text segments and
// contiguous runs of tool invocations. Adjacent tool calls collapse into
// one ToolInvocationGroup so a multi-tool turn (get_fields → set_field
// → focus_field) renders as a single grouped card instead of three
// separate ones.
type RenderBlock =
  | { kind: 'text'; key: string; text: string }
  | { kind: 'tool-group'; key: string; parts: ToolInvocationPart[] }

const toBlocks = (message: UIMessage): RenderBlock[] => {
  const blocks: RenderBlock[] = []
  message.parts.forEach((part, index) => {
    const key = `${message.id}_${index}`
    if (isTextUIPart(part)) {
      blocks.push({ kind: 'text', key, text: part.text })
      return
    }
    if (isToolUIPart(part)) {
      const entry: ToolInvocationPart = {
        key,
        toolName: getToolName(part),
        state: toRenderableState(part.state),
      }
      const last = blocks[blocks.length - 1]
      if (last !== undefined && last.kind === 'tool-group') {
        last.parts.push(entry)
        return
      }
      blocks.push({ kind: 'tool-group', key, parts: [entry] })
    }
  })
  return blocks
}

// Left-aligned slate-100 bubble for assistant turns. Owns the text +
// tool-invocation rendering and the per-LLM accent styling (sky-700
// strong text). Extra right padding (pr-5) so the text doesn't crowd
// the bubble's rounded edge.
export const ChatLLMMessage = ({ message }: ChatLLMMessageProps): ReactElement => {
  const blocks = toBlocks(message)
  return (
    <div className="flex justify-start">
      <div className="min-w-[296px] max-w-full rounded-[22px] bg-slate-100 py-2 pl-3 pr-5 text-sm leading-relaxed text-slate-900">
        {blocks.map((block) => {
          if (block.kind === 'text') {
            return (
              <div
                key={block.key}
                className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0"
              >
                <ReactMarkdown
                  components={{
                    strong: ({ children }) => (
                      <strong className="font-semibold text-sky-700">{children}</strong>
                    ),
                  }}
                >
                  {block.text}
                </ReactMarkdown>
              </div>
            )
          }
          return <ToolInvocationGroup key={block.key} parts={block.parts} />
        })}
      </div>
    </div>
  )
}
