import { FiShield } from 'react-icons/fi';
import { THEME } from '../theme';

interface ControlsPanelHeaderProps {
    controlCount: number;
}

export function ControlsPanelHeader({ controlCount }: ControlsPanelHeaderProps) {
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 16px',
                borderBottom: `1px solid ${THEME.colors.border}`,
                background: THEME.colors.backgroundSecondary,
            }}
        >
            <FiShield style={{ width: '16px', height: '16px', color: THEME.colors.accent }} />
            <span style={{ fontWeight: 600, fontSize: '14px', color: THEME.colors.foreground }}>
                CALM Controls
            </span>
            <span
                style={{
                    marginLeft: 'auto',
                    fontSize: '12px',
                    color: THEME.colors.muted,
                }}
            >
                {controlCount} {controlCount === 1 ? 'control' : 'controls'}
            </span>
        </div>
    );
}
