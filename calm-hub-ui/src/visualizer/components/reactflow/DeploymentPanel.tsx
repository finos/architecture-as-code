import React, { useState, useMemo } from 'react';
import { IoOpenOutline } from 'react-icons/io5';
import { THEME } from './theme.js';
import type { DeploymentPanelProps, Decorator } from '../../contracts/contracts.js';

type DeploymentStatus = 'pending' | 'in-progress' | 'completed' | 'failed' | 'rolled-back';

interface DeploymentData {
    'start-time'?: string;
    'end-time'?: string;
    status?: DeploymentStatus;
    'deployment-details'?: string;
    notes?: string;
    [key: string]: unknown;
}

const STATUS_STYLES: Record<DeploymentStatus, { background: string; color: string; dot: string }> = {
    completed:     { background: '#dcfce7', color: '#15803d', dot: '#16a34a' },
    failed:        { background: '#fee2e2', color: '#b91c1c', dot: '#dc2626' },
    'in-progress': { background: '#dbeafe', color: '#1d4ed8', dot: '#2563eb' },
    pending:       { background: '#f3f4f6', color: '#4b5563', dot: '#6b7280' },
    'rolled-back': { background: '#fef3c7', color: '#92400e', dot: '#d97706' },
};

const ITEM_TYPE_STYLES: Record<'node' | 'relationship' | 'unknown', { background: string; color: string }> = {
    node:         { background: '#ede9fe', color: '#6d28d9' },
    relationship: { background: '#ffedd5', color: '#c2410c' },
    unknown:      { background: '#f3f4f6', color: '#4b5563' },
};

function formatDateTime(iso?: string): string {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return iso;
    }
}

function StatusBadge({ status }: { status?: DeploymentStatus }) {
    const style = status ? STATUS_STYLES[status] : { background: '#f3f4f6', color: '#4b5563', dot: '#6b7280' };
    return (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11px',
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: '12px',
                background: style.background,
                color: style.color,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                whiteSpace: 'nowrap',
            }}
        >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: style.dot, flexShrink: 0 }} />
            {status ?? 'unknown'}
        </span>
    );
}

function sortedByStartTime(decorators: Decorator[]): Decorator[] {
    return [...decorators].sort((a, b) => {
        const aTime = ((a.data as DeploymentData) ?? {})['start-time'] ?? '';
        const bTime = ((b.data as DeploymentData) ?? {})['start-time'] ?? '';
        return bTime.localeCompare(aTime);
    });
}

// ── Summary helpers ───────────────────────────────────────────────────────────

function relativeTime(iso?: string): string {
    if (!iso) return '—';
    const diffMs = Date.now() - new Date(iso).getTime();
    const diffDays = Math.floor(diffMs / 86_400_000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
}

function formatDuration(ms: number): string {
    const totalSecs = Math.round(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

function avgDuration(decorators: Decorator[]): string {
    const durations = decorators
        .map((dec) => {
            const d = (dec.data ?? {}) as DeploymentData;
            if (!d['start-time'] || !d['end-time']) return null;
            const ms = new Date(d['end-time']).getTime() - new Date(d['start-time']).getTime();
            return ms >= 0 ? ms : null;
        })
        .filter((n): n is number => n !== null);
    if (durations.length === 0) return '—';
    return formatDuration(durations.reduce((a, b) => a + b, 0) / durations.length);
}

function latestDeployment(decorators: Decorator[]): Decorator | undefined {
    return sortedByStartTime(decorators)[0];
}

// ── Summary ───────────────────────────────────────────────────────────────────

function SummarySection({ decorators }: { decorators: Decorator[] }) {
    const total      = decorators.length;
    const completed  = decorators.filter((d) => ((d.data ?? {}) as DeploymentData).status === 'completed').length;
    const failed     = decorators.filter((d) => ((d.data ?? {}) as DeploymentData).status === 'failed').length;
    const inProgress = decorators.filter((d) => ((d.data ?? {}) as DeploymentData).status === 'in-progress').length;

    const settled = total - inProgress;
    const successRate = settled > 0 ? Math.round((completed / settled) * 100) : null;
    const successColor = successRate === null ? undefined
        : successRate >= 80 ? '#15803d'
        : successRate >= 50 ? '#92400e'
        : '#b91c1c';

    const avg = avgDuration(decorators);
    const latest = latestDeployment(decorators);
    const latestData = (latest?.data ?? {}) as DeploymentData;
    const latestStatus = latestData.status;
    const latestStyle = latestStatus ? STATUS_STYLES[latestStatus] : null;
    const lastStart = latestData['start-time'];

    const card = (label: string, value: string | number, accent?: string, sub?: string) => (
        <div
            key={label}
            style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: THEME.colors.card,
                borderRadius: '6px',
                border: `1px solid ${THEME.colors.border}`,
                minWidth: '76px',
                gap: '4px',
            }}
        >
            <span style={{ fontSize: '20px', fontWeight: 700, color: accent ?? THEME.colors.foreground, lineHeight: 1 }}>
                {value}
            </span>
            <div>
                <div style={{ fontSize: '10px', fontWeight: 600, color: THEME.colors.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {label}
                </div>
                {sub && <div style={{ fontSize: '10px', color: THEME.colors.muted, marginTop: '1px' }}>{sub}</div>}
            </div>
        </div>
    );

    return (
        <div
            style={{
                padding: '12px 14px',
                borderBottom: `1px solid ${THEME.colors.border}`,
                background: THEME.colors.backgroundSecondary,
                display: 'flex',
                gap: '8px',
                alignItems: 'stretch',
                flexWrap: 'wrap',
            }}
        >
            {/* Stat cards */}
            {card('Total', total)}
            {card('Completed', completed, '#15803d')}
            {card('Failed', failed, '#b91c1c')}
            {inProgress > 0 && card('In Progress', inProgress, '#1d4ed8')}
            {successRate !== null && card('Success Rate', `${successRate}%`, successColor, `${settled} settled`)}
            {avg !== '—' && card('Avg Duration', avg, undefined, 'completed runs')}

            {/* Divider */}
            <div style={{ width: '1px', background: THEME.colors.border, alignSelf: 'stretch', margin: '0 4px' }} />

            {/* Latest deployment highlight */}
            {latest && (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        background: THEME.colors.card,
                        borderRadius: '6px',
                        border: `1px solid ${THEME.colors.border}`,
                        gap: '6px',
                        flex: 1,
                        minWidth: '160px',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '10px', fontWeight: 600, color: THEME.colors.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Latest Deployment
                        </span>
                        {latestStyle && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 700, color: latestStyle.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: latestStyle.dot, flexShrink: 0 }} />
                                {latestStatus}
                            </span>
                        )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                        <span style={{ fontSize: '16px', fontWeight: 700, color: THEME.colors.foreground }}>{relativeTime(lastStart)}</span>
                        <span style={{ fontSize: '11px', color: THEME.colors.muted }}>{formatDateTime(lastStart)}</span>
                    </div>
                    {latestData['end-time'] && latestData['start-time'] && (
                        <span style={{ fontSize: '11px', color: THEME.colors.muted }}>
                            Duration: {formatDuration(new Date(latestData['end-time']).getTime() - new Date(latestData['start-time']).getTime())}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}

// ── Filters ───────────────────────────────────────────────────────────────────

interface Filters {
    status: string;
    node: string;
    relationship: string;
}

function FilterBar({
    filters,
    onChange,
    statusOptions,
    nodeOptions,
    relationshipOptions,
}: {
    filters: Filters;
    onChange: (f: Filters) => void;
    statusOptions: string[];
    nodeOptions: string[];
    relationshipOptions: string[];
}) {
    if (statusOptions.length === 0 && nodeOptions.length === 0 && relationshipOptions.length === 0) return null;

    const hasActiveFilter = filters.status || filters.node || filters.relationship;

    const selectStyle: React.CSSProperties = {
        fontSize: '11px',
        padding: '4px 8px',
        borderRadius: '20px',
        border: `1px solid ${THEME.colors.border}`,
        background: THEME.colors.card,
        color: THEME.colors.foreground,
        cursor: 'pointer',
        appearance: 'none' as React.CSSProperties['appearance'],
        paddingRight: '20px',
    };

    return (
        <div
            style={{
                display: 'flex',
                gap: '12px',
                padding: '8px 14px',
                borderBottom: `1px solid ${THEME.colors.border}`,
                background: THEME.colors.card,
                flexWrap: 'wrap',
                alignItems: 'center',
            }}
        >
            {/* Status pills */}
            {statusOptions.length > 0 && (
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {/* "All" pill */}
                    <button
                        onClick={() => onChange({ ...filters, status: '' })}
                        style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '3px 10px',
                            borderRadius: '20px',
                            border: `1px solid ${filters.status === '' ? THEME.colors.accent : THEME.colors.border}`,
                            background: filters.status === '' ? THEME.colors.accent : 'transparent',
                            color: filters.status === '' ? '#fff' : THEME.colors.muted,
                            cursor: 'pointer',
                            transition: 'all 0.1s',
                        }}
                    >
                        All
                    </button>
                    {statusOptions.map((s) => {
                        const style = STATUS_STYLES[s as DeploymentStatus];
                        const isActive = filters.status === s;
                        return (
                            <button
                                key={s}
                                onClick={() => onChange({ ...filters, status: isActive ? '' : s })}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    padding: '3px 10px',
                                    borderRadius: '20px',
                                    border: `1px solid ${isActive ? (style?.dot ?? THEME.colors.accent) : THEME.colors.border}`,
                                    background: isActive ? (style?.background ?? THEME.colors.backgroundSecondary) : 'transparent',
                                    color: isActive ? (style?.color ?? THEME.colors.foreground) : THEME.colors.muted,
                                    cursor: 'pointer',
                                    textTransform: 'capitalize',
                                    transition: 'all 0.1s',
                                }}
                            >
                                {style && (
                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: style.dot, flexShrink: 0 }} />
                                )}
                                {s}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Divider */}
            {statusOptions.length > 0 && (nodeOptions.length > 0 || relationshipOptions.length > 0) && (
                <div style={{ width: '1px', height: '20px', background: THEME.colors.border }} />
            )}

            {/* Node select */}
            {nodeOptions.length > 0 && (
                <div style={{ position: 'relative' }}>
                    <select
                        style={{
                            ...selectStyle,
                            borderColor: filters.node ? ITEM_TYPE_STYLES.node.color : THEME.colors.border,
                            color: filters.node ? ITEM_TYPE_STYLES.node.color : THEME.colors.muted,
                            background: filters.node ? ITEM_TYPE_STYLES.node.background : THEME.colors.card,
                        }}
                        value={filters.node}
                        onChange={(e) => onChange({ ...filters, node: e.target.value })}
                        aria-label="Filter by node"
                    >
                        <option value="">Nodes</option>
                        {nodeOptions.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <span style={{ position: 'absolute', right: '7px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: '9px', color: THEME.colors.muted }}>▾</span>
                </div>
            )}

            {/* Relationship select */}
            {relationshipOptions.length > 0 && (
                <div style={{ position: 'relative' }}>
                    <select
                        style={{
                            ...selectStyle,
                            borderColor: filters.relationship ? ITEM_TYPE_STYLES.relationship.color : THEME.colors.border,
                            color: filters.relationship ? ITEM_TYPE_STYLES.relationship.color : THEME.colors.muted,
                            background: filters.relationship ? ITEM_TYPE_STYLES.relationship.background : THEME.colors.card,
                        }}
                        value={filters.relationship}
                        onChange={(e) => onChange({ ...filters, relationship: e.target.value })}
                        aria-label="Filter by relationship"
                    >
                        <option value="">Relationships</option>
                        {relationshipOptions.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <span style={{ position: 'absolute', right: '7px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: '9px', color: THEME.colors.muted }}>▾</span>
                </div>
            )}

            {/* Clear — only shows when a filter is active */}
            {hasActiveFilter && (
                <button
                    onClick={() => onChange({ status: '', node: '', relationship: '' })}
                    style={{
                        marginLeft: 'auto',
                        fontSize: '11px',
                        padding: '3px 10px',
                        borderRadius: '20px',
                        border: `1px solid ${THEME.colors.border}`,
                        background: 'transparent',
                        color: THEME.colors.muted,
                        cursor: 'pointer',
                    }}
                >
                    Clear
                </button>
            )}
        </div>
    );
}

// ── Scope section (applies-to) ────────────────────────────────────────────────

function ComponentBadge({ id, type }: { id: string; type: 'node' | 'relationship' | 'unknown' }) {
    const style = ITEM_TYPE_STYLES[type];
    return (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                fontSize: '12px',
                padding: '3px 8px',
                borderRadius: '4px',
                background: style.background,
                color: style.color,
                fontFamily: 'monospace',
            }}
        >
            {id}
        </span>
    );
}

function ScopeSection({ appliesTo, architectureItems }: { appliesTo: string[]; architectureItems?: Record<string, 'node' | 'relationship'> }) {
    if (!appliesTo || appliesTo.length === 0) return null;

    const nodes         = appliesTo.filter((id) => architectureItems?.[id] === 'node');
    const relationships = appliesTo.filter((id) => architectureItems?.[id] === 'relationship');
    const unknown       = appliesTo.filter((id) => !architectureItems?.[id]);
    const hasBoth = nodes.length > 0 && relationships.length > 0;

    const labelStyle: React.CSSProperties = {
        fontSize: '10px',
        fontWeight: 600,
        color: THEME.colors.muted,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: '4px',
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: THEME.colors.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Deployed Components
            </div>
            {hasBoth ? (
                <div style={{ display: 'flex', gap: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={labelStyle}>Nodes</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {nodes.map((id) => <ComponentBadge key={id} id={id} type="node" />)}
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={labelStyle}>Relationships</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {relationships.map((id) => <ComponentBadge key={id} id={id} type="relationship" />)}
                        </div>
                    </div>
                    {unknown.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={labelStyle}>Unknown</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {unknown.map((id) => <ComponentBadge key={id} id={id} type="unknown" />)}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {[...nodes, ...relationships, ...unknown].map((id) => {
                        const type = architectureItems?.[id] ?? 'unknown';
                        return <ComponentBadge key={id} id={id} type={type} />;
                    })}
                </div>
            )}
        </div>
    );
}

// ── Detail view ───────────────────────────────────────────────────────────────

function DeploymentDetail({ decorator, architectureItems }: { decorator: Decorator; architectureItems?: Record<string, 'node' | 'relationship'> }) {
    const d = (decorator.data ?? {}) as DeploymentData;
    const extraEntries = Object.entries(d).filter(
        ([k]) => !['start-time', 'end-time', 'status', 'deployment-details', 'notes'].includes(k)
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header: status + link button */}
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

            {/* Body */}
            <div style={{ flex: 1, overflow: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <tbody>
                        <TableRow label="Started" value={formatDateTime(d['start-time'])} />
                        {d['end-time'] && <TableRow label="Completed" value={formatDateTime(d['end-time'])} />}
                        {d.notes && <TableRow label="Notes" value={d.notes} />}
                    </tbody>
                </table>

                {decorator.appliesTo && decorator.appliesTo.length > 0 && (
                    <ScopeSection appliesTo={decorator.appliesTo} architectureItems={architectureItems} />
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

// ── Main panel ────────────────────────────────────────────────────────────────

export function DeploymentPanel({ decorators, architectureItems }: DeploymentPanelProps) {
    const sorted = sortedByStartTime(decorators ?? []);
    const [selectedIndex, setSelectedIndex] = useState<number>(0);
    const [filters, setFilters] = useState<Filters>({ status: '', node: '', relationship: '' });

    // Build filter option lists from all decorators
    const statusOptions = useMemo(() => {
        const seen = new Set<string>();
        sorted.forEach((dec) => {
            const s = ((dec.data ?? {}) as DeploymentData).status;
            if (s) seen.add(s);
        });
        return Array.from(seen);
    }, [sorted]);

    const nodeOptions = useMemo(() => {
        const seen = new Set<string>();
        sorted.forEach((dec) => {
            (dec.appliesTo ?? []).forEach((id) => {
                if (architectureItems?.[id] === 'node') seen.add(id);
            });
        });
        return Array.from(seen);
    }, [sorted, architectureItems]);

    const relationshipOptions = useMemo(() => {
        const seen = new Set<string>();
        sorted.forEach((dec) => {
            (dec.appliesTo ?? []).forEach((id) => {
                if (architectureItems?.[id] === 'relationship') seen.add(id);
            });
        });
        return Array.from(seen);
    }, [sorted, architectureItems]);

    // Apply filters
    const filtered = useMemo(() => {
        return sorted.filter((dec) => {
            const d = (dec.data ?? {}) as DeploymentData;
            if (filters.status && d.status !== filters.status) return false;
            if (filters.node && !dec.appliesTo?.includes(filters.node)) return false;
            if (filters.relationship && !dec.appliesTo?.includes(filters.relationship)) return false;
            return true;
        });
    }, [sorted, filters]);

    // Reset selection when filtered list changes
    const handleFiltersChange = (f: Filters) => {
        setFilters(f);
        setSelectedIndex(0);
    };

    if (sorted.length === 0) {
        return (
            <div
                style={{
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: THEME.colors.muted,
                    fontSize: '13px',
                    fontStyle: 'italic',
                }}
            >
                No deployment history found for this architecture.
            </div>
        );
    }

    const selected = filtered[selectedIndex] ?? filtered[0];

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                border: `1px solid ${THEME.colors.border}`,
                borderRadius: '8px',
                overflow: 'hidden',
                background: THEME.colors.backgroundSecondary,
            }}
        >
            <SummarySection decorators={sorted} />
            <FilterBar
                filters={filters}
                onChange={handleFiltersChange}
                statusOptions={statusOptions}
                nodeOptions={nodeOptions}
                relationshipOptions={relationshipOptions}
            />

            {/* Main: history list + detail */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {/* Left: history list */}
                <div
                    style={{
                        width: '220px',
                        flexShrink: 0,
                        borderRight: `1px solid ${THEME.colors.border}`,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                    }}
                >
                    <div
                        style={{
                            padding: '10px 12px',
                            fontSize: '11px',
                            fontWeight: 600,
                            color: THEME.colors.muted,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            borderBottom: `1px solid ${THEME.colors.border}`,
                            background: THEME.colors.card,
                        }}
                    >
                        History ({filtered.length}{filtered.length !== sorted.length ? ` of ${sorted.length}` : ''})
                    </div>
                    <div style={{ flex: 1, overflow: 'auto' }}>
                        {filtered.length === 0 ? (
                            <div style={{ padding: '16px 12px', fontSize: '12px', color: THEME.colors.muted, fontStyle: 'italic' }}>
                                No deployments match the current filters.
                            </div>
                        ) : (
                            filtered.map((decorator, index) => {
                                const d = (decorator.data ?? {}) as DeploymentData;
                                const isSelected = index === selectedIndex;
                                const statusStyle = d.status ? STATUS_STYLES[d.status] : STATUS_STYLES.pending;

                                return (
                                    <button
                                        key={decorator.uniqueId ?? index}
                                        onClick={() => setSelectedIndex(index)}
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '4px',
                                            width: '100%',
                                            padding: '10px 12px',
                                            borderTop: 'none',
                                            borderRight: 'none',
                                            borderBottom: `1px solid ${THEME.colors.border}`,
                                            borderLeft: isSelected ? `3px solid ${THEME.colors.accent}` : '3px solid transparent',
                                            background: isSelected ? `${THEME.colors.accent}18` : 'transparent',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span
                                                style={{
                                                    width: '8px',
                                                    height: '8px',
                                                    borderRadius: '50%',
                                                    background: statusStyle.dot,
                                                    flexShrink: 0,
                                                }}
                                            />
                                            <span
                                                style={{
                                                    fontSize: '12px',
                                                    fontWeight: isSelected ? 600 : 400,
                                                    color: isSelected ? THEME.colors.accent : THEME.colors.foreground,
                                                    textTransform: 'capitalize',
                                                }}
                                            >
                                                {d.status ?? 'unknown'}
                                            </span>
                                        </div>
                                        <span style={{ fontSize: '11px', color: THEME.colors.muted, paddingLeft: '14px' }}>
                                            {formatDateTime(d['start-time'])}
                                        </span>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Right: detail view */}
                <div style={{ flex: 1, overflow: 'hidden', background: THEME.colors.card }}>
                    {selected ? (
                        <DeploymentDetail decorator={selected} architectureItems={architectureItems} />
                    ) : (
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: THEME.colors.muted, fontSize: '13px', fontStyle: 'italic' }}>
                            Select a deployment to view details.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
