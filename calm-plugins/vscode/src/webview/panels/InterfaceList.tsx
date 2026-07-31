import React, { useRef, useState } from 'react';

interface CalmInterface { 'unique-id': string; type?: string; value?: string; url?: string; host?: string; port?: number; path?: string; protocol?: string; 'definition-url'?: string; config?: Record<string, unknown>; [key: string]: unknown }

const INTERFACE_TYPES = ['url', 'host-port', 'grpc', 'websocket', 'tcp', 'custom'] as const;

interface InterfaceListProps {
    interfaces: CalmInterface[];
    onUpdate: (interfaces: CalmInterface[]) => void;
    readonly?: boolean;
}

export function InterfaceList({ interfaces = [], onUpdate, readonly = false }: InterfaceListProps) {
    const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
    const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

    const handleFieldChange = (idx: number, field: string, value: string | number) => {
        const key = `${idx}-${field}`;
        clearTimeout(timers.current[key]);
        timers.current[key] = setTimeout(() => {
            const updated = [...interfaces];
            if (value === '' || value === undefined) {
                const copy = { ...updated[idx] };
                delete copy[field];
                updated[idx] = copy;
            } else {
                updated[idx] = { ...updated[idx], [field]: field === 'port' ? Number(value) || undefined : value };
            }
            onUpdate(updated);
        }, 300);
    };

    const handleDelete = (idx: number) => {
        setExpandedIdx(null);
        onUpdate(interfaces.filter((_, i) => i !== idx));
    };

    const handleAdd = () => {
        onUpdate([...interfaces, { 'unique-id': `iface-${Date.now()}`, type: 'url', value: '' }]);
        setExpandedIdx(interfaces.length);
    };

    const getSummary = (iface: CalmInterface): string => {
        if (iface.value) return iface.value;
        if (iface.url) return iface.url;
        if (iface.host) return `${iface.host}${iface.port ? `:${iface.port}` : ''}${iface.path ?? ''}`;
        return iface.type ?? 'interface';
    };

    return (
        <div style={sectionStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <span style={labelStyle}>Interfaces</span>
                {interfaces.length > 0 && <span style={badgeStyle}>{interfaces.length}</span>}
            </div>

            {interfaces.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '6px' }}>
                    {interfaces.map((iface, idx) => (
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
                                    <Row label="ID">
                                        <input style={inputStyle} type="text" defaultValue={iface['unique-id']}
                                            onChange={(e) => handleFieldChange(idx, 'unique-id', e.target.value)} readOnly={readonly} />
                                    </Row>
                                    <Row label="Type">
                                        {readonly ? (
                                            <span style={{ fontSize: '11px' }}>{iface.type ?? '—'}</span>
                                        ) : (
                                            <select style={selectStyle} value={iface.type ?? ''} onChange={(e) => handleFieldChange(idx, 'type', e.target.value)}>
                                                <option value="">— None —</option>
                                                {INTERFACE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                                                {iface.type && !INTERFACE_TYPES.includes(iface.type as any) && (
                                                    <option key={iface.type} value={iface.type}>{iface.type}</option>
                                                )}
                                            </select>
                                        )}
                                    </Row>
                                    <Row label="Value">
                                        <input style={inputStyle} type="text" defaultValue={iface.value ?? iface.url ?? ''}
                                            onChange={(e) => handleFieldChange(idx, 'value', e.target.value)}
                                            placeholder="e.g. https://api.example.com" readOnly={readonly} />
                                    </Row>
                                    <Row label="Protocol">
                                        <input style={inputStyle} type="text" defaultValue={iface.protocol ?? ''}
                                            onChange={(e) => handleFieldChange(idx, 'protocol', e.target.value)}
                                            placeholder="e.g. HTTPS, gRPC" readOnly={readonly} />
                                    </Row>
                                    <Row label="Host">
                                        <input style={inputStyle} type="text" defaultValue={iface.host ?? ''}
                                            onChange={(e) => handleFieldChange(idx, 'host', e.target.value)}
                                            placeholder="hostname" readOnly={readonly} />
                                    </Row>
                                    <Row label="Port">
                                        <input style={inputStyle} type="number" defaultValue={iface.port ?? ''}
                                            onChange={(e) => handleFieldChange(idx, 'port', e.target.value)}
                                            placeholder="port" readOnly={readonly} />
                                    </Row>
                                    <Row label="Path">
                                        <input style={inputStyle} type="text" defaultValue={iface.path ?? ''}
                                            onChange={(e) => handleFieldChange(idx, 'path', e.target.value)}
                                            placeholder="/api/v1" readOnly={readonly} />
                                    </Row>
                                </div>
                            )}
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={rowLabelStyle}>{label}</span>
            <div style={{ flex: 1 }}>{children}</div>
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
const rowLabelStyle: React.CSSProperties = { fontSize: '9px', fontWeight: 600, color: 'var(--calm-fg-muted)', textTransform: 'uppercase', width: '50px', flexShrink: 0 };
const inputStyle: React.CSSProperties = { width: '100%', padding: '3px 6px', fontSize: '11px', color: 'var(--calm-fg)', background: 'var(--calm-bg-input)', border: '1px solid var(--calm-border-input)', borderRadius: '3px', outline: 'none' };
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' };
const deleteBtnStyle: React.CSSProperties = { width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--calm-fg-muted)', fontSize: '13px', flexShrink: 0 };
const addBtnStyle: React.CSSProperties = { fontSize: '10px', fontWeight: 500, color: 'var(--calm-link)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0' };
