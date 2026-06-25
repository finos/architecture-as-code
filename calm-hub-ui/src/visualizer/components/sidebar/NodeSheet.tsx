import { IoCloseOutline, IoChevronBackOutline, IoChevronForwardOutline } from 'react-icons/io5';
import { CalmNodeSchema, CalmRelationshipSchema } from '@finos/calm-models/types';
import { NodeDetails } from './NodeDetails.js';
import { RelationshipDetails } from './RelationshipDetails.js';
import { colors } from '../../../theme/colors.js';

function isCALMNode(data: CalmNodeSchema | CalmRelationshipSchema): data is CalmNodeSchema {
    return 'node-type' in data;
}

export interface NodeSheetProps {
    selectedData: CalmNodeSchema | CalmRelationshipSchema;
    closeSheet: () => void;
    /** Step to the previous node; absent/undefined disables the ‹ stepper. */
    onPrev?: () => void;
    /** Step to the next node; absent/undefined disables the › stepper. */
    onNext?: () => void;
}

/**
 * Mobile node bottom-sheet (redesign Frame G, problem #11): tapping a node (or
 * edge) raises a sheet anchored to the bottom while the diagram peeks above it
 * through a transparent backdrop — keeping spatial context, unlike the old
 * full-screen takeover. The diagram (and backdrop) tap closes the sheet.
 *
 * Content is delegated to the existing NodeDetails / RelationshipDetails so the
 * type badge, title, mono id, description and PROPERTIES block stay in one place
 * and match the desktop drawer; the sheet only owns the grab handle, the
 * prev/next steppers and the close affordance.
 */
export function NodeSheet({ selectedData, closeSheet, onPrev, onNext }: NodeSheetProps) {
    const isNode = isCALMNode(selectedData);

    return (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" data-testid="node-sheet">
            {/* Transparent backdrop: the diagram shows through (peek) and a tap dismisses. */}
            <button
                aria-label="Close node details"
                className="absolute inset-0 w-full h-full cursor-default"
                onClick={closeSheet}
            />
            <div
                className="absolute inset-x-0 bottom-0 bg-base-100 flex flex-col animate-slide-up"
                style={{
                    height: 'min(60vh, 352px)',
                    borderRadius: '20px 20px 0 0',
                    boxShadow: '0 -2px 12px rgba(16,24,40,.12)',
                }}
            >
                {/* Grab handle */}
                <div className="flex justify-center pt-2 pb-1 shrink-0">
                    <span
                        className="block rounded-full"
                        style={{ width: 36, height: 4, backgroundColor: colors.redesign.borderStrong }}
                    />
                </div>

                {/* Steppers (node-only) + close. */}
                <div className="flex items-center justify-end gap-1 px-3 pb-1 shrink-0">
                    {isNode && (
                        <>
                            <button
                                aria-label="Previous node"
                                disabled={!onPrev}
                                onClick={onPrev}
                                className="btn btn-ghost btn-xs btn-circle disabled:opacity-30"
                            >
                                <IoChevronBackOutline size={18} />
                            </button>
                            <button
                                aria-label="Next node"
                                disabled={!onNext}
                                onClick={onNext}
                                className="btn btn-ghost btn-xs btn-circle disabled:opacity-30"
                            >
                                <IoChevronForwardOutline size={18} />
                            </button>
                        </>
                    )}
                    <button
                        aria-label="close-sidebar"
                        onClick={closeSheet}
                        className="btn btn-ghost btn-xs btn-circle"
                    >
                        <IoCloseOutline size={20} />
                    </button>
                </div>

                {/* Single scroll owner: NodeDetails / RelationshipDetails already
                    apply their own `overflow-auto p-4`, so this wrapper drops its own
                    `overflow-auto` to avoid a redundant nested scroll container. It is
                    a `flex flex-col` so the child stretches to the wrapper's bounded
                    (`flex-1 min-h-0`) height and that child's `overflow-auto` becomes
                    the genuine, single scroll owner within the sheet. */}
                <div className="flex-1 min-h-0 flex flex-col">
                    {isNode ? (
                        <NodeDetails data={selectedData} />
                    ) : (
                        <RelationshipDetails data={selectedData} />
                    )}
                </div>
            </div>
        </div>
    );
}
