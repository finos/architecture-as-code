import { memo } from 'react';
import { NodeProps, Handle, Position } from 'reactflow';
import { THEME } from './theme';
import { scalePx, useDiagramTextScale, type DiagramTextScaleStore } from '../../../theme/useDiagramTextScale.js';

interface DecisionGroupNodeProps extends NodeProps {
    /** Injected for tests; defaults to the app-wide store. */
    textScaleStore?: DiagramTextScaleStore;
}

function DecisionGroupNodeComponent({ data, textScaleStore }: DecisionGroupNodeProps) {
    // The children start 80px down. Above 1.5x the label and the prompt do not fit in that space.
    const scale = Math.min(useDiagramTextScale(textScaleStore).scale, 1.5);
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
                    fontSize: scalePx(12, scale),
                    background: `${borderColor}20`,
                    color: borderColor,
                    border: `1px solid ${borderColor}`,
                    pointerEvents: 'auto',
                }}
            >
                <span>{label}</span>
                <span style={{ fontSize: scalePx(10, scale), opacity: 0.8 }}>
                    {subtitle}
                </span>
            </div>
            {prompt && (
                <div
                    style={{
                        position: 'absolute',
                        // Below the label: its 12px top, 8px padding, 2px border and one 1.5-line-height line of text.
                        top: `${Math.round((22 + 18 * scale) * 10) / 10}px`,
                        left: '16px',
                        fontSize: scalePx(11, scale),
                        color: borderColor,
                        fontStyle: 'italic',
                        maxWidth: 'calc(100% - 32px)',
                        pointerEvents: 'auto',
                        // A larger prompt that wraps would reach the options, so it keeps to one line.
                        ...(scale > 1 && { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }),
                    }}
                    title={scale > 1 ? prompt : undefined}
                >
                    {prompt}
                </div>
            )}
        </div>
    );
}

export const DecisionGroupNode = memo(DecisionGroupNodeComponent);
