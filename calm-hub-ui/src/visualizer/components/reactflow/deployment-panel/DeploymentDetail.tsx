import { IoOpenOutline } from 'react-icons/io5';
import { THEME } from '../theme.js';
import type { DeploymentDecorator } from '../../../contracts/contracts.js';
import { formatDateTime } from './deployment-types.js';
import { StatusBadge } from './StatusBadge.js';
import { ScopeSection } from './ScopeSection.js';

const tdStyle: React.CSSProperties = {
    padding: '8px 12px',
    color: THEME.colors.foreground,
    borderBottom: `1px solid ${THEME.colors.border}`,
    lineHeight: '1.5',
};

function TableRow({ label, value }: { label: string; value: string }) {
    return (
        <tr>
            <td style={{ ...tdStyle, width: '40%', fontWeight: 600, color: THEME.colors.muted, fontSize: '12px' }}>{label}</td>
            <td style={tdStyle}>{value}</td>
        </tr>
    );
}

export function DeploymentDetail({ decorator }: { decorator: DeploymentDecorator }) {
    const d = decorator.data;
    const extraEntries = Object.entries(d).filter(
        ([k]) => !['start-time', 'end-time', 'status', 'deployment-details', 'notes'].includes(k)
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div
                style={{
                    padding: '14px 16px',
                    borderBottom: `1px solid ${THEME.colors.border}`,
                    background: THEME.colors.backgroundSecondary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    flexWrap: 'wrap',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <StatusBadge status={d.status} />
                    {decorator.uniqueId && (
                        <span style={{ fontSize: '12px', color: THEME.colors.muted, fontFamily: 'monospace' }}>
                            {decorator.uniqueId}
                        </span>
                    )}
                </div>
                {d['deployment-details'] ? (
                    <a
                        href={d['deployment-details']}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontSize: '12px',
                            fontWeight: 600,
                            padding: '6px 14px',
                            borderRadius: '6px',
                            background: '#2563eb',
                            color: '#ffffff',
                            textDecoration: 'none',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        <IoOpenOutline style={{ width: '13px', height: '13px' }} />
                        Deployment
                    </a>
                ) : (
                    <span
                        title="Deployment link not recorded"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontSize: '12px',
                            fontWeight: 600,
                            padding: '6px 14px',
                            borderRadius: '6px',
                            background: '#e5e7eb',
                            color: '#9ca3af',
                            whiteSpace: 'nowrap',
                            cursor: 'default',
                        }}
                    >
                        <IoOpenOutline style={{ width: '13px', height: '13px' }} />
                        Deployment Details
                    </span>
                )}
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <tbody>
                        <TableRow label="Started" value={formatDateTime(d['start-time'])} />
                        {d['end-time'] && <TableRow label="Completed" value={formatDateTime(d['end-time'])} />}
                        {d.notes && <TableRow label="Notes" value={d.notes} />}
                    </tbody>
                </table>

                {decorator.appliesTo && decorator.appliesTo.length > 0 && (
                    <ScopeSection appliesTo={decorator.appliesTo} />
                )}

                {extraEntries.length > 0 && (
                    <>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: THEME.colors.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Additional Information
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                            <tbody>
                                {extraEntries.map(([key, val], i) => (
                                    <tr key={key} style={{ background: i % 2 === 0 ? THEME.colors.backgroundSecondary : THEME.colors.card }}>
                                        <td style={{ ...tdStyle, fontFamily: 'monospace', color: THEME.colors.muted }}>{key}</td>
                                        <td style={{ ...tdStyle, wordBreak: 'break-word', whiteSpace: typeof val === 'object' ? 'pre-wrap' : 'normal', fontFamily: typeof val === 'object' ? 'monospace' : 'inherit' }}>
                                            {typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val ?? '—')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </>
                )}
            </div>
        </div>
    );
}
