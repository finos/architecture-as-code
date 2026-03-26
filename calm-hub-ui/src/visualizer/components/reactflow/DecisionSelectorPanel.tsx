import { useState } from 'react';
import { THEME } from './theme';
import { DecisionPoint, DecisionSelections, isDecisionFilterActive } from './utils/decisionUtils.js';

interface DecisionSelectorPanelProps {
    decisionPoints: DecisionPoint[];
    selections: DecisionSelections;
    onSelectionChange: (groupId: string, selectedIndices: number[]) => void;
    onReset: () => void;
}

export function DecisionSelectorPanel({
    decisionPoints,
    selections,
    onSelectionChange,
    onReset,
}: DecisionSelectorPanelProps) {
    const [collapsed, setCollapsed] = useState(true);

    if (decisionPoints.length === 0) return null;

    const hasActiveSelections = isDecisionFilterActive(selections);

    if (collapsed) {
        return (
            <button
                onClick={() => setCollapsed(false)}
                aria-label="Show decisions"
                style={{
                    background: THEME.colors.card,
                    border: `1px solid ${THEME.colors.border}`,
                    borderRadius: '8px',
                    padding: '6px 12px',
                    boxShadow: THEME.shadows.md,
                    fontSize: '12px',
                    fontWeight: 600,
                    color: THEME.colors.foreground,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                }}
            >
                Decisions
                {hasActiveSelections && (
                    <span
                        style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: THEME.colors.accent,
                        }}
                    />
                )}
            </button>
        );
    }

    return (
        <div
            style={{
                background: THEME.colors.card,
                border: `1px solid ${THEME.colors.border}`,
                borderRadius: '8px',
                padding: '8px 12px',
                boxShadow: THEME.shadows.md,
                maxWidth: '280px',
                maxHeight: '350px',
                overflowY: 'auto',
                fontSize: '12px',
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 600, color: THEME.colors.foreground }}>Decisions</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                    {hasActiveSelections && (
                        <button
                            onClick={onReset}
                            aria-label="Show all options"
                            style={{
                                border: 'none',
                                background: 'transparent',
                                color: THEME.colors.accent,
                                cursor: 'pointer',
                                fontSize: '11px',
                                padding: '2px 4px',
                            }}
                        >
                            Show All
                        </button>
                    )}
                    <button
                        onClick={() => setCollapsed(true)}
                        aria-label="Collapse decisions"
                        style={{
                            border: 'none',
                            background: 'transparent',
                            color: THEME.colors.muted,
                            cursor: 'pointer',
                            fontSize: '14px',
                            padding: '0 4px',
                            lineHeight: 1,
                        }}
                    >
                        ✕
                    </button>
                </div>
            </div>

            {decisionPoints.map((dp, idx) => (
                <DecisionSection
                    key={dp.groupId}
                    decisionPoint={dp}
                    selectedIndices={selections.get(dp.groupId) || []}
                    onSelectionChange={(indices) => onSelectionChange(dp.groupId, indices)}
                    isLast={idx === decisionPoints.length - 1}
                />
            ))}
        </div>
    );
}

function DecisionSection({
    decisionPoint,
    selectedIndices,
    onSelectionChange,
    isLast,
}: {
    decisionPoint: DecisionPoint;
    selectedIndices: number[];
    onSelectionChange: (indices: number[]) => void;
    isLast: boolean;
}) {
    const isOneOf = decisionPoint.decisionType === 'oneOf';
    const headerColor = isOneOf ? THEME.colors.decision.oneOf : THEME.colors.decision.anyOf;

    function handleRadioChange(choiceIndex: number) {
        if (selectedIndices.length === 1 && selectedIndices[0] === choiceIndex) {
            onSelectionChange([]);
        } else {
            onSelectionChange([choiceIndex]);
        }
    }

    function handleCheckboxChange(choiceIndex: number) {
        const current = new Set(selectedIndices);
        if (current.has(choiceIndex)) {
            current.delete(choiceIndex);
        } else {
            current.add(choiceIndex);
        }
        onSelectionChange(Array.from(current));
    }

    return (
        <div
            style={{
                paddingBottom: isLast ? 0 : '8px',
                marginBottom: isLast ? 0 : '8px',
                borderBottom: isLast ? 'none' : `1px solid ${THEME.colors.border}`,
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <span
                    style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        padding: '1px 5px',
                        borderRadius: '3px',
                        background: `${headerColor}20`,
                        color: headerColor,
                    }}
                >
                    {isOneOf ? 'oneOf' : 'anyOf'}
                </span>
                <span style={{ color: THEME.colors.muted, fontSize: '11px' }}>
                    {decisionPoint.prompt}
                </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '4px' }}>
                {decisionPoint.choices.map((choice, idx) => (
                    <label
                        key={idx}
                        style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '6px',
                            cursor: 'pointer',
                            color: THEME.colors.foreground,
                            lineHeight: '1.3',
                        }}
                    >
                        <input
                            type={isOneOf ? 'radio' : 'checkbox'}
                            name={isOneOf ? decisionPoint.groupId : undefined}
                            checked={selectedIndices.includes(idx)}
                            onChange={() => isOneOf ? undefined : handleCheckboxChange(idx)}
                            onClick={() => isOneOf ? handleRadioChange(idx) : undefined}
                            style={{ marginTop: '2px', flexShrink: 0 }}
                        />
                        <span style={{ fontSize: '11px' }}>{choice.description}</span>
                    </label>
                ))}
            </div>
        </div>
    );
}
