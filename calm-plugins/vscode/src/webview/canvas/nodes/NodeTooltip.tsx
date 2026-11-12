import React, { useState, useRef, useCallback } from 'react';

interface NodeTooltipProps {
    description: string | undefined;
    nodeType?: string;
    controls?: Record<string, unknown>;
    children: React.ReactNode;
    style?: React.CSSProperties;
}

export function NodeTooltip({ description, nodeType, controls, children, style }: NodeTooltipProps) {
    const [hovered, setHovered] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const show = useCallback(() => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setHovered(true), 400);
    }, []);

    const hide = useCallback(() => {
        if (timer.current) clearTimeout(timer.current);
        setHovered(false);
    }, []);

    const controlKeys = controls ? Object.keys(controls) : [];
    const hasContent = !!(description || controlKeys.length > 0);

    return (
        <div
            onMouseEnter={show}
            onMouseLeave={hide}
            style={{ ...wrapperStyle, ...style }}
        >
            {children}
            {hovered && hasContent && (
                <div style={tooltipStyle}>
                    {nodeType && (
                        <div style={rowStyle}>
                            <span style={labelStyle}>Type</span>
                            <span style={valueStyle}>{nodeType}</span>
                        </div>
                    )}
                    {controlKeys.length > 0 && (
                        <div style={rowStyle}>
                            <span style={labelStyle}>Controls</span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                {controlKeys.map(k => (
                                    <span key={k} style={controlStyle}>{k}</span>
                                ))}
                            </div>
                        </div>
                    )}
                    {description && (
                        <div style={rowStyle}>
                            <span style={labelStyle}>Description</span>
                            <span style={valueStyle}>{description}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

const wrapperStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '100%',
};

const tooltipStyle: React.CSSProperties = {
    position: 'absolute',
    left: '50%',
    bottom: 'calc(100% + 8px)',
    transform: 'translateX(-50%)',
    background: 'var(--calm-bg)',
    border: '1px solid var(--calm-border-input)',
    borderRadius: '6px',
    padding: '8px 10px',
    fontSize: '11px',
    color: 'var(--calm-fg)',
    lineHeight: 1.4,
    minWidth: '160px',
    maxWidth: '320px',
    wordBreak: 'break-word',
    boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
    zIndex: 1000,
    pointerEvents: 'none',
};

const rowStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    alignItems: 'baseline',
    marginBottom: '4px',
};

const labelStyle: React.CSSProperties = {
    fontSize: '9px',
    fontWeight: 700,
    color: 'var(--calm-fg-muted)',
    textTransform: 'uppercase',
    flexShrink: 0,
    minWidth: '60px',
};

const valueStyle: React.CSSProperties = {
    fontSize: '11px',
    color: 'var(--calm-fg)',
    lineHeight: 1.3,
};

const controlStyle: React.CSSProperties = {
    fontSize: '11px',
    color: '#60a5fa',
};
