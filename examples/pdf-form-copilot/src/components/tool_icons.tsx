type ToolKind = 'read' | 'write'

const READING_TOOL_NAMES = new Set<string>(['get_fields', 'get_document_content', 'focus_field', 'go_to_page'])

export const getToolKind = (toolName: string): ToolKind => (READING_TOOL_NAMES.has(toolName) ? 'read' : 'write')

type ToolIconProps = {
  kind: ToolKind
  size?: number
}

export const ToolIcon = ({ kind, size = 14 }: ToolIconProps) => {
  if (kind === 'read') {
    return <ReadIcon size={size} />
  }
  return <WriteIcon size={size} />
}

const ReadIcon = ({ size }: { size: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    strokeWidth={1.6}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className="text-current"
  >
    <path d="M20 12V5.74853C20 5.5894 19.9368 5.43679 19.8243 5.32426L16.6757 2.17574C16.5632 2.06321 16.4106 2 16.2515 2H4.6C4.26863 2 4 2.26863 4 2.6V21.4C4 21.7314 4.26863 22 4.6 22H11" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8 10H16M8 6H12M8 14H11" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M20.5 20.5L22 22" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M15 18C15 19.6569 16.3431 21 18 21C18.8299 21 19.581 20.663 20.1241 20.1185C20.6654 19.5758 21 18.827 21 18C21 16.3431 19.6569 15 18 15C16.3431 15 15 16.3431 15 18Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M16 2V5.4C16 5.73137 16.2686 6 16.6 6H20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const WriteIcon = ({ size }: { size: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    strokeWidth={1.6}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className="text-current"
  >
    <path d="M20 12V5.74853C20 5.5894 19.9368 5.43679 19.8243 5.32426L16.6757 2.17574C16.5632 2.06321 16.4106 2 16.2515 2H4.6C4.26863 2 4 2.26863 4 2.6V21.4C4 21.7314 4.26863 22 4.6 22H11" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8 10H16M8 6H12M8 14H11" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M17.9541 16.9394L18.9541 15.9394C19.392 15.5015 20.102 15.5015 20.5399 15.9394C20.9778 16.3773 20.9778 17.0873 20.5399 17.5252L19.5399 18.5252M17.9541 16.9394L14.963 19.9305C14.8131 20.0804 14.7147 20.2741 14.6821 20.4835L14.4394 22.0399L15.9957 21.7973C16.2052 21.7646 16.3988 21.6662 16.5487 21.5163L19.5399 18.5252M17.9541 16.9394L19.5399 18.5252" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M16 2V5.4C16 5.73137 16.2686 6 16.6 6H20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
