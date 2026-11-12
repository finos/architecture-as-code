import { IoAppsOutline } from 'react-icons/io5';
import { ExtensionSummary } from '../model/extensions.js';
import { DiagramTab } from '../hub/components/diagram-section/tabs/diagramTabRegistry.js';
import { extensionContext } from '../hub/components/diagram-section/tabs/diagramTabs.js';
import { ExtensionSlot } from './ExtensionSlot.js';

/** The id prefix of an extension's diagram tab. Such a tab is registered only once the registry loads. */
export const EXTENSION_TAB_PREFIX = 'extension:';

/** One diagram tab for each `designer-tab` contribution. */
export function extensionTabs(extensions: ExtensionSummary[]): DiagramTab[] {
    return extensions.flatMap((extension) =>
        (extension.contributes['designer-tab'] ?? []).map(
            (contribution) =>
                ({
                    id: `${EXTENSION_TAB_PREFIX}${extension.id}:${contribution.id}`,
                    label: contribution.title,
                    icon: IoAppsOutline,
                    render: ({ data, selectedElement }) => (
                        <div className="h-full bg-base-200 overflow-auto p-4">
                            <ExtensionSlot
                                extension={extension}
                                contribution={contribution}
                                context={extensionContext(data, selectedElement)}
                                headingLevel={3}
                            />
                        </div>
                    ),
                }) satisfies DiagramTab
        )
    );
}
