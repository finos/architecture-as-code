import { useEffect, useMemo, useRef } from 'react';
import { IoArrowForward, IoArrowBack, IoListOutline, IoGitBranchOutline } from 'react-icons/io5';
import { FlowSequenceHelper, orientEndpoints } from './flow-sequence-helper.js';
import { STATUS_COMPLETE } from './flow-step.js';
import type { Architecture } from '@finos/calm-models/model';
import type { CalmFlowTransitionSchema } from '@finos/calm-models/types';

interface ParsedTransition {
    desc: string;
    src: string;
    dst?: string;
    isReturn: boolean;
    /** Display endpoints, already oriented for return transitions. */
    from: string;
    to?: string;
}

interface SeqGroup {
    seq: number;
    items: ParsedTransition[];
}

interface FlowCommentaryProps {
    transitions: CalmFlowTransitionSchema[];
    architecture: Architecture | null;
    currentStep: number;
    onStepSelect?: (stepIndex: number) => void;
}

/** Makes the div rows operable by keyboard, as a native button is. */
function activateOnKey(activate: () => void) {
    return (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            activate();
        }
    };
}

/** Full-height side panel grouped by sequence number. Parallel transitions show together. */
export function FlowCommentary({ transitions, architecture, currentStep, onStepSelect }: FlowCommentaryProps) {
    const activeRef = useRef<HTMLDivElement>(null);
    const flowHelper = useMemo(() => new FlowSequenceHelper(), []);

    useEffect(() => {
        activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, [currentStep]);

    const groups: SeqGroup[] = useMemo(() => {
        const map = new Map<number, ParsedTransition[]>();
        transitions.forEach(t => {
            let src: string;
            let dst: string | undefined;
            if (architecture) {
                src = flowHelper.getSourceFromRelationship(t['relationship-unique-id'], architecture);
                const target = flowHelper.getTargetFromRelationship(t['relationship-unique-id'], architecture);
                dst = target !== FlowSequenceHelper.UNKNOWN_NODE ? target : undefined;
            } else {
                src = t['relationship-unique-id'];
                dst = undefined;
            }
            const isReturn = t.direction === 'destination-to-source';
            const [from, to] = dst !== undefined ? orientEndpoints(src, dst, isReturn) : [src, undefined];
            const parsed: ParsedTransition = { desc: t.description, src, dst, isReturn, from, to };
            const existing = map.get(t['sequence-number']);
            if (existing) existing.push(parsed);
            else map.set(t['sequence-number'], [parsed]);
        });
        return [...map.entries()]
            .sort(([a], [b]) => a - b)
            .map(([seq, items]) => ({ seq, items }));
    }, [transitions, architecture, flowHelper]);

    const total = groups.length;
    const isComplete = currentStep >= total;

    return (
        <div className="w-full h-full flex flex-col bg-base-100 border-l border-base-content/20">
            <div className="px-4 py-3 border-b border-base-300 bg-base-200/60 shrink-0">
                <div className="flex items-center gap-2 text-sm font-semibold text-base-content">
                    <IoListOutline size={16} className="text-info" />
                    Flow Commentary
                </div>
                <div className="text-xs text-base-content/50 mt-0.5">
                    {currentStep < 0 ? 'Press Play to begin' : isComplete ? `Complete - ${total} steps` : `Step ${currentStep + 1} of ${total}`}
                </div>
            </div>

            {currentStep >= 0 && currentStep < total && (
                <div className="px-4 py-3 bg-info/8 border-b border-info/20 shrink-0">
                    <div className="flex items-center gap-2 text-xs font-bold text-info mb-1">
                        Step {groups[currentStep].seq}
                        {groups[currentStep].items.length > 1 && (
                            <span className="flex items-center gap-0.5 text-warning font-semibold">
                                <IoGitBranchOutline size={12} /> parallel
                            </span>
                        )}
                    </div>
                    {groups[currentStep].items.map((item, j) => (
                        <div key={j} className={j > 0 ? 'mt-2 pt-2 border-t border-info/10' : ''}>
                            <p className="text-sm text-base-content font-medium leading-snug">
                                {item.desc}
                            </p>
                            {item.dst && (
                                <div className="flex items-center gap-2 mt-1 text-xs text-base-content/70">
                                    <span className="px-1.5 py-0.5 rounded bg-base-200 font-medium">
                                        {item.from}
                                    </span>
                                    {item.isReturn
                                        ? <IoArrowBack size={14} className="text-success shrink-0" />
                                        : <IoArrowForward size={14} className="text-primary shrink-0" />
                                    }
                                    <span className="px-1.5 py-0.5 rounded bg-base-200 font-medium">
                                        {item.to}
                                    </span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <div className="flex-1 overflow-y-auto min-h-0">
                {groups.map((g, i) => {
                    const isActive = i === currentStep;
                    const isVisited = currentStep >= 0 && i < currentStep;
                    const isFuture = currentStep >= 0 && i > currentStep;
                    const isParallel = g.items.length > 1;

                    return (
                        <div
                            key={g.seq}
                            ref={isActive ? activeRef : undefined}
                            role="button"
                            tabIndex={0}
                            onClick={() => onStepSelect?.(i)}
                            onKeyDown={activateOnKey(() => onStepSelect?.(i))}
                            className={[
                                'px-4 py-2.5 border-b border-base-300/50 transition-colors duration-300 cursor-pointer',
                                isActive ? 'bg-info/10' : 'hover:bg-base-200/60',
                                isFuture ? 'opacity-40 hover:opacity-70' : '',
                            ].join(' ')}
                        >
                            <div className="flex items-start gap-2">
                                <div className={[
                                    'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 transition-colors duration-300',
                                    isActive ? 'bg-info text-info-content' : isVisited ? 'bg-success/20 text-success' : 'bg-base-300 text-base-content/40',
                                ].join(' ')}>
                                    {isVisited && !isActive ? '✓' : g.seq}
                                </div>

                                <div className="min-w-0 flex-1">
                                    {isParallel && (
                                        <div className="flex items-center gap-1 mb-0.5 text-[10px] text-warning/70 font-semibold uppercase tracking-wide">
                                            <IoGitBranchOutline size={10} /> parallel
                                        </div>
                                    )}
                                    {g.items.map((item, j) => (
                                        <div key={j} className={j > 0 ? 'mt-1.5 pt-1.5 border-t border-base-300/30' : ''}>
                                            <p className={[
                                                'text-xs leading-snug',
                                                isActive ? 'text-base-content font-semibold' : isVisited ? 'text-base-content/70' : 'text-base-content/50',
                                            ].join(' ')}>
                                                {item.desc}
                                            </p>
                                            {item.dst && (
                                                <div className={[
                                                    'flex items-center gap-1 mt-0.5 text-[11px]',
                                                    isActive ? 'text-base-content/60' : 'text-base-content/30',
                                                ].join(' ')}>
                                                    <span>{item.from}</span>
                                                    {item.isReturn
                                                        ? <IoArrowBack size={10} className="shrink-0" />
                                                        : <IoArrowForward size={10} className="shrink-0" />
                                                    }
                                                    <span>{item.to}</span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    );
                })}

                {/* Always present, so you can select the end of the flow like any step. */}
                <div
                    ref={isComplete ? activeRef : undefined}
                    role="button"
                    tabIndex={0}
                    onClick={() => onStepSelect?.(total)}
                    onKeyDown={activateOnKey(() => onStepSelect?.(total))}
                    className={[
                        'px-4 py-2.5 flex items-center gap-2 cursor-pointer transition-colors duration-300',
                        isComplete ? 'bg-success/10' : 'opacity-40 hover:opacity-70 hover:bg-base-200/60',
                    ].join(' ')}
                >
                    <div className={[
                        'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors duration-300',
                        isComplete ? 'bg-success text-success-content' : 'bg-base-300 text-base-content/40',
                    ].join(' ')}>
                        ✓
                    </div>
                    <span className={['text-sm font-medium', isComplete ? 'text-success' : 'text-base-content/50'].join(' ')}>
                        {STATUS_COMPLETE}
                    </span>
                </div>
            </div>
        </div>
    );
}
