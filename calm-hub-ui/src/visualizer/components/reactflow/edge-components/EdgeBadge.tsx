import { Info, Shield, ArrowRight } from 'lucide-react';
import type { EdgeBadgeProps } from '../../../contracts/contracts.js';

export function EdgeBadge({
    hasFlowInfo,
    hasAIGF,
    badgeStyle,
    onMouseEnter,
    onMouseLeave,
}: EdgeBadgeProps) {
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                border: `2px solid ${badgeStyle.border}`,
                background: badgeStyle.background,
                cursor: 'help',
                transition: 'all 0.2s',
            }}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            {hasFlowInfo ? (
                <ArrowRight style={{ width: '12px', height: '12px', color: badgeStyle.iconColor }} />
            ) : hasAIGF ? (
                <Shield style={{ width: '12px', height: '12px', color: badgeStyle.iconColor }} />
            ) : (
                <Info style={{ width: '12px', height: '12px', color: badgeStyle.iconColor }} />
            )}
        </div>
    );
}
