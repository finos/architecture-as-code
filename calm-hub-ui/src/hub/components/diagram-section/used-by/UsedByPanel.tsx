import { useId } from 'react';
import { FiExternalLink } from 'react-icons/fi';
import { THEME } from '../../../../visualizer/components/reactflow/theme.js';
import type { ImplementationsState } from './usePatternImplementations.js';
import { architectureHref } from './usedBy.js';

const linkStyle = { color: THEME.colors.accentText };

function message(state: ImplementationsState): string | undefined {
    switch (state.status) {
        case 'idle':
        case 'loading':
            return 'Loading…';
        case 'error':
            return 'Could not load the architectures that use this version.';
        case 'unavailable':
            return 'Not available for this pattern.';
        case 'loaded':
            return state.implementations.length === 0 ? 'No architectures use this version.' : undefined;
    }
}

export function UsedByPanel({ state }: { state: ImplementationsState }) {
    const headingId = useId();
    const text = message(state);
    return (
        <div style={{ height: '100%', overflowY: 'auto', display: 'flex', padding: '16px', background: THEME.colors.background }}>
            <section
                aria-labelledby={headingId}
                data-testid="used-by-panel"
                style={{
                    margin: 'auto',
                    width: '100%',
                    maxWidth: '560px',
                    padding: '24px',
                    background: THEME.colors.backgroundSecondary,
                    borderRadius: '8px',
                    border: `1px solid ${THEME.colors.border}`,
                    color: THEME.colors.muted,
                    fontSize: '14px',
                    lineHeight: 1.5,
                    overflowWrap: 'anywhere',
                }}
            >
                <h2 id={headingId} style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: THEME.colors.foreground }}>
                    Architectures that use this version
                </h2>
                <p style={{ margin: '8px 0 0' }}>An architecture appears here when its $schema names this pattern version.</p>
                {text && <p style={{ margin: '16px 0 0' }}>{text}</p>}
                {state.status === 'loaded' && state.implementations.length > 0 && (
                    <ul aria-labelledby={headingId} style={{ margin: '16px 0 0', paddingLeft: 0, listStyle: 'none' }}>
                        {state.implementations.map((implementation) => (
                            <li
                                key={`${implementation.namespace}/${implementation.architectureId}/${implementation.version}`}
                                style={{ padding: '8px 0', borderTop: `1px solid ${THEME.colors.border}` }}
                            >
                                <a
                                    href={architectureHref(implementation)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 hover:underline"
                                    style={linkStyle}
                                >
                                    {implementation.customId ?? `Architecture ${implementation.architectureId}`}
                                    <FiExternalLink style={{ flexShrink: 0, width: '12px', height: '12px' }} aria-hidden="true" />
                                </a>
                                <div style={{ fontSize: '12px' }}>
                                    {implementation.namespace} · version {implementation.version}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}
