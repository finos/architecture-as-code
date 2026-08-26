import React, { useState } from 'react';

interface PatternEntry { id: string; name: string; description: string; category: string; schema: unknown }

interface PatternPickerProps {
    visible: boolean;
    mode: 'new' | 'apply';
    patterns: PatternEntry[];
    onApply: (arch: any, patternId: string) => void;
    onClose: () => void;
}

export function PatternPicker({ visible, mode, patterns, onApply, onClose }: PatternPickerProps) {
    const [search, setSearch] = useState('');
    if (!visible) return null;

    const filtered = patterns.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase())
    );

    const categoryGroups = new Map<string, PatternEntry[]>();
    for (const p of filtered) {
        const cat = p.category || 'General';
        if (!categoryGroups.has(cat)) categoryGroups.set(cat, []);
        categoryGroups.get(cat)!.push(p);
    }

    const handleApply = (entry: PatternEntry) => {
        const arch = instantiateFromPattern(entry.schema);
        onApply(arch, entry.id);
        onClose();
    };

    return (
        <div style={overlayStyle}>
            <div style={modalStyle}>
                <div style={headerStyle}>
                    <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>{mode === 'new' ? 'New from Pattern' : 'Apply Pattern'}</h3>
                    <button onClick={onClose} style={closeBtnStyle}>&times;</button>
                </div>
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search patterns..." style={searchStyle} />
                <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                    {[...categoryGroups.entries()].map(([cat, items]) => (
                        <div key={cat} style={{ marginBottom: '16px' }}>
                            <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--calm-fg-muted)', marginBottom: '8px' }}>{cat}</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                                {items.map((p) => (
                                    <button key={p.id} onClick={() => handleApply(p)} style={cardStyle}>
                                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--calm-fg)' }}>{p.name}</div>
                                        <div style={{ fontSize: '10px', color: 'var(--calm-fg-muted)', marginTop: '4px', lineHeight: 1.3 }}>{p.description}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                    {filtered.length === 0 && <div style={{ textAlign: 'center', color: 'var(--calm-fg-muted)', fontSize: '12px', padding: '40px' }}>No patterns found</div>}
                </div>
            </div>
        </div>
    );
}

/**
 * An `items` open catalog is structurally the same as a `prefixItems` slot's own
 * `oneOf`/`anyOf` block - `instantiateNode`/`instantiateRel` already know how to unwrap
 * one of those by taking its first alternative, so appending the catalog schema here
 * reuses that path instead of needing a second one.
 */
function catalogEntry(items: unknown): any[] {
    return items && typeof items === 'object' ? [items] : [];
}

export function instantiateFromPattern(schema: unknown): any {
    const p = schema as any;
    const nodeSchemas = [...(p?.properties?.nodes?.prefixItems ?? []), ...catalogEntry(p?.properties?.nodes?.items)];
    const relSchemas = [...(p?.properties?.relationships?.prefixItems ?? []), ...catalogEntry(p?.properties?.relationships?.items)];

    const nodes = nodeSchemas.map((s: any) => instantiateNode(s)).filter(Boolean).map((n: any) => {
        if (!n['unique-id']) n['unique-id'] = '[[PLACEHOLDER]]';
        if (!n['node-type']) n['node-type'] = 'system';
        if (!n['name']) n['name'] = '[[PLACEHOLDER]]';
        return n;
    });

    const relationships = relSchemas.map((s: any) => instantiateRel(s)).filter(Boolean).map((r: any) => {
        if (!r['unique-id']) r['unique-id'] = '[[PLACEHOLDER]]';
        if (!r['relationship-type']) r['relationship-type'] = {};
        return r;
    });

    return { nodes, relationships };
}

function instantiateNode(schema: any): any {
    if (schema.oneOf?.length) return instantiateNode(schema.oneOf[0]);
    if (schema.anyOf?.length) return instantiateNode(schema.anyOf[0]);
    if (!schema.properties) return null;
    return instantiateObject(schema.properties);
}

function instantiateRel(schema: any): any {
    if (schema.oneOf?.length) return instantiateRel(schema.oneOf[0]);
    if (schema.anyOf?.length) return instantiateRel(schema.anyOf[0]);
    if (!schema.properties) return null;
    return instantiateObject(schema.properties);
}

function instantiateObject(properties: Record<string, any>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, schema] of Object.entries(properties)) {
        if (key.startsWith('$') || key === 'type') continue;
        result[key] = extractValue(schema);
    }
    return result;
}

function extractValue(schema: any): unknown {
    if (schema.const !== undefined) return schema.const;
    if (schema.default !== undefined) return schema.default;
    if (schema.properties) return instantiateObject(schema.properties);
    if (schema.prefixItems) return schema.prefixItems.map(extractValue);
    if (schema.type === 'string') return '[[PLACEHOLDER]]';
    if (schema.type === 'integer' || schema.type === 'number') return -1;
    if (schema.type === 'boolean') return false;
    if (schema.type === 'array') return [];
    if (schema.type === 'object') return {};
    return '[[PLACEHOLDER]]';
}

const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'var(--calm-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalStyle: React.CSSProperties = { width: '600px', maxWidth: '90vw', maxHeight: '80vh', background: 'var(--calm-bg)', borderRadius: '12px', border: '1px solid var(--calm-border-heavy)', display: 'flex', flexDirection: 'column', overflow: 'hidden' };
const headerStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--calm-border)' };
const closeBtnStyle: React.CSSProperties = { border: 'none', background: 'transparent', color: 'var(--calm-fg)', cursor: 'pointer', fontSize: '18px' };
const searchStyle: React.CSSProperties = { margin: '12px 16px 0', padding: '8px 12px', fontSize: '12px', color: 'var(--calm-fg)', background: 'var(--calm-bg-input)', border: '1px solid var(--calm-border-input)', borderRadius: '6px', outline: 'none' };
const cardStyle: React.CSSProperties = { padding: '12px', background: 'var(--calm-bg-secondary)', border: '1px solid var(--calm-border)', borderRadius: '8px', cursor: 'pointer', textAlign: 'left' };
