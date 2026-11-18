import { ExtensionSummary } from '../../model/extensions.js';
import { ExtensionsStatus } from '../../extensions/ExtensionsContext.js';
import { UiConfigStatus } from '../ui-config/ui-config-status.js';

const EXTENSION_SCREEN = /^\/extensions\/([^/]+)\/([^/]+)$/;

interface StartPageState {
    configStatus: UiConfigStatus;
    extensions: readonly ExtensionSummary[];
    extensionsStatus: ExtensionsStatus;
    chatAvailable: boolean;
}

/**
 * Where Hub opens: the operator's start page, `undefined` to stay on the overview, or `pending` until it is known. An
 * extension screen or chat that the registry does not list, because it is disabled or the registry failed, falls back
 * to the overview.
 */
export function startPageTarget(startPage: string | undefined, state: StartPageState): string | undefined | 'pending' {
    if (state.configStatus === 'loading') return 'pending';
    if (!startPage || startPage === '/') return undefined;
    const screen = EXTENSION_SCREEN.exec(startPage);
    if (!screen && startPage !== '/chat') return startPage;
    if (state.extensionsStatus === 'loading') return 'pending';
    if (state.extensionsStatus !== 'loaded') return undefined;
    if (!screen) return state.chatAvailable ? startPage : undefined;
    const [, extensionId, screenId] = screen;
    const extension = state.extensions.find((entry) => entry.id === extensionId);
    return extension?.contributes.screen?.some((contribution) => contribution.id === screenId) ? startPage : undefined;
}
