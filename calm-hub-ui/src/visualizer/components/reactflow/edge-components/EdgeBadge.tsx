import { Info, Shield, ArrowRight } from 'lucide-react';
import { THEME } from '../theme';

export interface EdgeBadgeStyle {
    background: string;
    border: string;
    iconColor: string;
}

export interface EdgeBadgeProps {
    hasFlowInfo: boolean;
    hasAIGF: boolean;
    badgeStyle: EdgeBadgeStyle;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
}

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

export function getBadgeStyle(hasFlowInfo: boolean, hasAIGF: boolean): EdgeBadgeStyle {
    if (hasFlowInfo) {
        return {
            background: `${THEME.colors.accent}20`,
            border: THEME.colors.accent,
            iconColor: THEME.colors.accent,
        };
    }
    if (hasAIGF) {
        return {
            background: `${THEME.colors.success}20`,
            border: THEME.colors.success,
            iconColor: THEME.colors.success,
        };
    }
    return {
        background: `${THEME.colors.muted}20`,
        border: THEME.colors.muted,
        iconColor: THEME.colors.muted,
    };
}
