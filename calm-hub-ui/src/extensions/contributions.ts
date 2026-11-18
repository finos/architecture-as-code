import { ExtensionContext, ExtensionContribution, ExtensionSummary } from '../model/extensions.js';
import { extensionRequest } from '../service/extension-service.js';

function canFill(extension: ExtensionSummary, contribution: ExtensionContribution, context: ExtensionContext): boolean {
    const route = extension.routes.find((entry) => entry.id === contribution.route);
    if (!route) return false;
    try {
        extensionRequest(extension.id, route, context);
        return true;
    } catch {
        return false;
    }
}

/** The actions that can run for this context: a path parameter the context does not give hides the action. */
export function actionContributions(extension: ExtensionSummary, context: ExtensionContext): ExtensionContribution[] {
    return (extension.contributes.action ?? []).filter((contribution) => canFill(extension, contribution, context));
}

/** The actions that wait for a selected element: none is selected, or the path rule refuses the selected id. */
export function selectionActions(extension: ExtensionSummary, context: ExtensionContext): ExtensionContribution[] {
    const selected = { ...context, selectedElement: 'selected-element' };
    return (extension.contributes.action ?? []).filter(
        (contribution) => !canFill(extension, contribution, context) && canFill(extension, contribution, selected)
    );
}

/**
 * The detail panels or landing cards for this context. One whose path needs a value that the context does not give is
 * left out. One without its route stays, so that its slot says so.
 */
export function slotContributions(
    extension: ExtensionSummary,
    point: 'detail-panel' | 'landing-card',
    context: ExtensionContext
): ExtensionContribution[] {
    return (extension.contributes[point] ?? []).filter(
        (contribution) => !extension.routes.some((route) => route.id === contribution.route) || canFill(extension, contribution, context)
    );
}

/** The path parameters that a resource context can give. extensions-test/designer-tab-params.json ties it to DESIGNER_TAB_PARAMS in ExtensionManifestLoader. */
export const TAB_PATH_PARAMETERS: ReadonlySet<string> = new Set(['namespace', 'resourceType', 'resourceId', 'version', 'selectedElement']);

/** A designer tab whose path needs a parameter that no context gives, such as {resource}, is hidden, not an error. */
export function tabContributions(extension: ExtensionSummary): ExtensionContribution[] {
    return (extension.contributes['designer-tab'] ?? []).filter((contribution) => {
        const route = extension.routes.find((entry) => entry.id === contribution.route);
        return route !== undefined && [...route.path.matchAll(/\{([^}]+)\}/g)].every(([, name]) => TAB_PATH_PARAMETERS.has(name));
    });
}

export interface ResourceExtension {
    extension: ExtensionSummary;
    actions: ExtensionContribution[];
    /** Actions that wait for a selected element. They keep the extension listed, so a change of selection does not hide the tab. */
    needsSelection: ExtensionContribution[];
    tabs: ExtensionContribution[];
    /** Designer tabs that wait for a selected element, as `needsSelection` does for actions. */
    tabsNeedSelection: ExtensionContribution[];
}

/** The extensions that show in a resource's Extensions tab: each with an action or a designer tab for it. */
export function resourceExtensions(extensions: readonly ExtensionSummary[], context: ExtensionContext): ResourceExtension[] {
    const selected = { ...context, selectedElement: 'selected-element' };
    return extensions
        .map((extension) => {
            const allTabs = tabContributions(extension);
            const tabsNeedSelection = allTabs.filter(
                (contribution) => !canFill(extension, contribution, context) && canFill(extension, contribution, selected)
            );
            return {
                extension,
                actions: actionContributions(extension, context),
                needsSelection: selectionActions(extension, context),
                tabs: allTabs.filter((contribution) => !tabsNeedSelection.includes(contribution)),
                tabsNeedSelection,
            };
        })
        .filter(
            ({ actions, needsSelection, tabs, tabsNeedSelection }) =>
                actions.length + needsSelection.length + tabs.length + tabsNeedSelection.length > 0
        );
}

export const screenPath = (extension: ExtensionSummary, contribution: ExtensionContribution) =>
    `/extensions/${encodeURIComponent(extension.id)}/${encodeURIComponent(contribution.id)}`;

/** The chat provider that the operator selected, as the registry names it. */
export interface ChatSelection {
    extension: string;
    contribution: Pick<ExtensionContribution, 'id' | 'title'>;
}

export interface ExtensionNavLink {
    key: string;
    title: string;
    to: string;
}

/**
 * The top-level pages of an extension: its screens in manifest order, then the chat if it is the selected chat
 * provider. Its menu group and its home page card show this list, so both have the same labels in the same order.
 */
export function extensionNavLinks(extension: ExtensionSummary, chat?: ChatSelection): ExtensionNavLink[] {
    const links = (extension.contributes.screen ?? []).map((contribution) => ({
        key: `screen/${contribution.id}`,
        title: contribution.title,
        to: screenPath(extension, contribution),
    }));
    if (chat?.extension === extension.id) {
        links.push({ key: `chat/${chat.contribution.id}`, title: chat.contribution.title, to: '/chat' });
    }
    return links;
}
