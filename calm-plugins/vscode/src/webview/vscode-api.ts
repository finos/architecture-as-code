import type { WebviewToExtMessage } from '../extension/types/messages';

interface VsCodeApi {
  postMessage(message: WebviewToExtMessage): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

let api: VsCodeApi | undefined;

export function getVsCodeApi(): VsCodeApi {
  if (!api) {
    api = acquireVsCodeApi();
  }
  return api;
}

export function postMessage(message: WebviewToExtMessage): void {
  getVsCodeApi().postMessage(message);
}
