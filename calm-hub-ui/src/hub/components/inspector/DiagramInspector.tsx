import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { IoChevronBackOutline } from 'react-icons/io5';
import type { CalmNodeSchema, CalmRelationshipSchema } from '@finos/calm-models/types';
import type { Data } from '../../../model/calm.js';
import type { ExtensionContext } from '../../../model/extensions.js';
import { useExtensions, useExtensionsStatus } from '../../../extensions/ExtensionsContext.js';
import { resourceExtensions } from '../../../extensions/contributions.js';
import { ExtensionInspector } from '../../../extensions/inspector/ExtensionInspector.js';
import { inspectorViews } from '../../../extensions/inspector/inspectorViews.js';
import { ChatEntryLink } from '../../../extensions/chat/ChatEntryLink.js';
import { ElementDetails } from '../../../visualizer/components/sidebar/ElementDetails.js';
import { isCALMNode } from '../../../visualizer/components/sidebar/calm-type-guards.js';
import { CloseButton } from '../../../visualizer/components/sidebar/CloseButton.js';
import { InspectorMenu } from './InspectorMenu.js';
import { INSPECTOR_ID, inspectorPanelId, type InspectorTab } from './inspectorIds.js';
import { ResourceDetails } from './ResourceDetails.js';

interface DiagramInspectorProps {
    data: Data;
    displayName?: string;
    selected?: CalmNodeSchema | CalmRelationshipSchema;
    /** The resource, with the selected element. Null for a dropped file, which has no resource. */
    context: ExtensionContext | null;
    /** A closed inspector keeps its extension slots mounted, hidden, so their state stays. */
    open: boolean;
    tab: InspectorTab;
    /** The extension that the user or a link chose. An empty value means the first one. */
    extensionId?: string;
    /** Move focus to the view selector when the user opens the inspector. */
    focusOnOpen: boolean;
    onFocused: () => void;
    onSelectTab: (tab: InspectorTab, extensionId?: string) => void;
    /** Absent on a narrow screen, where the inspector has its own way back to the diagram. */
    onClose?: () => void;
    onClearSelection: () => void;
}

function selectionName(selected: CalmNodeSchema | CalmRelationshipSchema) {
    return (isCALMNode(selected) && selected.name) || selected.description || selected['unique-id'];
}

/**
 * The details of the selection or the resource, and the extensions of the resource, beside the diagram. The diagram
 * stays mounted while the inspector opens and closes, so its viewport and selection stay.
 */
export function DiagramInspector(props: DiagramInspectorProps) {
    const { data, displayName, selected, context, open, tab, extensionId, focusOnOpen, onFocused, onSelectTab, onClose, onClearSelection } =
        props;
    const status = useExtensionsStatus();
    const entries = resourceExtensions(useExtensions(), context ?? {});
    const shown = context ? entries : [];
    const active = shown.find((entry) => entry.extension.id === extensionId) ?? (extensionId ? undefined : shown[0]);
    const [viewIds, setViewIds] = useState<ReadonlyMap<string, string>>(new Map());
    const views = active ? inspectorViews(active) : [];
    const view = views.find((item) => item.id === viewIds.get(active!.extension.id)) ?? views[0];
    const selectedRef = useRef<HTMLButtonElement>(null);
    const selectedNode = selected && isCALMNode(selected) ? selected['unique-id'] : undefined;

    useEffect(() => {
        if (!focusOnOpen || !open) return;
        selectedRef.current?.focus();
        onFocused();
    }, [focusOnOpen, open, onFocused]);

    const extensionNotice = !context
        ? 'Extensions need a resource from CALM Hub. A dropped file has none.'
        : status === 'loading' && !active
          ? 'Loading extensions…'
          : status === 'failed' && !active
            ? 'CALM Hub could not load the extensions. It tries again soon.'
            : !active
                ? 'No extension adds a view to this resource.'
                : undefined;

    const extensionPanel = (
        <div
            id={inspectorPanelId('extensions')}
            role="region"
            aria-label="Extensions"
            hidden={!open || tab !== 'extensions'}
            className="p-4 flex flex-col gap-4"
        >
            {extensionNotice && <p role="status" className="text-sm text-base-content/60">{extensionNotice}</p>}
            {context && (
                <ExtensionInspector entries={shown} activeId={active?.extension.id} viewIds={viewIds} context={context} selectedNode={selectedNode} shown={open && tab === 'extensions'} />
            )}
        </div>
    );
    // A closed inspector keeps the same tree, with only the extension panel, so its slots stay mounted.
    return (
        <div className="flex flex-col h-full min-h-0">
            {open && (
                <div className="bg-base-200 px-3 py-2 border-b border-base-300 flex items-center justify-between gap-2">
                    <InspectorMenu
                        tab={tab}
                        entries={shown}
                        active={active}
                        view={view}
                        selectedRef={selectedRef}
                        onSelect={(next, id, viewId) => {
                            if (id && viewId) setViewIds((current) => new Map(current).set(id, viewId));
                            onSelectTab(next, id);
                        }}
                    />
                    {onClose && <CloseButton label="Close inspector" onClick={onClose} />}
                </div>
            )}
            {open && (
                <div className="px-4 py-2 border-b border-base-300 flex items-center gap-2 text-xs min-h-10">
                    {selected ? (
                        <>
                            <span className="text-base-content/60 shrink-0">Selected</span>
                            <span className="font-semibold truncate flex-1 min-w-0" title={selected['unique-id']}>
                                {selectionName(selected)}
                            </span>
                            <button type="button" className="btn btn-ghost btn-xs shrink-0" onClick={onClearSelection}>
                                Clear selection
                            </button>
                        </>
                    ) : (
                        <span className="text-base-content/60">
                            Whole {data.calmType === 'Patterns' ? 'pattern' : 'architecture'}. Select a node to see its views.
                        </span>
                    )}
                </div>
            )}
            <div className="flex-1 min-h-0 overflow-auto">
                {open && (
                    <div id={inspectorPanelId('details')} role="region" aria-label="Details" hidden={tab !== 'details'} className="h-full">
                        {selected ? <ElementDetails key={selected['unique-id']} selectedData={selected} /> : <ResourceDetails data={data} displayName={displayName} dropped={!context} />}
                        {context && <div className="px-4 pb-4"><ChatEntryLink context={context} className="btn btn-outline btn-sm gap-2" /></div>}
                    </div>
                )}
                {extensionPanel}
            </div>
        </div>
    );
}

/**
 * The inspector on a narrow screen: a full-screen modal dialog over the diagram, with a way back to it. `showModal` keeps
 * focus in it, makes the page behind it inert and puts it above the navbar. A dialog of a slot, such as a confirmation,
 * opens over it and takes Escape first. The dialog stays in the page while it is closed, so its slots keep their state.
 */
export function MobileInspector({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
    const ref = useRef<HTMLDialogElement>(null);
    // A layout effect, so the dialog is modal before the inspector moves focus to its tab in a passive effect.
    useLayoutEffect(() => {
        const dialog = ref.current;
        if (!dialog || open === dialog.open) return;
        // jsdom does not have showModal or close.
        if (open) {
            if (typeof dialog.showModal === 'function') dialog.showModal();
            else dialog.setAttribute('open', '');
        } else if (typeof dialog.close === 'function') dialog.close();
        else dialog.removeAttribute('open');
    }, [open]);
    return (
        <dialog
            ref={ref}
            id={INSPECTOR_ID}
            aria-label="Inspector"
            className="m-0 h-full max-h-none w-full max-w-none border-0 p-0 bg-base-100 text-base-content open:flex flex-col animate-slide-in-right"
            onCancel={(event) => {
                // React passes on the cancel of a nested dialog, which closes only that dialog.
                if (event.target !== event.currentTarget) return;
                event.preventDefault();
                onClose();
            }}
        >
            <div className="px-2 py-1 border-b border-base-300 shrink-0">
                <button type="button" className="btn btn-ghost btn-sm gap-1 text-primary" onClick={onClose}>
                    <IoChevronBackOutline size={16} aria-hidden="true" />
                    Back to diagram
                </button>
            </div>
            <div className="flex-1 min-h-0">{children}</div>
        </dialog>
    );
}
