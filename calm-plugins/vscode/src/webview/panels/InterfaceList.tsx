import React, { useRef } from 'react';

interface CalmInterface { 'unique-id': string; url?: string; host?: string; port?: number; path?: string; [key: string]: unknown }

interface InterfaceListProps {
    interfaces: CalmInterface[];
    onUpdate: (interfaces: CalmInterface[]) => void;
    readonly?: boolean;
}

export function InterfaceList({ interfaces = [], onUpdate, readonly = false }: InterfaceListProps) {
    const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

    const handleValueChange = (idx: number, field: string, value: string) => {
        const key = `${idx}-${field}`;
        clearTimeout(timers.current[key]);
        timers.current[key] = setTimeout(() => {
            const updated = [...interfaces];
            updated[idx] = { ...updated[idx], [field]: value };
            onUpdate(updated);
        }, 300);
    };

    const handleDelete = (idx: number) => onUpdate(interfaces.filter((_, i) => i !== idx));
    const handleAdd = () => onUpdate([...interfaces, { 'unique-id': `iface-${Date.now()}` }]);

    const getDisplayValue = (iface: CalmInterface): string => {
        if (iface.url) return iface.url;
        if (iface.host) return `${iface.host}${iface.port ? `:${iface.port}` : ''}${iface.path ?? ''}`;
        return iface['unique-id'];
    };

    return (
        <div style={sectionStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <span style={labelStyle}>Interfaces</span>
                {interfaces.length > 0 && <span style={badgeStyle}>{interfaces.length}</span>}
            </div>

            {interfaces.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '6px' }}>
                    {interfaces.map((iface, idx) => (
                        <div key={iface['unique-id']} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            <input style={{ ...inputStyle, flex: '0 0 80px', fontSize: '10px' }} type="text" defaultValue={iface['unique-id']}
                                onChange={(e) => handleValueChange(idx, 'unique-id', e.target.value)} placeholder="id" readOnly={readonly} />
                            <input style={{ ...inputStyle, flex: 1, fontSize: '10px' }} type="text" defaultValue={getDisplayValue(iface)}
                                onChange={(e) => handleValueChange(idx, 'url', e.target.value)} placeholder="url or host:port/path" readOnly={readonly} />
                            {!readonly && <button onClick={() => handleDelete(idx)} style={deleteBtnStyle}>&times;</button>}
                        </div>
                    ))}
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
const inputStyle: React.CSSProperties = { padding: '4px 6px', fontSize: '11px', color: 'var(--calm-fg)', background: 'var(--calm-bg-input)', border: '1px solid var(--calm-border-input)', borderRadius: '3px', outline: 'none' };
const deleteBtnStyle: React.CSSProperties = { width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--calm-fg-muted)', fontSize: '14px' };
const addBtnStyle: React.CSSProperties = { fontSize: '10px', fontWeight: 500, color: 'var(--calm-link)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0' };
