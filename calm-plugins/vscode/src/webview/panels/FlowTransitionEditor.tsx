import React, { useState, useRef, useCallback } from 'react';
import type { CalmFlow, CalmTransition } from '../../core/types';

interface FlowTransitionEditorProps {
    relationshipId: string;
    reverseRelationshipId?: string;
    flows: CalmFlow[];
    onFlowUpdate: (flowId: string, updates: Partial<CalmFlow>) => void;
    readonly?: boolean;
}

interface FlowStyleMeta {
    background?: string;
    text?: string;
}

const DEFAULT_FLOW_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

function getFlowStyle(flow: CalmFlow): FlowStyleMeta {
    const meta = flow.metadata as Record<string, unknown> | undefined;
    return (meta?.['flow-style'] as FlowStyleMeta) ?? {};
}

function nextSequenceNumber(flow: CalmFlow): number {
    if (!flow.transitions || flow.transitions.length === 0) return 1;
    return Math.max(...flow.transitions.map(t => t['sequence-number'])) + 1;
}

function maxSequenceNumber(flow: CalmFlow): number {
    if (!flow.transitions || flow.transitions.length === 0) return 0;
    return Math.max(...flow.transitions.map(t => t['sequence-number']));
}

export function FlowTransitionEditor({
    relationshipId,
    reverseRelationshipId,
    flows,
    onFlowUpdate,
    readonly = false,
}: FlowTransitionEditorProps) {
    const [addFlowDropdownOpen, setAddFlowDropdownOpen] = useState(false);
    const [bidiRelIdChoice, setBidiRelIdChoice] = useState<string | null>(null);

    const matchesRel = useCallback((t: CalmTransition) =>
        t['relationship-unique-id'] === relationshipId ||
        (reverseRelationshipId && t['relationship-unique-id'] === reverseRelationshipId),
    [relationshipId, reverseRelationshipId]);

    const memberFlows = flows.filter(f =>
        f.transitions?.some(matchesRel)
    );
    const nonMemberFlows = flows.filter(f =>
        !f.transitions?.some(matchesRel)
    );

    const updateTransitionAtIndex = (
        flow: CalmFlow,
        transitionIndex: number,
        field: keyof CalmTransition,
        value: unknown,
    ) => {
        const updated = (flow.transitions ?? []).map((t, i) => {
            if (i !== transitionIndex) return t;
            return { ...t, [field]: value };
        });
        onFlowUpdate(flow['unique-id'], { transitions: updated });
    };

    const removeTransitionAtIndex = (flow: CalmFlow, transitionIndex: number) => {
        const updated = (flow.transitions ?? []).filter((_, i) => i !== transitionIndex);
        onFlowUpdate(flow['unique-id'], {
            transitions: updated.length > 0 ? updated : [{ 'relationship-unique-id': '', 'sequence-number': 1, description: '' }],
        });
    };

    const addStepToFlow = (flow: CalmFlow, relId: string) => {
        const newTransition: CalmTransition = {
            'relationship-unique-id': relId,
            'sequence-number': nextSequenceNumber(flow),
            description: '',
        };
        onFlowUpdate(flow['unique-id'], {
            transitions: [...(flow.transitions ?? []), newTransition],
        });
    };

    const addToFlow = (flow: CalmFlow, relId: string) => {
        const newTransition: CalmTransition = {
            'relationship-unique-id': relId,
            'sequence-number': nextSequenceNumber(flow),
            description: '',
        };
        onFlowUpdate(flow['unique-id'], {
            transitions: [...(flow.transitions ?? []).filter((t) => t['relationship-unique-id']), newTransition],
        });
        setAddFlowDropdownOpen(false);
        setBidiRelIdChoice(null);
    };

    if (flows.length === 0) {
        return (
            <div style={sectionStyle}>
                <span style={sectionLabel}>Flow Membership</span>
                <p style={emptyText}>No flows defined. Create one in the Solution panel.</p>
            </div>
        );
    }

    return (
        <div style={sectionStyle}>
            <span style={sectionLabel}>Flow Membership</span>

            {memberFlows.length === 0 && (
                <p style={emptyText}>This relationship is not part of any flow.</p>
            )}

            {memberFlows.map(flow => {
                const style = getFlowStyle(flow);
                const flowColor = style.background ?? DEFAULT_FLOW_COLORS[flows.indexOf(flow) % DEFAULT_FLOW_COLORS.length];
                const allTransitions = flow.transitions ?? [];
                const matchingWithIndex = allTransitions
                    .map((t, idx) => ({ t, idx }))
                    .filter(({ t }) => matchesRel(t));

                return (
                    <div key={flow['unique-id']}>
                        {matchingWithIndex.map(({ t, idx }) => (
                            <TransitionRow
                                key={`${flow['unique-id']}-${idx}`}
                                flow={flow}
                                transition={t}
                                flowColor={flowColor}
                                readonly={readonly}
                                isBidirectional={!!reverseRelationshipId}
                                forwardRelId={relationshipId}
                                reverseRelId={reverseRelationshipId}
                                onUpdate={(field, value) => updateTransitionAtIndex(flow, idx, field, value)}
                                onRemove={() => removeTransitionAtIndex(flow, idx)}
                            />
                        ))}
                        {!readonly && (
                            <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
                                <button type="button" onClick={() => addStepToFlow(flow, relationshipId)} style={addStepBtn}>
                                    + Add Step{reverseRelationshipId ? ' (Forward)' : ''}
                                </button>
                                {reverseRelationshipId && (
                                    <button type="button" onClick={() => addStepToFlow(flow, reverseRelationshipId)} style={addStepBtn}>
                                        + Add Step (Reverse)
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}

            {!readonly && nonMemberFlows.length > 0 && (
                <div style={{ marginTop: '8px' }}>
                    {!addFlowDropdownOpen ? (
                        <button type="button" onClick={() => setAddFlowDropdownOpen(true)} style={addBtn}>
                            + Add to Flow
                        </button>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <select
                                value=""
                                onChange={(e) => {
                                    const selectedFlow = nonMemberFlows.find(f => f['unique-id'] === e.target.value);
                                    if (!selectedFlow) return;
                                    if (reverseRelationshipId) {
                                        setBidiRelIdChoice(e.target.value);
                                    } else {
                                        addToFlow(selectedFlow, relationshipId);
                                    }
                                }}
                                style={selectStyle}
                                autoFocus
                            >
                                <option value="">Select a flow...</option>
                                {nonMemberFlows.map(f => (
                                    <option key={f['unique-id']} value={f['unique-id']}>{f.name || f['unique-id']}</option>
                                ))}
                            </select>
                            {bidiRelIdChoice && reverseRelationshipId && (() => {
                                const selectedFlow = nonMemberFlows.find(f => f['unique-id'] === bidiRelIdChoice);
                                if (!selectedFlow) return null;
                                return (
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        <button type="button" onClick={() => addToFlow(selectedFlow, relationshipId)} style={dirBtn}>
                                            Forward
                                        </button>
                                        <button type="button" onClick={() => addToFlow(selectedFlow, reverseRelationshipId)} style={dirBtn}>
                                            Reverse
                                        </button>
                                    </div>
                                );
                            })()}
                            <button type="button" onClick={() => { setAddFlowDropdownOpen(false); setBidiRelIdChoice(null); }} style={{ ...addBtn, color: 'var(--calm-fg-muted)' }}>
                                Cancel
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function TransitionRow({
    flow,
    transition,
    flowColor,
    readonly,
    isBidirectional,
    forwardRelId,
    reverseRelId,
    onUpdate,
    onRemove,
}: {
    flow: CalmFlow;
    transition: CalmTransition;
    flowColor?: string;
    readonly: boolean;
    isBidirectional?: boolean;
    forwardRelId?: string;
    reverseRelId?: string;
    onUpdate: (field: keyof CalmTransition, value: unknown) => void;
    onRemove: () => void;
}) {
    const [localDesc, setLocalDesc] = useState(transition.description ?? '');
    const [localSeq, setLocalSeq] = useState(transition['sequence-number']);
    const descTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const maxSeq = maxSequenceNumber(flow);
    const seqGapWarning = localSeq > maxSeq + 2;
    const isReverse = isBidirectional && transition['relationship-unique-id'] === reverseRelId;

    return (
        <div style={rowCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <span style={{ ...colorDot, background: flowColor }} />
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--calm-fg)', flex: 1 }}>
                    {flow.name || flow['unique-id']}
                    {isBidirectional && <span style={{ fontSize: '9px', fontWeight: 400, color: 'var(--calm-fg-muted)', marginLeft: '4px' }}>{isReverse ? '(reverse)' : '(forward)'}</span>}
                </span>
                {!readonly && (
                    <button type="button" onClick={onRemove} style={removeBtn} title="Remove from flow">&times;</button>
                )}
            </div>

            <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start', marginBottom: '4px' }}>
                <div style={{ flex: '0 0 60px' }}>
                    <div style={fieldLabel}>Seq #</div>
                    {readonly ? (
                        <span style={{ fontSize: '12px' }}>{localSeq}</span>
                    ) : (
                        <input
                            type="number"
                            min={1}
                            value={localSeq}
                            onChange={(e) => {
                                const v = parseInt(e.target.value, 10);
                                if (!isNaN(v)) {
                                    setLocalSeq(v);
                                    onUpdate('sequence-number', v);
                                }
                            }}
                            style={{ ...inputStyle, width: '100%' }}
                        />
                    )}
                    {seqGapWarning && <div style={warningText}>Gap (max is {maxSeq})</div>}
                </div>
                <div style={{ flex: 1 }}>
                    <div style={fieldLabel}>Description</div>
                    {readonly ? (
                        <span style={{ fontSize: '12px' }}>{localDesc || '---'}</span>
                    ) : (
                        <input
                            type="text"
                            value={localDesc}
                            onChange={(e) => {
                                setLocalDesc(e.target.value);
                                clearTimeout(descTimer.current);
                                descTimer.current = setTimeout(() => onUpdate('description', e.target.value), 300);
                            }}
                            placeholder="Transition description"
                            style={inputStyle}
                        />
                    )}
                </div>
            </div>

            <div>
                <div style={fieldLabel}>Direction</div>
                {readonly ? (
                    <span style={{ fontSize: '12px' }}>{transition.direction ?? 'source-to-destination'}</span>
                ) : (
                    <select
                        value={transition.direction ?? 'source-to-destination'}
                        onChange={(e) => onUpdate('direction', e.target.value)}
                        style={{ ...selectStyle, width: '100%' }}
                    >
                        <option value="source-to-destination">Source to Destination</option>
                        <option value="destination-to-source">Destination to Source</option>
                    </select>
                )}
            </div>
        </div>
    );
}

const sectionStyle: React.CSSProperties = {
    padding: '10px 14px',
    borderTop: '1px solid var(--calm-border)',
};
const sectionLabel: React.CSSProperties = {
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
    color: 'var(--calm-fg-muted)',
    display: 'block',
    marginBottom: '8px',
};
const emptyText: React.CSSProperties = {
    fontSize: '11px',
    color: 'var(--calm-fg-muted)',
    textAlign: 'center',
    padding: '8px 0',
    margin: 0,
};
const rowCard: React.CSSProperties = {
    padding: '8px',
    marginBottom: '6px',
    border: '1px solid var(--calm-border)',
    borderRadius: '4px',
    background: 'var(--calm-bg-input)',
};
const colorDot: React.CSSProperties = {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    flexShrink: 0,
    border: '1px solid var(--calm-border)',
};
const fieldLabel: React.CSSProperties = {
    fontSize: '9px',
    fontWeight: 600,
    textTransform: 'uppercase',
    color: 'var(--calm-fg-muted)',
    marginBottom: '2px',
};
const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '4px 6px',
    fontSize: '11px',
    color: 'var(--calm-fg)',
    background: 'var(--calm-bg-input)',
    border: '1px solid var(--calm-border-input)',
    borderRadius: '3px',
    outline: 'none',
};
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' };
const addBtn: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 500,
    color: 'var(--calm-link)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '2px 0',
};
const dirBtn: React.CSSProperties = {
    flex: 1,
    padding: '4px 8px',
    fontSize: '11px',
    color: 'var(--calm-fg)',
    background: 'var(--calm-bg-input)',
    border: '1px solid var(--calm-border-input)',
    borderRadius: '3px',
    cursor: 'pointer',
};
const removeBtn: React.CSSProperties = {
    border: 'none',
    background: 'transparent',
    color: 'var(--calm-fg-muted)',
    cursor: 'pointer',
    fontSize: '14px',
    lineHeight: 1,
    padding: '0 2px',
};
const warningText: React.CSSProperties = {
    fontSize: '9px',
    color: '#f59e0b',
    marginTop: '2px',
};
const addStepBtn: React.CSSProperties = {
    fontSize: '10px',
    fontWeight: 500,
    color: 'var(--calm-link)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '2px 0',
};
