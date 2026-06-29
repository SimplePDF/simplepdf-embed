// The TanStack AI agentic surface for @simplepdf/react-embed-pdf: the React mirror
// of @simplepdf/embed's /tanstack-ai subpath. Importing THIS module is what pulls
// @tanstack/ai (the only added peer), so a non-agentic app never loads it. Pair it
// with useEmbed():
//
//   const { embedRef } = useEmbed()
//   const tools = clientTools(...useEmbedTanstackTools(embedRef)) // from @tanstack/ai-react
//   useChat({ connection, tools })

import * as React from 'react';
import type { RefObject } from 'react';
import type { AnyClientTool } from '@tanstack/ai';
import { routeToolCall } from '@simplepdf/embed/tools';
import { simplePDFTanstackToolDefinitions } from '@simplepdf/embed/tanstack-ai';
import type { EmbedActions } from './embed-pdf';
import { notMounted } from './not-mounted';

// Re-export the server-side definitions + the tool-name type so React consumers get
// the whole TanStack surface from this one subpath (mirroring /ai-sdk).
export { simplePDFTanstackToolDefinitions } from '@simplepdf/embed/tanstack-ai';
export type { SimplePDFToolName } from '@simplepdf/embed/tanstack-ai';

// The agentic tools bound to the live editor via useEmbed().embedRef. Stable and
// null-safe before the editor mounts (each .client() reads embedRef.current at call
// time). Pass to clientTools(...) -> useChat({ tools }).
export const useEmbedTanstackTools = (embedRef: RefObject<EmbedActions | null>): AnyClientTool[] =>
  React.useMemo<AnyClientTool[]>(
    () =>
      simplePDFTanstackToolDefinitions().map((definition) =>
        definition.client((input) =>
          embedRef.current === null ? notMounted() : routeToolCall(embedRef.current, definition.name, input),
        ),
      ),
    [embedRef],
  );
