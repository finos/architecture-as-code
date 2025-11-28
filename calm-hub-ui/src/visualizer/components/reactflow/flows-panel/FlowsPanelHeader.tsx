import { FiGitBranch } from 'react-icons/fi';
import { THEME } from '../theme';

interface FlowsPanelHeaderProps {
    flowCount: number;
}

export function FlowsPanelHeader({ flowCount }: FlowsPanelHeaderProps) {
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
            <FiGitBranch style={{ width: '16px', height: '16px', color: THEME.colors.accent }} />
            <span style={{ fontWeight: 600, fontSize: '14px', color: THEME.colors.foreground }}>
                Business Flows
            </span>
            <span
                style={{
                    marginLeft: 'auto',
                    fontSize: '12px',
                    color: THEME.colors.muted,
                }}
            >
                {flowCount} {flowCount === 1 ? 'flow' : 'flows'}
            </span>
        </div>
    );
}
