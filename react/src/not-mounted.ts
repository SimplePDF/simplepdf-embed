import type { BridgeResult } from '@simplepdf/embed';

// Calls made before <EmbedPDF> mounts resolve to a real Result (not undefined), keeping
// the "every method returns a BridgeResult" contract uniform everywhere. Shared by the
// imperative actions (useEmbed) and the agentic tools (useEmbedTools); zod-free.
export const notMounted = (): Promise<BridgeResult<never>> =>
  Promise.resolve({
    success: false,
    error: {
      code: 'unexpected:iframe_not_mounted',
      message:
        'the editor is not mounted yet: attach embedRef to <EmbedPDF ref={embedRef} /> and call after it renders',
    },
  });
