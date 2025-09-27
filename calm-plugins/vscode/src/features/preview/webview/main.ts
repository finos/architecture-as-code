// src/webview/main.ts
import { WebviewViewModel } from './webview.view-model';
import { View } from './view';

// Access VS Code API if present; otherwise fall back to no-op poster.
const vscode =
    typeof window !== 'undefined' && typeof (window as any).acquireVsCodeApi === 'function'
        ? (window as any).acquireVsCodeApi()
        : { postMessage: (_: any) => { /* noop */ } }

// Error/log helpers
function postError(context: string, e: any) {
    try {
        const msg = `${context}: ${e?.message || e}`
        vscode.postMessage({ type: 'error', message: msg, stack: e?.stack })
    } catch { /* noop */ }
}

window.addEventListener('error', (ev) => {
    postError('Window error', (ev as any).error || (ev as any).message)
})

window.addEventListener('unhandledrejection', (ev: any) => {
    postError('Unhandled rejection', ev.reason)
})

// Initialize MVVM
const viewModel = new WebviewViewModel(vscode);
new View(viewModel);

// Initial data request
vscode.postMessage({ type: 'runDocify' });
