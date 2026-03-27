import { useState, useMemo } from 'react';
import { THEME } from './theme.js';
import type { DeploymentPanelProps } from '../../contracts/contracts.js';
import {
    SummarySection,
    FilterBar,
    DeploymentDetail,
    sortedByStartTime,
    type DeploymentData,
    type Filters,
    STATUS_STYLES,
} from './deployment-panel/index.js';

export function DeploymentPanel({ decorators }: DeploymentPanelProps) {
    const sorted = sortedByStartTime(decorators ?? []);
    const [selectedIndex, setSelectedIndex] = useState<number>(0);
    const [filters, setFilters] = useState<Filters>({ status: '', component: '' });

    const statusOptions = useMemo(() => {
        const seen = new Set<string>();
        sorted.forEach((dec) => {
            const s = ((dec.data ?? {}) as DeploymentData).status;
            if (s) seen.add(s);
        });
        return Array.from(seen);
    }, [sorted]);

    const componentOptions = useMemo(() => {
        const seen = new Set<string>();
        sorted.forEach((dec) => (dec.appliesTo ?? []).forEach((id) => seen.add(id)));
        return Array.from(seen);
    }, [sorted]);

    const filtered = useMemo(() => {
        return sorted.filter((dec) => {
            const d = (dec.data ?? {}) as DeploymentData;
            if (filters.status && d.status !== filters.status) return false;
            if (filters.component && !dec.appliesTo?.includes(filters.component)) return false;
            return true;
        });
    }, [sorted, filters]);

    const handleFiltersChange = (f: Filters) => {
        setFilters(f);
        setSelectedIndex(0);
    };

    if (sorted.length === 0) {
        return (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: THEME.colors.muted, fontSize: '13px', fontStyle: 'italic' }}>
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
                componentOptions={componentOptions}
            />

            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {/* History list */}
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
                                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: statusStyle.dot, flexShrink: 0 }} />
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
                                            {new Date(d['start-time'] ?? '').toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Detail view */}
                <div style={{ flex: 1, overflow: 'hidden', background: THEME.colors.card }}>
                    {selected ? (
                        <DeploymentDetail decorator={selected} />
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
