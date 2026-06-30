// The agentic surface for @simplepdf/react-embed-pdf: the React mirror of
// @simplepdf/embed's /tools + /ai-sdk subpaths. Importing THIS module (not the package
// root) is what pulls in `zod`, so a <EmbedPDF>-only app never loads it — the same
// pay-for-use contract the core has. Pair it with useEmbed():
//
//   const { embedRef } = useEmbed()
//   const tools = useEmbedTools(embedRef) // bound to the live editor
//   useChat({ tools })

import * as React from 'react';
import type { RefObject } from 'react';
import type { BridgeResult } from '@simplepdf/embed';
import { isSimplePDFToolName, routeToolCall, SIMPLEPDF_TOOLS, type SimplePDFToolName } from '@simplepdf/embed/tools';
import type { EmbedActions } from './embed-pdf';
import { notMounted } from './not-mounted';

// Re-export the browser-side executor + the tool-name guard for React consumers. The
// server-side `simplePDFToolDefinitions` is deliberately NOT re-exported: this module
// imports React (for the hook), so re-exporting the defs would pull React into a server
// `streamText` route. Import those from the React-free core `@simplepdf/embed/ai-sdk`.
export { createSimplePDFExecutor } from '@simplepdf/embed/ai-sdk';
export { isSimplePDFToolName };
export type { SimplePDFToolName };

type ToolInputSchema = (typeof SIMPLEPDF_TOOLS)[SimplePDFToolName]['inputSchema'];

// One agentic tool, bound to the live editor. The shape ({ description, inputSchema,
// execute }) is exactly what the AI SDK consumes, so the whole `tools` record drops
// straight into useChat({ tools }) / streamText — no executor to wire.
export type EmbedTool = {
  description: string;
  inputSchema: ToolInputSchema;
  execute: (input: unknown) => Promise<BridgeResult<unknown>>;
};

// Record<string, …> (not Record<SimplePDFToolName, …>) matches the AI SDK's string-keyed
// `tools` param. A literal-keyed Record can't be built here without an `as` cast (Object
// .fromEntries / reduce both erase the key type), and `Partial<Record<…>>` would break that
// AI-SDK assignability — so the registry stays string-keyed (it is complete at runtime).
export type EmbedTools = Record<string, EmbedTool>;

// The agentic registry bound to the live editor via useEmbed().embedRef. Stable and
// null-safe before the editor mounts (each `execute` reads embedRef.current at call time).
export const useEmbedTools = (embedRef: RefObject<EmbedActions | null>): EmbedTools =>
  React.useMemo<EmbedTools>(
    () =>
      Object.keys(SIMPLEPDF_TOOLS)
        .filter(isSimplePDFToolName)
        .reduce<EmbedTools>((accumulator, name) => {
          accumulator[name] = {
            description: SIMPLEPDF_TOOLS[name].description,
            inputSchema: SIMPLEPDF_TOOLS[name].inputSchema,
            execute: (input) =>
              embedRef.current === null ? notMounted() : routeToolCall(embedRef.current, name, input),
          };
          return accumulator;
        }, {}),
    [embedRef],
  );
