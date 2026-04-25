import { IS_DEMO_MODE } from '../../mode'
import { DownloadInput, SubmitInput } from './schemas'

// The single AI SDK tool that finalises the filled PDF. Demo mode (the
// SimplePDF-hosted copilot.simplepdf.com) exposes only `download`, which
// short-circuits through the host's upsell-aware handler. SimplePDF customer
// forks expose only `submit`, which fires the SimplePDF SUBMIT iframe event
// so the filled PDF lands in the customer's BYOS storage + webhook stack.
export type FinalisationToolMap =
  | { submit: { description: string; inputSchema: typeof SubmitInput } }
  | { download: { description: string; inputSchema: typeof DownloadInput } }

export const FINALISATION_TOOL: FinalisationToolMap = IS_DEMO_MODE
  ? {
      download: {
        description:
          'Finalizes the filled PDF and triggers an in-browser download for the user. Use only when the user asks to download.',
        inputSchema: DownloadInput,
      },
    }
  : {
      submit: {
        description:
          'Finalizes the filled PDF and submits it to the host application (storage, webhook, etc.). Use only when the user asks to submit or finalize.',
        inputSchema: SubmitInput,
      },
    }

// Merges the mode-appropriate finalisation tool into the caller's static
// tool map. The constraint `T & { submit?: never; download?: never }`
// prevents the static map from declaring a `submit` or `download` key —
// adding either becomes a compile error rather than a silent overwrite from
// the spread.
export const withFinalisationTool = <T extends Record<string, unknown>>(
  staticTools: T & { submit?: never; download?: never },
): T & FinalisationToolMap => ({
  ...staticTools,
  ...FINALISATION_TOOL,
})

export type FinalisationAction =
  | { toolName: 'submit'; verb: 'submit' }
  | { toolName: 'download'; verb: 'download' }

export const FINALISATION_ACTION: FinalisationAction = IS_DEMO_MODE
  ? { toolName: 'download', verb: 'download' }
  : { toolName: 'submit', verb: 'submit' }
