import React from 'react';
import { THEME } from '../theme.js';
import { STATUS_STYLES, type Filters, type DeploymentStatus } from './deployment-types.js';

interface FilterBarProps {
    filters: Filters;
    onChange: (f: Filters) => void;
    statusOptions: string[];
    componentOptions: string[];
}

export function FilterBar({ filters, onChange, statusOptions, componentOptions }: FilterBarProps) {
    if (statusOptions.length === 0 && componentOptions.length === 0) return null;

    const hasActiveFilter = filters.status || filters.component;

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
            {statusOptions.length > 0 && (
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
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
                                {style && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: style.dot, flexShrink: 0 }} />}
                                {s}
                            </button>
                        );
                    })}
                </div>
            )}

            {statusOptions.length > 0 && componentOptions.length > 0 && (
                <div style={{ width: '1px', height: '20px', background: THEME.colors.border }} />
            )}

            {componentOptions.length > 0 && (
                <div style={{ position: 'relative' }}>
                    <select
                        style={{
                            ...selectStyle,
                            borderColor: filters.component ? THEME.colors.accent : THEME.colors.border,
                            color: filters.component ? THEME.colors.accent : THEME.colors.muted,
                        }}
                        value={filters.component}
                        onChange={(e) => onChange({ ...filters, component: e.target.value })}
                        aria-label="Filter by component"
                    >
                        <option value="">Components</option>
                        {componentOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <span style={{ position: 'absolute', right: '7px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: '9px', color: THEME.colors.muted }}>▾</span>
                </div>
            )}

            {hasActiveFilter && (
                <button
                    onClick={() => onChange({ status: '', component: '' })}
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
