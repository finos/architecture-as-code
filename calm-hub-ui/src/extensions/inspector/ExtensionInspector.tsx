import { useId, useState } from 'react';
import type { ExtensionContext } from '../../model/extensions.js';
import type { ResourceExtension } from '../contributions.js';
import { ExtensionLogo } from '../ExtensionLogo.js';
import { SlotActiveContext } from '../slotActivity.js';
import { ExtensionInspectorSection } from './ExtensionInspectorSection.js';

interface ExtensionInspectorProps {
    entries: readonly ResourceExtension[];
    /** The extension on show. */
    activeId?: string;
    viewIds: ReadonlyMap<string, string>;
    context: ExtensionContext;
    /** The unique-id of the selected node, for the detail panels. */
    selectedNode?: string;
    /** The inspector shows an extension view. */
    shown: boolean;
}

function ExtensionPanel({ entry, viewId, context, selectedNode, shown }: { entry: ResourceExtension; viewId?: string; context: ExtensionContext; selectedNode?: string; shown: boolean }) {
    const headingId = useId();
    const { extension } = entry;
    return (
        <section hidden={!shown} aria-labelledby={headingId} data-testid="inspector-extension" data-extension={extension.id} className="flex flex-col gap-4">
            <div>
                <h2 id={headingId} className="text-lg font-semibold flex items-center gap-2 min-w-0">
                    <ExtensionLogo extension={extension} size={20} />
                    <span className="truncate">{extension.name}</span>
                </h2>
                {extension.provider && <p className="text-xs text-base-content/60">{extension.provider}</p>}
            </div>
            <ExtensionInspectorSection entry={entry} viewId={viewId} context={context} selectedNode={selectedNode} headingLevel={3} />
        </section>
    );
}

/**
 * The extensions of the inspector, one at a time. An extension mounts when it first shows, and stays mounted while
 * another shows, so the state of its slots, such as a table filter, stays. A hidden extension sends no request.
 */
export function ExtensionInspector({ entries, activeId, viewIds, context, selectedNode, shown }: ExtensionInspectorProps) {
    const [visited, setVisited] = useState<readonly string[]>([]);
    if (shown && activeId && entries.some((entry) => entry.extension.id === activeId) && !visited.includes(activeId)) {
        setVisited([...visited, activeId]);
    }
    return (
        <>
            {visited.map((id) => {
                const entry = entries.find((candidate) => candidate.extension.id === id);
                if (!entry) return null;
                const on = shown && id === activeId;
                return (
                    <SlotActiveContext.Provider key={id} value={on}>
                        <ExtensionPanel entry={entry} viewId={viewIds.get(id)} context={context} selectedNode={selectedNode} shown={on} />
                    </SlotActiveContext.Provider>
                );
            })}
        </>
    );
}
