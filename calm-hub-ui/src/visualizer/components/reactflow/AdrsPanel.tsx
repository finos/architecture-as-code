import { THEME } from './theme.js';
import type { AdrsPanelProps } from '../../contracts/contracts.js';
import { FiExternalLink, FiFileText } from 'react-icons/fi';
import { getAdrDisplayName, isCalmHubAdr, toAdrAppRoute } from './adr-utils.js';

export function AdrsPanel({ adrs }: AdrsPanelProps) {
    if (!adrs || adrs.length === 0) return null;

    return (
        <div
            style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                border: `1px solid ${THEME.colors.border}`,
                borderRadius: '8px',
                background: THEME.colors.card,
                overflow: 'hidden',
            }}
        >
            <div
                style={{
                    padding: '10px 12px',
                    borderBottom: `1px solid ${THEME.colors.border}`,
                    background: THEME.colors.backgroundSecondary,
                    fontSize: '13px',
                    fontWeight: 600,
                    color: THEME.colors.foreground,
                }}
            >
                Architecture Decision Records ({adrs.length})
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {adrs.map((adr) => {
                        const isInternal = isCalmHubAdr(adr);
                        const displayName = getAdrDisplayName(adr);

                        if (isInternal) {
                            return (
                                <a
                                    key={adr}
                                    href={`#${toAdrAppRoute(adr)}`}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '8px 12px',
                                        borderRadius: '6px',
                                        border: `1px solid ${THEME.colors.border}`,
                                        background: THEME.colors.card,
                                        color: THEME.colors.accent,
                                        textDecoration: 'none',
                                        fontSize: '13px',
                                        transition: 'background 0.15s',
                                        cursor: 'pointer',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = THEME.colors.backgroundSecondary;
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = THEME.colors.card;
                                    }}
                                >
                                    <FiFileText style={{ flexShrink: 0, width: '16px', height: '16px' }} />
                                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {displayName}
                                    </span>
                                </a>
                            );
                        }

                        return (
                            <a
                                key={adr}
                                href={adr}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '8px 12px',
                                    borderRadius: '6px',
                                    border: `1px solid ${THEME.colors.border}`,
                                    background: THEME.colors.card,
                                    color: THEME.colors.accent,
                                    textDecoration: 'none',
                                    fontSize: '13px',
                                    transition: 'background 0.15s',
                                    cursor: 'pointer',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = THEME.colors.backgroundSecondary;
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = THEME.colors.card;
                                }}
                            >
                                <FiExternalLink style={{ flexShrink: 0, width: '16px', height: '16px' }} />
                                <span
                                    style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                    title={adr}
                                >
                                    {displayName}
                                </span>
                            </a>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
