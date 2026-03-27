import { THEME } from '../theme.js';

function ComponentBadge({ id }: { id: string }) {
    return (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                fontSize: '12px',
                padding: '3px 8px',
                borderRadius: '4px',
                background: THEME.colors.backgroundSecondary,
                color: THEME.colors.foreground,
                fontFamily: 'monospace',
                border: `1px solid ${THEME.colors.border}`,
            }}
        >
            {id}
        </span>
    );
}

export function ScopeSection({ appliesTo }: { appliesTo: string[] }) {
    if (!appliesTo || appliesTo.length === 0) return null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: THEME.colors.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Deployed Components
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {appliesTo.map((id) => <ComponentBadge key={id} id={id} />)}
            </div>
        </div>
    );
}
