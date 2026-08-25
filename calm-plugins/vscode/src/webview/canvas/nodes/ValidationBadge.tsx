import React from 'react';

interface ValidationBadgeProps {
    errorCount: number;
    warnCount: number;
    nodeId: string;
}

export function ValidationBadge({ errorCount, warnCount, nodeId }: ValidationBadgeProps) {
    if (errorCount === 0 && warnCount === 0) return null;

    return (
        <div style={badgeContainer}>
            {errorCount > 0 && (
                <span style={{ ...badge, background: '#fecaca', color: '#dc2626' }} title={`${errorCount} error(s) on ${nodeId}`}>
                    {errorCount}
                </span>
            )}
            {warnCount > 0 && (
                <span style={{ ...badge, background: '#fef08a', color: '#a16207' }} title={`${warnCount} warning(s) on ${nodeId}`}>
                    {warnCount}
                </span>
            )}
        </div>
    );
}

const badgeContainer: React.CSSProperties = {
    position: 'absolute', top: '-6px', right: '-4px',
    display: 'flex', gap: '2px', zIndex: 10,
};

const badge: React.CSSProperties = {
    fontSize: '8px', fontWeight: 700, minWidth: '14px', height: '14px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: '7px', padding: '0 3px',
};
