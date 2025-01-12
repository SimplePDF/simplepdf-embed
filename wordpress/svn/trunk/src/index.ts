import { openEditor, closeEditor, config, setConfig } from './shared';
import type { SimplePDF } from './types';

export { SimplePDF };

window['simplePDF'] = window['simplePDF'] ?? {
  config,
  setConfig,
  openEditor,
  closeEditor,
  _ctx: {
    listenersMap: new Map(),
  },
};

const isScriptTagInvocation = typeof document !== 'undefined' && document.currentScript;

if (isScriptTagInvocation) {
  setConfig({ autoOpen: true });
}
