// Build-time mode flag derived from VITE_SIMPLEPDF_COMPANY_IDENTIFIER.
// `copilot` is the SimplePDF-hosted demo workspace; every other identifier is a
// SimplePDF customer running their own Form Copilot fork. The mode flips two
// surfaces: the LLM tool catalogue (download vs submit) and the toolbar button
// (Download vs Submit), so a customer deployment never exposes the demo-only
// in-browser download flow and instead routes finalisation through the real
// SimplePDF SUBMIT iframe event (which lands in the customer's BYOS storage
// + webhook stack).

const COPILOT_DEMO_IDENTIFIER = 'copilot'

const rawCompanyIdentifier =
  typeof import.meta.env.VITE_SIMPLEPDF_COMPANY_IDENTIFIER === 'string'
    ? import.meta.env.VITE_SIMPLEPDF_COMPANY_IDENTIFIER.trim()
    : ''

export type Mode = 'demo' | 'simplepdf_customer'

export const MODE: Mode = rawCompanyIdentifier === COPILOT_DEMO_IDENTIFIER ? 'demo' : 'simplepdf_customer'

export const IS_DEMO_MODE = MODE === 'demo'
