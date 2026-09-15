import type { ExtToWebviewMessage } from '../../extension/types/messages';
import type { ControlBrowseGroup } from '../../extension/services/control-asset-service';
import type { ParsedRequirement } from '../../extension/services/requirement-parser';
import { postMessage } from '../vscode-api';

// --- Correlated request/response result shapes (mirror the discriminated
// unions in messages.ts, minus the transport `type`/`requestId` fields). ---
export type ControlBrowseResult =
    | { ok: true; groups: ControlBrowseGroup[] }
    | { ok: false; error: string };
export type ControlDomainResult =
    | { ok: true; group: ControlBrowseGroup }
    | { ok: false; error: string };
export type ControlVersionsResult =
    | { ok: true; versions: string[] }
    | { ok: false; error: string };
export type ControlResolveResult =
    | { ok: true; parsed: ParsedRequirement; warnings: string[] }
    | { ok: false; error: string };
export type SaveControlResult = { ok: true } | { ok: false; error: string };

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
type DefinitionResolvedCallback = (
    nodeId: string,
    controls: Record<string, unknown>
) => void;
type DefinitionResolutionFailedCallback = (
    nodeId: string,
    error: string
) => void;
type UpdatesAvailableCallback = (
    updates: Array<{ nodeId: string; currentSha: string; latestSha: string }>
) => void;

let modelUpdateCallback: ModelUpdateCallback | undefined;
let patternsLoadedCallback: PatternsLoadedCallback | undefined;
let templatesLoadedCallback: TemplatesLoadedCallback | undefined;
let buildingBlocksLoadedCallback: BuildingBlocksLoadedCallback | undefined;
let standardsLoadedCallback: StandardsLoadedCallback | undefined;
let standardProseCallback: StandardProseCallback | undefined;
let drillResultCallback: DrillResultCallback | undefined;
let definitionResolvedCallback: DefinitionResolvedCallback | undefined;
let definitionResolutionFailedCallback: DefinitionResolutionFailedCallback | undefined;
let updatesAvailableCallback: UpdatesAvailableCallback | undefined;

type ControlsChangedCallback = () => void;
let controlsChangedCallback: ControlsChangedCallback | undefined;

// --- Correlation infrastructure for control request/response messages. ---
type PendingResolver = (msg: ExtToWebviewMessage) => void;
const pending = new Map<
    string,
    { resolve: PendingResolver; timer: ReturnType<typeof setTimeout> }
>();
let requestCounter = 0;
const REQUEST_TIMEOUT_MS = 15000;

function nextRequestId(): string {
    requestCounter += 1;
    return `req-${Date.now()}-${requestCounter}`;
}

function registerPending(
    requestId: string,
    resolve: PendingResolver,
    onTimeout: () => void
): void {
    const timer = setTimeout(() => {
        pending.delete(requestId);
        onTimeout();
    }, REQUEST_TIMEOUT_MS);
    pending.set(requestId, { resolve, timer });
}

function settlePending(requestId: string, msg: ExtToWebviewMessage): void {
    const entry = pending.get(requestId);
    if (!entry) return;
    clearTimeout(entry.timer);
    pending.delete(requestId);
    entry.resolve(msg);
}

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
export function setDefinitionResolvedCallback(
    cb: DefinitionResolvedCallback
): void {
    definitionResolvedCallback = cb;
}
export function setDefinitionResolutionFailedCallback(
    cb: DefinitionResolutionFailedCallback
): void {
    definitionResolutionFailedCallback = cb;
}
export function setUpdatesAvailableCallback(
    cb: UpdatesAvailableCallback
): void {
    updatesAvailableCallback = cb;
}

export function setControlsChangedCallback(cb: ControlsChangedCallback): void {
    controlsChangedCallback = cb;
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
                case 'definitionResolved':
                    definitionResolvedCallback?.(msg.nodeId, msg.controls);
                    break;
                case 'definitionResolutionFailed':
                    definitionResolutionFailedCallback?.(msg.nodeId, msg.error);
                    break;
                case 'updatesAvailable':
                    updatesAvailableCallback?.(msg.updates);
                    break;
                case 'controlsChanged':
                    controlsChangedCallback?.();
                    break;
                case 'controlBrowseResult':
                case 'controlDomainResult':
                case 'controlVersionsResult':
                case 'controlResolveResult':
                case 'saveControlResult':
                    settlePending(msg.requestId, msg);
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

export function notifyRequestImportSvg(): void {
    postMessage({ type: 'requestImportSvg' });
}

// --- Correlated control request functions. Each generates a requestId, stores
// the callback, and cleans up on response or timeout. ---

export function requestControlBrowse(
    callback: (result: ControlBrowseResult) => void
): void {
    const requestId = nextRequestId();
    registerPending(
        requestId,
        (msg) => {
            if (msg.type !== 'controlBrowseResult') return;
            callback(
                msg.ok
                    ? { ok: true, groups: msg.groups }
                    : { ok: false, error: msg.error }
            );
        },
        () => callback({ ok: false, error: 'timeout' })
    );
    postMessage({ type: 'requestControlBrowse', requestId });
}

export function requestControlsForDomain(
    domain: string,
    callback: (result: ControlDomainResult) => void
): void {
    const requestId = nextRequestId();
    registerPending(
        requestId,
        (msg) => {
            if (msg.type !== 'controlDomainResult') return;
            callback(
                msg.ok
                    ? { ok: true, group: msg.group }
                    : { ok: false, error: msg.error }
            );
        },
        () => callback({ ok: false, error: 'timeout' })
    );
    postMessage({ type: 'requestControlsForDomain', requestId, domain });
}

export function requestControlVersions(
    domain: string,
    controlName: string,
    callback: (result: ControlVersionsResult) => void
): void {
    const requestId = nextRequestId();
    registerPending(
        requestId,
        (msg) => {
            if (msg.type !== 'controlVersionsResult') return;
            callback(
                msg.ok
                    ? { ok: true, versions: msg.versions }
                    : { ok: false, error: msg.error }
            );
        },
        () => callback({ ok: false, error: 'timeout' })
    );
    postMessage({
        type: 'requestControlVersions',
        requestId,
        domain,
        controlName,
    });
}

export function requestControlResolve(
    ref: string,
    callback: (result: ControlResolveResult) => void
): void {
    const requestId = nextRequestId();
    registerPending(
        requestId,
        (msg) => {
            if (msg.type !== 'controlResolveResult') return;
            callback(
                msg.ok
                    ? { ok: true, parsed: msg.parsed, warnings: msg.warnings }
                    : { ok: false, error: msg.error }
            );
        },
        () => callback({ ok: false, error: 'timeout' })
    );
    postMessage({ type: 'requestControlResolve', requestId, ref });
}

export function requestSaveControl(
    filename: string,
    content: string,
    callback: (result: SaveControlResult) => void
): void {
    const requestId = nextRequestId();
    registerPending(
        requestId,
        (msg) => {
            if (msg.type !== 'saveControlResult') return;
            callback(msg.ok ? { ok: true } : { ok: false, error: msg.error });
        },
        () => callback({ ok: false, error: 'timeout' })
    );
    postMessage({ type: 'saveControl', requestId, filename, content });
}
