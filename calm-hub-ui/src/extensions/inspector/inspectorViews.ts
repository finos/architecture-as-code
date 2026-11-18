import type { ExtensionContribution } from '../../model/extensions.js';
import type { ResourceExtension } from '../contributions.js';

export interface InspectorView {
    id: string;
    title: string;
    point: 'designer-tab' | 'detail-panel';
    contribution: ExtensionContribution;
}

/** Resource views, then node views, in manifest order within each kind. */
export function inspectorViews(entry: ResourceExtension): InspectorView[] {
    const tabs = (entry.extension.contributes['designer-tab'] ?? []).filter(
        (contribution) => entry.tabs.includes(contribution) || entry.tabsNeedSelection.includes(contribution)
    );
    return [
        ...tabs.map((contribution): InspectorView => ({
            id: `designer-tab:${contribution.id}`,
            title: contribution.title,
            point: 'designer-tab',
            contribution,
        })),
        ...entry.panels.map((contribution): InspectorView => ({
            id: `detail-panel:${contribution.id}`,
            title: contribution.title,
            point: 'detail-panel',
            contribution,
        })),
    ];
}
