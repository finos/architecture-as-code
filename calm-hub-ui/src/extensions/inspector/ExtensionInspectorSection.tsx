import { useId, useState } from 'react';
import type { ExtensionContext, ExtensionContribution } from '../../model/extensions.js';
import { ResourceExtension, slotContributions } from '../contributions.js';
import { ExtensionSlot, SlotFrame } from '../ExtensionSlot.js';
import type { HeadingLevel } from '../Heading.js';
import type { FormPoint } from '../forms/FormBlock.js';
import { SlotActiveContext, useSlotActive } from '../slotActivity.js';
import { inspectorViews } from './inspectorViews.js';

/** The ActionRuns placement of the inspector's action buttons. */
export const INSPECTOR_PLACEMENT = 'inspector';

interface ExtensionInspectorSectionProps {
    entry: ResourceExtension;
    viewId?: string;
    /** The resource, with the selected node or relationship, if any. */
    context: ExtensionContext;
    /** The unique-id of the selected node. Detail panels are for a node only, not a relationship. */
    selectedNode?: string;
    /** The level of each slot title: one below the inspector heading. */
    headingLevel: HeadingLevel;
}

function Hint({ title, level, text }: { title: string; level: HeadingLevel; text: string }) {
    return (
        <SlotFrame title={title} level={level}>
            <p className="text-xs text-base-content/60">{text}</p>
        </SlotFrame>
    );
}

/** Extension actions and one view. Visited views stay mounted but send no requests while hidden. */
export function ExtensionInspectorSection({ entry, viewId, context, selectedNode, headingLevel }: ExtensionInspectorSectionProps) {
    const { extension, actions, needsSelection, tabsNeedSelection } = entry;
    const shown = useSlotActive();
    const views = inspectorViews(entry);
    const selectedView = views.find((view) => view.id === viewId) ?? views[0];
    const [visited, setVisited] = useState<readonly string[]>([]);
    if (shown && selectedView && !visited.includes(selectedView.id)) setVisited([...visited, selectedView.id]);
    const hintId = useId();
    const selection = context.selectedElement;
    const nodeContext = { ...context, selectedElement: selectedNode };
    const fillable = selectedNode === undefined ? [] : slotContributions(extension, 'detail-panel', nodeContext);
    const slot = (point: FormPoint, contribution: ExtensionContribution, slotContext: ExtensionContext) => (
        <ExtensionSlot
            key={`${point}:${contribution.id}`}
            point={point}
            extension={extension}
            contribution={contribution}
            context={slotContext}
            headingLevel={headingLevel}
        />
    );

    return (
        <div className="flex flex-col gap-4 min-w-0">
            {actions.length + needsSelection.length > 0 && (
                <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap gap-2" role="group" aria-label={`${extension.name} actions`}>
                        {actions.map((contribution) => (
                            <ExtensionSlot
                                key={contribution.id}
                                extension={extension}
                                contribution={contribution}
                                context={context}
                                action
                                placement={INSPECTOR_PLACEMENT}
                            />
                        ))}
                        {needsSelection.map((contribution) => (
                            // aria-disabled, not disabled: a disabled button cannot take focus, so a keyboard user could not reach the hint.
                            <button
                                key={contribution.id}
                                type="button"
                                className="btn btn-sm btn-disabled"
                                aria-disabled="true"
                                aria-describedby={hintId}
                            >
                                {contribution.title}
                            </button>
                        ))}
                    </div>
                    {needsSelection.length > 0 && (
                        <p id={hintId} className="text-xs text-base-content/60">
                            {selection === undefined
                                ? 'Select a node on the diagram to use the other actions.'
                                : 'Some actions cannot run for the selected element.'}
                        </p>
                    )}
                </div>
            )}
            {views
                .filter((view) => visited.includes(view.id))
                .map(({ id, point, contribution }) => {
                    const on = shown && id === selectedView?.id;
                    const hint =
                        point === 'detail-panel'
                            ? !fillable.includes(contribution) &&
                              (selectedNode === undefined
                                  ? 'Select a node on the diagram to see this view.'
                                  : 'This view cannot show for the selected node.')
                            : tabsNeedSelection.includes(contribution) &&
                              (selection === undefined
                                  ? 'Select a node on the diagram to see this view.'
                                  : 'This view cannot show for the selected element.');
                    return (
                        <div key={id} hidden={!on}>
                            <SlotActiveContext.Provider value={on}>
                                {hint ? (
                                    <Hint title={contribution.title} level={headingLevel} text={hint} />
                                ) : (
                                    slot(point, contribution, point === 'detail-panel' ? nodeContext : context)
                                )}
                            </SlotActiveContext.Provider>
                        </div>
                    );
                })}
        </div>
    );
}
