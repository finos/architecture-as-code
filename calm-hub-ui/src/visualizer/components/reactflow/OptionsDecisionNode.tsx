import { NodeProps, Handle, Position } from 'reactflow';
import { THEME } from './theme';
import { GitBranch } from 'lucide-react';

export function OptionsDecisionNode({ data }: NodeProps) {
    const borderColor = THEME.colors.decision.options;
    const isOneOf = data.optionType === 'oneOf';
    const typeLabel = isOneOf ? 'oneOf' : 'anyOf';
    const prompt = data.prompt || 'Decision';
    const choices: { description: string }[] = data.choices || [];

    return (
        <div
            style={{
                width: '240px',
                position: 'relative',
            }}
        >
            <Handle type="target" position={Position.Left} id="target" style={{ opacity: 0 }} />
            <Handle type="source" position={Position.Right} id="source" style={{ opacity: 0 }} />

            <div
                style={{
                    background: THEME.colors.card,
                    border: `2px solid ${borderColor}`,
                    borderRadius: '12px',
                    padding: '16px',
                    color: THEME.colors.foreground,
                    fontSize: '13px',
                    boxShadow: THEME.shadows.sm,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <GitBranch style={{ width: '16px', height: '16px', color: borderColor, flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, fontSize: '13px' }}>{prompt}</span>
                </div>

                <div
                    style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        background: `${borderColor}20`,
                        color: borderColor,
                        marginBottom: '8px',
                    }}
                >
                    {typeLabel}
                </div>

                {choices.length > 0 && (
                    <div style={{ borderTop: `1px solid ${THEME.colors.border}`, paddingTop: '8px' }}>
                        {choices.map((choice, idx) => (
                            <div
                                key={idx}
                                style={{
                                    fontSize: '11px',
                                    color: THEME.colors.muted,
                                    padding: '4px 0',
                                    borderBottom: idx < choices.length - 1 ? `1px solid ${THEME.colors.border}` : undefined,
                                }}
                            >
                                {choice.description}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
