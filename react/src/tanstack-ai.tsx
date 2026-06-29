// The TanStack AI agentic surface for @simplepdf/react-embed-pdf: the React mirror
// of @simplepdf/embed's /tanstack-ai subpath. Importing THIS module is what pulls
// @tanstack/ai (the only added peer), so a non-agentic app never loads it. Pair it
// with useEmbed():
//
//   const { embedRef } = useEmbed()
//   const tools = clientTools(...useEmbedTools(embedRef)) // from @tanstack/ai-react
//   useChat({ connection, tools })

import * as React from 'react';
import type { RefObject } from 'react';
import type { AnyClientTool } from '@tanstack/ai';
import { routeToolCall } from '@simplepdf/embed/tools';
import { simplePDFToolDefinitions } from '@simplepdf/embed/tanstack-ai';
import type { EmbedActions } from './embed-pdf';
import { notMounted } from './not-mounted';

// The server-side tool definitions are NOT re-exported here on purpose: this module
// imports React (for the hook), so re-exporting them would drag React into a server
// route that only needs the defs. Import those from the React-free core instead
// (`@simplepdf/embed/tanstack-ai`). Only the tool-name type (erased at build) is re-exported.
export type { SimplePDFToolName } from '@simplepdf/embed/tanstack-ai';

// The agentic tools bound to the live editor via useEmbed().embedRef. Stable and
// null-safe before the editor mounts (each .client() reads embedRef.current at call
// time). Pass to clientTools(...) -> useChat({ tools }).
export const useEmbedTools = (embedRef: RefObject<EmbedActions | null>): AnyClientTool[] =>
  React.useMemo<AnyClientTool[]>(
    () =>
      simplePDFToolDefinitions().map((definition) =>
        definition.client((input) =>
          embedRef.current === null ? notMounted() : routeToolCall(embedRef.current, definition.name, input),
        ),
      ),
    [embedRef],
  );
