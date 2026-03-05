import { NodeProps, Handle, Position } from 'reactflow';
import { THEME } from './theme';

export function DecisionGroupNode({ data }: NodeProps) {
    const isOneOf = data.decisionType === 'oneOf';
    const borderColor = isOneOf
        ? THEME.colors.decision.oneOf
        : THEME.colors.decision.anyOf;
    const label = isOneOf ? 'oneOf' : 'anyOf';
    const subtitle = isOneOf
        ? 'Choose exactly one'
        : 'Choose one or more';
    const prompt = data.prompt as string | undefined;

    return (
        <div
            style={{
                background: `${borderColor}08`,
                border: `2px dashed ${borderColor}`,
                borderRadius: '12px',
                padding: '24px',
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                transition: 'all 0.3s ease-in-out',
            }}
        >
            <Handle type="source" position={Position.Right} id="source" style={{ opacity: 0, pointerEvents: 'all' }} />
            <Handle type="target" position={Position.Left} id="target" style={{ opacity: 0, pointerEvents: 'all' }} />
            <div
                style={{
                    position: 'absolute',
                    top: '12px',
                    left: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '4px 12px',
                    borderRadius: '6px',
                    fontWeight: 600,
                    fontSize: '12px',
                    background: `${borderColor}20`,
                    color: borderColor,
                    border: `1px solid ${borderColor}`,
                    pointerEvents: 'auto',
                }}
            >
                <span>{label}</span>
                <span style={{ fontSize: '10px', opacity: 0.8 }}>
                    {subtitle}
                </span>
            </div>
            {prompt && (
                <div
                    style={{
                        position: 'absolute',
                        top: '40px',
                        left: '16px',
                        fontSize: '11px',
                        color: borderColor,
                        fontStyle: 'italic',
                        maxWidth: 'calc(100% - 32px)',
                        pointerEvents: 'auto',
                    }}
                >
                    {prompt}
                </div>
            )}
        </div>
    );
}
