import type { ReactNode } from 'react';
import { THEME } from './theme.js';

interface TabButtonProps {
    isActive: boolean;
    onClick: () => void;
    children: ReactNode;
}

export function TabButton({ isActive, onClick, children }: TabButtonProps) {
    return (
        <button
            onClick={onClick}
            style={{
                padding: '6px 12px',
                borderRadius: '4px',
                border: 'none',
                background: isActive ? THEME.colors.accent : 'transparent',
                color: isActive ? '#ffffff' : THEME.colors.foreground,
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
                if (!isActive) {
                    e.currentTarget.style.background = THEME.colors.backgroundSecondary;
                }
            }}
            onMouseLeave={(e) => {
                if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                }
            }}
        >
            {children}
        </button>
    );
}
