import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from '../utils/zod-to-json-schema.js';
import {
  DisplayPdfInput,
  AddAnnotationInput,
  ExtractContentInput,
  NavigatePageInput,
  SubmitDocumentInput,
  ClearAnnotationsInput,
} from './types.js';

export const toolDefinitions: Tool[] = [
  {
    name: 'display_pdf',
    description:
      'Load and display a PDF document in the SimplePDF editor. The editor will be shown in the UI where users can view and interact with the document.',
    inputSchema: zodToJsonSchema(DisplayPdfInput),
  },
  {
    name: 'add_annotation',
    description:
      'Add an annotation (text, checkbox, signature, or picture) to the PDF document at a specific position.',
    inputSchema: zodToJsonSchema(AddAnnotationInput),
  },
  {
    name: 'extract_content',
    description:
      'Extract text content from the loaded PDF document. Returns the text content of each page.',
    inputSchema: zodToJsonSchema(ExtractContentInput),
  },
  {
    name: 'navigate_page',
    description: 'Navigate to a specific page in the PDF document.',
    inputSchema: zodToJsonSchema(NavigatePageInput),
  },
  {
    name: 'submit_document',
    description:
      'Submit the document with all annotations. Optionally triggers a download of the filled PDF.',
    inputSchema: zodToJsonSchema(SubmitDocumentInput),
  },
  {
    name: 'clear_annotations',
    description:
      'Clear annotations from the document. Can clear all annotations or specific ones by ID or page.',
    inputSchema: zodToJsonSchema(ClearAnnotationsInput),
  },
];

type ToolCallResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

export const handleToolCall = (
  name: string,
  args: Record<string, unknown> | undefined
): ToolCallResult => {
  switch (name) {
    case 'display_pdf': {
      const parsed = DisplayPdfInput.safeParse(args);
      if (!parsed.success) {
        return {
          content: [{ type: 'text', text: `Invalid arguments: ${parsed.error.message}` }],
          isError: true,
        };
      }
      const editorUrl = `https://embed.simplepdf.com/editor?open=${encodeURIComponent(parsed.data.url)}`;
      return {
        content: [
          {
            type: 'text',
            text: `PDF ready to view in SimplePDF Editor.\n\nDocument: ${parsed.data.name ?? parsed.data.url}\nEditor URL: ${editorUrl}\n\nOpen this URL in a browser to view and edit the PDF, or use the SimplePDF embed in your application.`,
          },
        ],
      };
    }

    case 'add_annotation': {
      const parsed = AddAnnotationInput.safeParse(args);
      if (!parsed.success) {
        return {
          content: [{ type: 'text', text: `Invalid arguments: ${parsed.error.message}` }],
          isError: true,
        };
      }
      const valueInfo = parsed.data.value ? ` with value "${parsed.data.value}"` : '';
      return {
        content: [
          {
            type: 'text',
            text: `Annotation instruction created.\n\nType: ${parsed.data.type}\nPage: ${parsed.data.page}\nPosition: (${parsed.data.x}, ${parsed.data.y})\nSize: ${parsed.data.width}x${parsed.data.height}${valueInfo}\n\nThis annotation will be added when the document is loaded in SimplePDF Editor.`,
          },
        ],
      };
    }

    case 'extract_content': {
      const parsed = ExtractContentInput.safeParse(args);
      if (!parsed.success) {
        return {
          content: [{ type: 'text', text: `Invalid arguments: ${parsed.error.message}` }],
          isError: true,
        };
      }
      return {
        content: [
          {
            type: 'text',
            text: `Content extraction requested.\n\nMode: ${parsed.data.extraction_mode}\n\nNote: Content extraction requires the document to be loaded in the SimplePDF Editor. The text content of each page will be returned once the document is processed.`,
          },
        ],
      };
    }

    case 'navigate_page': {
      const parsed = NavigatePageInput.safeParse(args);
      if (!parsed.success) {
        return {
          content: [{ type: 'text', text: `Invalid arguments: ${parsed.error.message}` }],
          isError: true,
        };
      }
      return {
        content: [
          {
            type: 'text',
            text: `Navigation instruction created.\n\nTarget page: ${parsed.data.page}\n\nThe editor will navigate to this page when the instruction is executed.`,
          },
        ],
      };
    }

    case 'submit_document': {
      const parsed = SubmitDocumentInput.safeParse(args);
      if (!parsed.success) {
        return {
          content: [{ type: 'text', text: `Invalid arguments: ${parsed.error.message}` }],
          isError: true,
        };
      }
      const downloadInfo = parsed.data.download_copy ? 'A copy will be downloaded to your device.' : '';
      return {
        content: [
          {
            type: 'text',
            text: `Document submission requested.\n\n${downloadInfo}\n\nThe document with all annotations will be submitted when this instruction is executed in the SimplePDF Editor.`,
          },
        ],
      };
    }

    case 'clear_annotations': {
      const parsed = ClearAnnotationsInput.safeParse(args);
      if (!parsed.success) {
        return {
          content: [{ type: 'text', text: `Invalid arguments: ${parsed.error.message}` }],
          isError: true,
        };
      }
      const scopeInfo = (() => {
        if (parsed.data.field_ids && parsed.data.field_ids.length > 0) {
          return `Specific fields: ${parsed.data.field_ids.join(', ')}`;
        }
        if (parsed.data.page) {
          return `All fields on page ${parsed.data.page}`;
        }
        return 'All fields in the document';
      })();
      return {
        content: [
          {
            type: 'text',
            text: `Clear annotations requested.\n\nScope: ${scopeInfo}\n\nThe specified annotations will be removed when this instruction is executed.`,
          },
        ],
      };
    }

    default:
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
};
