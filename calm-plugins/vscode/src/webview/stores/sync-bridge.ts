import type { ExtToWebviewMessage } from '../../extension/types/messages';
import { postMessage } from '../vscode-api';

type ModelUpdateCallback = (
    json: string,
    source: 'file' | 'ai' | 'text-editor'
) => void;
type PatternsLoadedCallback = (patterns: unknown[]) => void;
type TemplatesLoadedCallback = (templates: unknown[]) => void;
type BuildingBlocksLoadedCallback = (nodes: unknown[]) => void;
type StandardsLoadedCallback = (standards: unknown[]) => void;
type StandardProseCallback = (url: string, prose: string) => void;
type DrillResultCallback = (
    json: string,
    label: string,
    filePath: string,
    readonly?: boolean,
    solution?: unknown
) => void;

let modelUpdateCallback: ModelUpdateCallback | undefined;
let patternsLoadedCallback: PatternsLoadedCallback | undefined;
let templatesLoadedCallback: TemplatesLoadedCallback | undefined;
let buildingBlocksLoadedCallback: BuildingBlocksLoadedCallback | undefined;
let standardsLoadedCallback: StandardsLoadedCallback | undefined;
let standardProseCallback: StandardProseCallback | undefined;
let drillResultCallback: DrillResultCallback | undefined;

export function setModelUpdateCallback(cb: ModelUpdateCallback): void {
    modelUpdateCallback = cb;
}
export function setPatternsLoadedCallback(cb: PatternsLoadedCallback): void {
    patternsLoadedCallback = cb;
}
export function setTemplatesLoadedCallback(cb: TemplatesLoadedCallback): void {
    templatesLoadedCallback = cb;
}
export function setBuildingBlocksLoadedCallback(
    cb: BuildingBlocksLoadedCallback
): void {
    buildingBlocksLoadedCallback = cb;
}
export function setStandardsLoadedCallback(cb: StandardsLoadedCallback): void {
    standardsLoadedCallback = cb;
}
export function setStandardProseCallback(cb: StandardProseCallback): void {
    standardProseCallback = cb;
}
export function setDrillResultCallback(cb: DrillResultCallback): void {
    drillResultCallback = cb;
}

export function initBridge(): void {
    window.addEventListener(
        'message',
        (event: MessageEvent<ExtToWebviewMessage>) => {
            const msg = event.data;
            switch (msg.type) {
                case 'modelUpdated':
                    modelUpdateCallback?.(msg.json, msg.source);
                    break;
                case 'patternsLoaded':
                    patternsLoadedCallback?.(msg.patterns);
                    break;
                case 'templatesLoaded':
                    templatesLoadedCallback?.(msg.templates);
                    break;
                case 'buildingBlocksLoaded':
                    buildingBlocksLoadedCallback?.(msg.nodes);
                    break;
                case 'standardsLoaded':
                    standardsLoadedCallback?.(msg.standards);
                    break;
                case 'standardProse':
                    standardProseCallback?.(msg.url, msg.prose);
                    break;
                case 'drillResult':
                    drillResultCallback?.(
                        msg.json,
                        msg.label,
                        msg.filePath,
                        msg.readonly,
                        msg.solution
                    );
                    break;
            }
        }
    );

    postMessage({ type: 'ready' });
}

export function notifyCanvasChanged(json: string): void {
    postMessage({ type: 'canvasChanged', json });
}

export function notifyDrillInto(
    label: string,
    path: string,
    calmType: string
): void {
    postMessage({ type: 'drillInto', label, path, calmType });
}

export function notifyDrillUp(
    index: number,
    filePath?: string,
    readonly?: boolean
): void {
    postMessage({ type: 'drillUp', index, filePath, readonly });
}

export function requestStandardProse(url: string): void {
    postMessage({ type: 'requestStandardProse', url });
}

export function notifyRequestGenerateSpec(): void {
    postMessage({ type: 'requestGenerateSpec' });
}

export function notifySaveBuildingBlock(
    filename: string,
    content: string
): void {
    postMessage({ type: 'saveBuildingBlock', filename, content });
}
