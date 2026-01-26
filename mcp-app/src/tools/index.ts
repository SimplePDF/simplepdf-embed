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
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              action: 'LOAD_DOCUMENT',
              data: {
                data_url: parsed.data.url,
                name: parsed.data.name,
                page: parsed.data.page,
              },
            }),
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
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              action: 'CREATE_FIELD',
              data: parsed.data,
            }),
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
            text: JSON.stringify({
              action: 'GET_DOCUMENT_CONTENT',
              data: { extraction_mode: parsed.data.extraction_mode },
            }),
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
            text: JSON.stringify({
              action: 'GO_TO',
              data: { page: parsed.data.page },
            }),
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
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              action: 'SUBMIT',
              data: { download_copy: parsed.data.download_copy },
            }),
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
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              action: 'CLEAR_FIELDS',
              data: {
                field_ids: parsed.data.field_ids,
                page: parsed.data.page,
              },
            }),
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
