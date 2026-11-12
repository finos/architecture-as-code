import React, { useState } from 'react';

interface CalmTemplate { id: string; name: string; description: string; category: string; content: unknown }

interface TemplatePickerProps {
    visible: boolean;
    templates: CalmTemplate[];
    onApply: (arch: any) => void;
    onClose: () => void;
}

export function TemplatePicker({ visible, templates, onApply, onClose }: TemplatePickerProps) {
    const [search, setSearch] = useState('');
    if (!visible) return null;

    const filtered = templates.filter((t) =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.description.toLowerCase().includes(search.toLowerCase())
    );

    const handleApply = (template: CalmTemplate) => {
        const content = template.content as Record<string, unknown>;
        const { _template: _, ...arch } = content;
        onApply(arch);
        onClose();
    };

    return (
        <div style={overlayStyle}>
            <div style={modalStyle}>
                <div style={headerStyle}>
                    <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Apply Template</h3>
                    <button onClick={onClose} style={closeBtnStyle}>&times;</button>
                </div>
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search templates..." style={searchStyle} />
                <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                        {filtered.map((t) => (
                            <button key={t.id} onClick={() => handleApply(t)} style={cardStyle}>
                                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--calm-fg)' }}>{t.name}</div>
                                <div style={{ fontSize: '10px', color: 'var(--calm-fg-muted)', marginTop: '4px' }}>{t.description}</div>
                                <div style={{ fontSize: '9px', color: 'var(--calm-fg-muted)', marginTop: '4px' }}>{t.category}</div>
                            </button>
                        ))}
                    </div>
                    {filtered.length === 0 && <div style={{ textAlign: 'center', color: 'var(--calm-fg-muted)', fontSize: '12px', padding: '40px' }}>No templates found</div>}
                </div>
            </div>
        </div>
    );
}

const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'var(--calm-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalStyle: React.CSSProperties = { width: '600px', maxWidth: '90vw', maxHeight: '80vh', background: 'var(--calm-bg)', borderRadius: '12px', border: '1px solid var(--calm-border-heavy)', display: 'flex', flexDirection: 'column', overflow: 'hidden' };
const headerStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--calm-border)' };
const closeBtnStyle: React.CSSProperties = { border: 'none', background: 'transparent', color: 'var(--calm-fg)', cursor: 'pointer', fontSize: '18px' };
const searchStyle: React.CSSProperties = { margin: '12px 16px 0', padding: '8px 12px', fontSize: '12px', color: 'var(--calm-fg)', background: 'var(--calm-bg-input)', border: '1px solid var(--calm-border-input)', borderRadius: '6px', outline: 'none' };
const cardStyle: React.CSSProperties = { padding: '12px', background: 'var(--calm-bg-secondary)', border: '1px solid var(--calm-border)', borderRadius: '8px', cursor: 'pointer', textAlign: 'left' };
