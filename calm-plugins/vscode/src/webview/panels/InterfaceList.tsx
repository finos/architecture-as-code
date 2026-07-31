import React, { useRef, useState } from 'react';

interface CalmInterface { 'unique-id': string; [key: string]: unknown }

interface InterfaceListProps {
    interfaces: CalmInterface[];
    onUpdate: (interfaces: CalmInterface[]) => void;
    readonly?: boolean;
}

export function InterfaceList({ interfaces = [], onUpdate, readonly = false }: InterfaceListProps) {
    const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
    const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

    const handleFieldChange = (idx: number, field: string, value: unknown) => {
        const key = `${idx}-${field}`;
        clearTimeout(timers.current[key]);
        timers.current[key] = setTimeout(() => {
            const updated = [...interfaces];
            updated[idx] = { ...updated[idx], [field]: value };
            onUpdate(updated);
        }, 300);
    };

    const handlePropertyAdd = (idx: number) => {
        const updated = [...interfaces];
        const newKey = `property-${Date.now()}`;
        updated[idx] = { ...updated[idx], [newKey]: '' };
        onUpdate(updated);
    };

    const handlePropertyDelete = (idx: number, key: string) => {
        const updated = [...interfaces];
        const copy = { ...updated[idx] };
        delete copy[key];
        updated[idx] = copy;
        onUpdate(updated);
    };

    const handlePropertyKeyRename = (idx: number, oldKey: string, newKey: string) => {
        if (oldKey === newKey || !newKey) return;
        const updated = [...interfaces];
        const copy = { ...updated[idx] };
        const value = copy[oldKey];
        delete copy[oldKey];
        copy[newKey] = value;
        updated[idx] = copy;
        onUpdate(updated);
    };

    const handleDelete = (idx: number) => {
        setExpandedIdx(null);
        onUpdate(interfaces.filter((_, i) => i !== idx));
    };

    const handleAdd = () => {
        onUpdate([...interfaces, { 'unique-id': `iface-${Date.now()}` }]);
        setExpandedIdx(interfaces.length);
    };

    const getSummary = (iface: CalmInterface): string => {
        if (iface.value) return String(iface.value);
        if (iface.url) return String(iface.url);
        if (iface['definition-url']) return String(iface['definition-url']);
        const extra = Object.keys(iface).filter((k) => k !== 'unique-id');
        if (extra.length > 0) return `${extra.length} propert${extra.length === 1 ? 'y' : 'ies'}`;
        return '';
    };

    return (
        <div style={sectionStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <span style={labelStyle}>Interfaces</span>
                {interfaces.length > 0 && <span style={badgeStyle}>{interfaces.length}</span>}
            </div>

            {interfaces.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '6px' }}>
                    {interfaces.map((iface, idx) => {
                        const extraProps = Object.entries(iface).filter(([k]) => k !== 'unique-id');
                        return (
                            <div key={iface['unique-id'] + idx} style={cardStyle}>
                                <div
                                    style={cardHeaderStyle}
                                    onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                                >
                                    <span style={chevronStyle}>{expandedIdx === idx ? '▾' : '▸'}</span>
                                    <span style={idStyle}>{iface['unique-id']}</span>
                                    <span style={summaryStyle}>{getSummary(iface)}</span>
                                    {!readonly && (
                                        <button onClick={(e) => { e.stopPropagation(); handleDelete(idx); }} style={deleteBtnStyle}>&times;</button>
                                    )}
                                </div>

                                {expandedIdx === idx && (
                                    <div style={cardBodyStyle}>
                                        <div style={rowStyle}>
                                            <span style={{ ...rowLabelStyle, color: 'var(--calm-fg)' }}>unique-id *</span>
                                            <input style={{ ...inputStyle, flex: 1 }} type="text" defaultValue={iface['unique-id']}
                                                key={`${idx}-uid`}
                                                onChange={(e) => handleFieldChange(idx, 'unique-id', e.target.value)} readOnly={readonly} />
                                        </div>

                                        {extraProps.map(([key, value]) => (
                                            <div key={key} style={rowStyle}>
                                                <input style={{ ...inputStyle, flex: '0 0 80px', fontSize: '10px', fontWeight: 600 }}
                                                    type="text" defaultValue={key} readOnly={readonly}
                                                    onBlur={(e) => handlePropertyKeyRename(idx, key, e.target.value)} />
                                                {typeof value === 'object' && value !== null ? (
                                                    <input style={{ ...inputStyle, flex: 1, fontSize: '10px', fontStyle: 'italic' }}
                                                        type="text" defaultValue={JSON.stringify(value)} readOnly={readonly}
                                                        onChange={(e) => {
                                                            try { handleFieldChange(idx, key, JSON.parse(e.target.value)); }
                                                            catch { handleFieldChange(idx, key, e.target.value); }
                                                        }} />
                                                ) : (
                                                    <input style={{ ...inputStyle, flex: 1, fontSize: '10px' }}
                                                        type="text" defaultValue={String(value ?? '')} readOnly={readonly}
                                                        onChange={(e) => handleFieldChange(idx, key, e.target.value)} />
                                                )}
                                                {!readonly && (
                                                    <button onClick={() => handlePropertyDelete(idx, key)} style={propDeleteBtnStyle}>&times;</button>
                                                )}
                                            </div>
                                        ))}

                                        {!readonly && (
                                            <button onClick={() => handlePropertyAdd(idx)} style={addPropBtnStyle}>+ Add Property</button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <p style={{ fontSize: '11px', color: 'var(--calm-fg-muted)', fontStyle: 'italic', margin: '0 0 6px' }}>No interfaces defined</p>
            )}

            {!readonly && <button onClick={handleAdd} style={addBtnStyle}>+ Add Interface</button>}
        </div>
    );
}

const sectionStyle: React.CSSProperties = { padding: '10px 14px', borderTop: '1px solid var(--calm-border)' };
const labelStyle: React.CSSProperties = { fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px', color: 'var(--calm-fg-muted)' };
const badgeStyle: React.CSSProperties = { minWidth: '18px', height: '18px', padding: '0 5px', borderRadius: '9px', fontSize: '10px', fontWeight: 600, background: 'var(--calm-badge-bg)', color: 'var(--calm-badge-fg)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' };
const cardStyle: React.CSSProperties = { borderRadius: '4px', border: '1px solid var(--calm-border)', overflow: 'hidden' };
const cardHeaderStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 8px', cursor: 'pointer', background: 'var(--calm-bg-secondary)' };
const chevronStyle: React.CSSProperties = { fontSize: '9px', color: 'var(--calm-fg-muted)', flexShrink: 0, width: '10px' };
const idStyle: React.CSSProperties = { fontSize: '10px', fontWeight: 600, color: 'var(--calm-fg)', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 };
const summaryStyle: React.CSSProperties = { fontSize: '10px', color: 'var(--calm-fg-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const cardBodyStyle: React.CSSProperties = { padding: '8px 10px', borderTop: '1px solid var(--calm-border)' };
const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' };
const rowLabelStyle: React.CSSProperties = { fontSize: '9px', fontWeight: 600, color: 'var(--calm-fg-muted)', flexShrink: 0, width: '70px' };
const inputStyle: React.CSSProperties = { padding: '3px 6px', fontSize: '11px', color: 'var(--calm-fg)', background: 'var(--calm-bg-input)', border: '1px solid var(--calm-border-input)', borderRadius: '3px', outline: 'none' };
const deleteBtnStyle: React.CSSProperties = { width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--calm-fg-muted)', fontSize: '13px', flexShrink: 0 };
const propDeleteBtnStyle: React.CSSProperties = { ...deleteBtnStyle, width: '16px', height: '16px', fontSize: '12px' };
const addPropBtnStyle: React.CSSProperties = { fontSize: '9px', fontWeight: 500, color: 'var(--calm-link)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0 0' };
const addBtnStyle: React.CSSProperties = { fontSize: '10px', fontWeight: 500, color: 'var(--calm-link)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0' };
