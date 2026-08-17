import React, { useRef } from 'react';

const INTERNAL_KEYS = new Set(['source-building-block', 'building-block-type', 'building-block-behaviour', 'building-block-style']);

interface CustomMetadataProps {
    metadata: Record<string, string>;
    onUpdate: (metadata: Record<string, string>) => void;
    readonly?: boolean;
}

export function CustomMetadata({ metadata = {}, onUpdate, readonly = false }: CustomMetadataProps) {
    const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
    const filtered = Object.entries(metadata).filter(([k]) => !INTERNAL_KEYS.has(k));

    const handleValueChange = (key: string, value: string) => {
        clearTimeout(timers.current[key]);
        timers.current[key] = setTimeout(() => {
            onUpdate({ ...metadata, [key]: value });
        }, 300);
    };

    const handleDelete = (key: string) => {
        const updated = { ...metadata };
        delete updated[key];
        onUpdate(updated);
    };

    const handleAdd = () => {
        const key = `custom-${Date.now()}`;
        onUpdate({ ...metadata, [key]: '' });
    };

    if (filtered.length === 0 && readonly) return null;

    return (
        <div style={sectionStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <span style={labelStyle}>Metadata</span>
                {filtered.length > 0 && <span style={badgeStyle}>{filtered.length}</span>}
            </div>

            {filtered.map(([key, value]) => (
                <div key={key} style={{ display: 'flex', gap: '4px', alignItems: 'center', marginBottom: '4px' }}>
                    <input style={{ ...inputStyle, flex: '0 0 80px', fontSize: '10px' }} type="text" defaultValue={key} readOnly={readonly}
                        onBlur={(e) => {
                            if (e.target.value !== key) {
                                const updated = { ...metadata };
                                delete updated[key];
                                updated[e.target.value] = value;
                                onUpdate(updated);
                            }
                        }} />
                    <input style={{ ...inputStyle, flex: 1, fontSize: '10px' }} type="text" defaultValue={value} readOnly={readonly}
                        onChange={(e) => handleValueChange(key, e.target.value)} />
                    {!readonly && <button onClick={() => handleDelete(key)} style={deleteBtnStyle}>&times;</button>}
                </div>
            ))}

            {!readonly && <button onClick={handleAdd} style={addBtnStyle}>+ Add Field</button>}
        </div>
    );
}

const sectionStyle: React.CSSProperties = { padding: '10px 14px', borderTop: '1px solid var(--calm-border)' };
const labelStyle: React.CSSProperties = { fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px', color: 'var(--calm-fg-muted)' };
const badgeStyle: React.CSSProperties = { minWidth: '18px', height: '18px', padding: '0 5px', borderRadius: '9px', fontSize: '10px', fontWeight: 600, background: 'var(--calm-badge-bg)', color: 'var(--calm-badge-fg)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' };
const inputStyle: React.CSSProperties = { padding: '4px 6px', fontSize: '11px', color: 'var(--calm-fg)', background: 'var(--calm-bg-input)', border: '1px solid var(--calm-border-input)', borderRadius: '3px', outline: 'none' };
const deleteBtnStyle: React.CSSProperties = { width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--calm-fg-muted)', fontSize: '14px' };
const addBtnStyle: React.CSSProperties = { fontSize: '10px', fontWeight: 500, color: 'var(--calm-link)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0' };
