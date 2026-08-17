import React, { useState, useRef, useCallback } from 'react';

interface ControlEntry { description?: string; requirements?: Array<{ 'requirement-url'?: string; config?: { value?: string } }>; metadata?: { validation?: { pattern?: string; 'allowed-values'?: string[]; example?: string } } }

interface ControlsListProps {
    controls: Record<string, ControlEntry> | undefined;
    onUpdate: (controls: Record<string, ControlEntry>) => void;
    readonly?: boolean;
    valueOnly?: boolean;
    expandControl?: string | null;
    onControlFocused?: (url: string | null) => void;
}

export function ControlsList({ controls, onUpdate, readonly = false, valueOnly = false, expandControl = null, onControlFocused }: ControlsListProps) {
    const [sectionExpanded, setSectionExpanded] = useState(false);
    const [expandedControls, setExpandedControls] = useState<Set<string>>(new Set());
    const valueTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
    const lastExpand = useRef<string | null>(null);

    if (expandControl && expandControl !== lastExpand.current) {
        lastExpand.current = expandControl;
        setSectionExpanded(true);
        setExpandedControls(new Set([expandControl]));
    } else if (!expandControl && lastExpand.current) {
        lastExpand.current = null;
    }

    const entries = Object.entries(controls ?? {});
    const count = entries.length;

    const toggleControl = (key: string) => {
        const next = new Set(expandedControls);
        if (next.has(key)) next.delete(key); else next.add(key);
        setExpandedControls(next);
    };

    const handleValueInput = useCallback((key: string, value: string) => {
        clearTimeout(valueTimers.current[key]);
        valueTimers.current[key] = setTimeout(() => {
            const updated = { ...(controls ?? {}) };
            const ctrl = { ...updated[key] };
            const reqs = [...(ctrl.requirements ?? [])];
            if (reqs.length === 0) reqs.push({ 'requirement-url': '' });
            reqs[0] = { ...reqs[0], config: { value } };
            ctrl.requirements = reqs;
            updated[key] = ctrl;
            onUpdate(updated);
        }, 300);
    }, [controls, onUpdate]);

    const handleRemove = (key: string) => { const u = { ...(controls ?? {}) }; delete u[key]; onUpdate(u); };
    const handleRename = (oldKey: string, newKey: string) => {
        const trimmed = newKey.trim();
        if (!trimmed || trimmed === oldKey) return;
        const existing = controls ?? {};
        if (trimmed in existing) return;
        const updated: Record<string, ControlEntry> = {};
        for (const [k, v] of Object.entries(existing)) {
            if (k === oldKey) updated[trimmed] = v;
            else updated[k] = v;
        }
        onUpdate(updated);
        setExpandedControls((prev) => {
            const next = new Set(prev);
            if (next.has(oldKey)) { next.delete(oldKey); next.add(trimmed); }
            return next;
        });
    };
    const handleAdd = () => {
        const key = `custom-control-${Date.now()}`;
        onUpdate({ ...(controls ?? {}), [key]: { description: '', requirements: [{ 'requirement-url': '' }] } });
        setExpandedControls(new Set([...expandedControls, key]));
        setSectionExpanded(true);
    };

    const getConfigValue = (ctrl: ControlEntry): string => ctrl?.requirements?.[0]?.config?.value ?? '';
    const getValidation = (ctrl: ControlEntry) => ctrl?.metadata?.validation ?? null;

    return (
        <div style={{ borderTop: '1px solid var(--calm-border)' }}>
            <button type="button" onClick={() => setSectionExpanded(!sectionExpanded)} style={toggleStyle}>
                <span style={{ fontSize: '8px', display: 'inline-block', transform: sectionExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>&#9654;</span>
                <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--calm-fg-muted)' }}>
                    Controls <span style={{ padding: '1px 6px', borderRadius: '8px', fontSize: '10px', fontWeight: 700, background: 'var(--calm-badge-bg)', color: 'var(--calm-badge-fg)', marginLeft: '6px' }}>{count}</span>
                </span>
            </button>

            {sectionExpanded && (
                <div style={{ padding: '0 14px 10px' }}>
                    {entries.length === 0 && <p style={{ fontSize: '11px', color: 'var(--calm-fg-muted)', fontStyle: 'italic' }}>No controls defined</p>}
                    {entries.map(([key, control]) => {
                        const validation = getValidation(control);
                        const isExpanded = expandedControls.has(key);
                        return (
                            <div key={key} style={{ border: '1px solid var(--calm-border)', borderRadius: '4px', marginBottom: '4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', background: 'var(--calm-bg-secondary)' }}>
                                    <button type="button" onClick={() => toggleControl(key)} style={{ display: 'flex', alignItems: 'center', gap: '5px', flex: readonly || valueOnly ? 1 : 0, padding: '6px 8px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--calm-fg)', flexShrink: 0 }}>
                                        <span style={{ fontSize: '7px', display: 'inline-block', transform: isExpanded ? 'rotate(90deg)' : 'none' }}>&#9654;</span>
                                        {(readonly || valueOnly) && <span style={{ fontSize: '11px', fontWeight: 600, fontFamily: 'monospace' }}>{key}</span>}
                                    </button>
                                    {!readonly && !valueOnly && (
                                        <input
                                            type="text"
                                            defaultValue={key}
                                            key={`rename-${key}`}
                                            onBlur={(e) => handleRename(key, e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                            style={{ flex: 1, fontSize: '11px', fontWeight: 600, fontFamily: 'monospace', color: 'var(--calm-fg)', background: 'transparent', border: 'none', outline: 'none', padding: '4px 0', minWidth: 0 }}
                                        />
                                    )}
                                    {!readonly && !valueOnly && <button type="button" onClick={() => handleRemove(key)} style={{ width: '20px', height: '20px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--calm-fg-muted)', fontSize: '14px' }}>&times;</button>}
                                </div>
                                {isExpanded && (
                                    <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px', background: 'var(--calm-bg)' }}>
                                        {(!valueOnly || validation) && (
                                            <div>
                                                <span style={fieldLabelStyle}>Value</span>
                                                {readonly ? (
                                                    <p style={{ fontSize: '11px', color: 'var(--calm-fg-muted)', margin: 0 }}>{getConfigValue(control) || '— not configured —'}</p>
                                                ) : validation?.['allowed-values'] ? (
                                                    <select defaultValue={getConfigValue(control)} onChange={(e) => handleValueInput(key, e.target.value)} style={ctrlInputStyle}>
                                                        <option value="">— Select —</option>
                                                        {validation['allowed-values'].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                                                    </select>
                                                ) : (
                                                    <input type="text" defaultValue={getConfigValue(control)} onInput={(e) => handleValueInput(key, (e.target as HTMLInputElement).value)} placeholder={validation?.example ?? 'Enter value...'} style={ctrlInputStyle} />
                                                )}
                                            </div>
                                        )}
                                        {valueOnly && control.description && <p style={{ fontSize: '10px', color: 'var(--calm-fg-muted)', margin: 0, fontStyle: 'italic' }}>{control.description}</p>}
                                        {valueOnly && control.requirements?.map((req, idx) => (
                                            req['requirement-url'] && <button key={idx} type="button" onClick={() => onControlFocused?.(req['requirement-url']!)} style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--calm-link)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', textDecoration: 'underline dotted', padding: 0 }}>{req['requirement-url']}</button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {!readonly && !valueOnly && <button type="button" onClick={handleAdd} style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--calm-link)', background: 'none', border: '1px dashed var(--calm-link)', borderRadius: '4px', cursor: 'pointer', marginTop: '4px' }}>+ Add Control</button>}
                </div>
            )}
        </div>
    );
}

const toggleStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '6px', width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--calm-fg)' };
const fieldLabelStyle: React.CSSProperties = { fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px', color: 'var(--calm-fg-muted)', display: 'block', marginBottom: '3px' };
const ctrlInputStyle: React.CSSProperties = { height: '26px', padding: '0 7px', fontSize: '11px', color: 'var(--calm-fg)', background: 'var(--calm-bg-input)', border: '1px solid var(--calm-border-input)', borderRadius: '3px', outline: 'none', width: '100%' };
