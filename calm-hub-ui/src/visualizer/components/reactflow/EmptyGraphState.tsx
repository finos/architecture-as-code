import { THEME } from './theme.js';

interface EmptyGraphStateProps {
    message: string;
}

export function EmptyGraphState({ message }: EmptyGraphStateProps) {
    return (
        <div
            style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: THEME.colors.background,
                color: THEME.colors.muted,
                fontSize: '14px',
            }}
        >
            <div
                style={{
                    padding: '24px',
                    background: THEME.colors.backgroundSecondary,
                    borderRadius: '8px',
                    border: `1px solid ${THEME.colors.border}`,
                    maxWidth: '400px',
                    textAlign: 'center',
                }}
            >
                {message}
            </div>
        </div>
    );
}
