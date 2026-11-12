import { useExtensions } from '../ExtensionsContext.js';
import { ExtensionContext } from '../../model/extensions.js';
import { ExtensionSlot } from '../ExtensionSlot.js';
import { ExtensionSections } from './ExtensionSections.js';
import { Section } from '../../visualizer/components/sidebar/detail-components.js';

export const DETAIL_PANEL_SECTIONS_KEY = 'calm-hub-extension-panels';

/** The Extensions section of the node details: one collapsible sub-section per extension with a detail panel. */
export function ExtensionDetailPanels({ context, storage }: { context: ExtensionContext; storage?: Storage }) {
    const extensions = useExtensions().filter((extension) => (extension.contributes['detail-panel'] ?? []).length > 0);
    if (extensions.length === 0) return null;
    return (
        <Section title="Extensions">
            <ExtensionSections
                compact
                headingLevel={5}
                storageKey={DETAIL_PANEL_SECTIONS_KEY}
                storage={storage}
                sections={extensions.map((extension) => ({
                    id: extension.id,
                    title: extension.name,
                    content: () =>
                        extension.contributes['detail-panel']!.map((contribution) => (
                            <ExtensionSlot
                                key={contribution.id}
                                extension={extension}
                                contribution={contribution}
                                context={context}
                                headingLevel={6}
                            />
                        )),
                }))}
            />
        </Section>
    );
}
