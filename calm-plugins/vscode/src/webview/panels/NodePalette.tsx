import React, { useState, useMemo } from 'react';
import { initAllPacks, getAllPacks, type PackDefinition, type NodeTypeEntry } from '../../packs/index.js';
import { theme, tint } from '../canvas/theme-colors';

initAllPacks();

interface StandardNode {
    id: string;
    name: string;
    behaviour: string;
    nodeType: string;
    category?: string;
    description?: string;
    namespace?: string;
    sha?: string;
    hubId?: number;
}

interface NodePaletteProps {
    standardNodes: StandardNode[];
    hubLoading?: boolean;
}

export function NodePalette({ standardNodes, hubLoading }: NodePaletteProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ containers: true, infra: true, hub: false });

    const packs = useMemo(() => {
        const allPacks = getAllPacks().filter((p: PackDefinition) => p.id !== 'internal');
        const enabled = (window as any).__CALM_ENABLED_PACKS__ as string[] | undefined;
        const excludeNodes = (window as any).__CALM_EXCLUDE_NODES__ as string[] | undefined;
        const excludeSet = new Set(excludeNodes ?? []);
        let filtered = enabled && enabled.length > 0
            ? allPacks.filter((p) => enabled.includes(p.id))
            : allPacks;
        if (excludeSet.size > 0) {
            filtered = filtered.map((p) => ({
                ...p,
                nodes: p.nodes.filter((n) => !excludeSet.has(n.typeId)),
            })).filter((p) => p.nodes.length > 0);
        }
        return filtered;
    }, []);

    const lowerQuery = searchQuery.toLowerCase().trim();
    const isSearching = lowerQuery.length > 0;

    const infraNodes = useMemo(() => standardNodes.filter((n) => n.behaviour === 'create-node' && !n.namespace), [standardNodes]);
    const hubNodes = useMemo(() => standardNodes.filter((n) => !!n.namespace), [standardNodes]);

    const hubByNamespace = useMemo(() => {
        const map = new Map<string, StandardNode[]>();
        for (const node of hubNodes) {
            const ns = node.namespace!;
            if (!map.has(ns)) map.set(ns, []);
            map.get(ns)!.push(node);
        }
        return [...map.entries()].map(([name, items]) => ({ name, items })).sort((a, b) => a.name.localeCompare(b.name));
    }, [hubNodes]);

    function matchesSearch(name: string, description?: string): boolean {
        if (!isSearching) return true;
        return name.toLowerCase().includes(lowerQuery) || (description?.toLowerCase().includes(lowerQuery) ?? false);
    }

    function groupByCategory(items: StandardNode[]): Array<{ name: string; items: StandardNode[] }> {
        const map = new Map<string, StandardNode[]>();
        for (const item of items) {
            const cat = item.category ?? 'General';
            if (!map.has(cat)) map.set(cat, []);
            map.get(cat)!.push(item);
        }
        return [...map.entries()].map(([name, items]) => ({ name, items })).sort((a, b) => a.name.localeCompare(b.name));
    }

    const filteredInfra = useMemo(() =>
        groupByCategory(infraNodes).map((g) => ({ ...g, items: g.items.filter((n) => matchesSearch(n.name, n.description)) })).filter((g) => g.items.length > 0),
        [infraNodes, lowerQuery] // eslint-disable-line
    );


    const filteredPacks = useMemo(() =>
        packs.map((p: PackDefinition) => ({
            ...p,
            nodes: p.nodes.filter((n: NodeTypeEntry) => matchesSearch(n.label, n.description)),
        })).filter((p: PackDefinition) => p.nodes.length > 0),
        [packs, lowerQuery] // eslint-disable-line
    );

    const filteredHub = useMemo(() =>
        hubByNamespace.map((g) => ({ ...g, items: g.items.filter((n) => matchesSearch(n.name, n.description)) })).filter((g) => g.items.length > 0),
        [hubByNamespace, lowerQuery] // eslint-disable-line
    );

    const toggleSection = (key: string) => setCollapsed((c) => ({ ...c, [key]: !c[key] }));

    const onDragStart = (e: React.DragEvent, node: StandardNode) => {
        e.dataTransfer.setData('application/standard-node-id', node.id);
        e.dataTransfer.setData('application/standard-node-behaviour', node.behaviour);
        e.dataTransfer.setData('application/calm-node-type', node.nodeType);
        e.dataTransfer.setData('application/calm-node-label', node.name);
        e.dataTransfer.effectAllowed = 'move';
    };

    const showContainers = !isSearching || 'container'.includes(lowerQuery);

    return (
        <aside style={paletteStyle}>
            <div style={headerStyle}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
                </svg>
                <span>COMPONENTS</span>
            </div>

            <div style={{ position: 'relative', padding: '0 8px 8px' }}>
                <input
                    type="text"
                    placeholder="Search components..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={searchInputStyle}
                />
                {searchQuery && (
                    <button onClick={() => setSearchQuery('')} style={clearBtnStyle}>&times;</button>
                )}
            </div>

            {/* Containers */}
            {showContainers && (
                <Section title="CONTAINERS" collapsed={!isSearching && collapsed.containers} onToggle={() => toggleSection('containers')}>
                    <PaletteItem
                        icon="⬚"
                        label="Container"
                        onDragStart={(e) => {
                            e.dataTransfer.setData('application/calm-node-type', 'system');
                            e.dataTransfer.setData('application/calm-node-label', 'Container');
                            e.dataTransfer.setData('application/calm-container', 'true');
                            e.dataTransfer.effectAllowed = 'move';
                        }}
                        title="Create a container to group nodes"
                    />
                </Section>
            )}

            {/* Infrastructure Nodes */}
            {filteredInfra.length > 0 && (
                <Section title={`NODES (${infraNodes.length})`} collapsed={!isSearching && collapsed.infra} onToggle={() => toggleSection('infra')} badge="WS">
                    {filteredInfra.map((group) => (
                        <React.Fragment key={group.name}>
                            {filteredInfra.length > 1 && <div style={subgroupStyle}>{group.name} ({group.items.length})</div>}
                            {group.items.map((node) => (
                                <PaletteItem key={node.id} icon="⬡" label={node.name} onDragStart={(e) => onDragStart(e, node)} title={node.description} />
                            ))}
                        </React.Fragment>
                    ))}
                </Section>
            )}

            {/* Hub Loading */}
            {hubLoading && (
                <div style={{ padding: '6px 12px', fontSize: '11px', color: '#4caf50', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid var(--calm-border)' }}>
                    <span style={{ display: 'inline-block', width: '10px', height: '10px', border: '2px solid #4caf50', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                    Loading Standard Nodes from Hub...
                </div>
            )}

            {/* Hub Namespaces */}
            {filteredHub.length > 0 && (
                <Section title={`HUB (${hubNodes.length})`} collapsed={!isSearching && collapsed.hub} onToggle={() => toggleSection('hub')} badge="Hub">
                    {filteredHub.map((group) => (
                        <CollapsibleSub key={group.name} label={`${humanizeNs(group.name)} — Standard Nodes (${group.items.length})`} color="#2e7d32">
                            {group.items.map((node) => (
                                <PaletteItem key={`${node.namespace}:${node.id}`} icon="" iconHtml={hubBlockIcon} label={node.name} onDragStart={(e) => onDragStart(e, node)} title={`[${node.namespace}] ${node.name}`} />
                            ))}
                        </CollapsibleSub>
                    ))}
                </Section>
            )}

            {/* Extension Packs */}
            {filteredPacks.map((pack) => (
                <Section
                    key={pack.id}
                    title={`${pack.label.toUpperCase()} (${pack.nodes.length})`}
                    collapsed={!isSearching && (collapsed[`pack:${pack.id}`] ?? true)}
                    onToggle={() => toggleSection(`pack:${pack.id}`)}
                    borderColor={pack.color.border}
                >
                    {pack.nodes.map((node) => (
                        <PaletteItem
                            key={node.typeId}
                            icon=""
                            iconHtml={node.icon}
                            label={node.label}
                            onDragStart={(e) => {
                                e.dataTransfer.setData('application/calm-node-type', node.typeId);
                                e.dataTransfer.setData('application/calm-node-label', node.label);
                                e.dataTransfer.effectAllowed = 'move';
                            }}
                            title={node.description}
                        />
                    ))}
                </Section>
            ))}

            {/* Empty state */}
            {standardNodes.length === 0 && filteredPacks.length === 0 && !isSearching && (
                <div style={{ padding: '12px', fontSize: '11px', color: 'var(--calm-fg-muted)', lineHeight: 1.4 }}>
                    No components found. Ensure your workspace contains a <code style={{ background: 'var(--calm-bg-input)', padding: '1px 4px', borderRadius: '3px', fontSize: '10px' }}>standard-nodes/</code> folder with <code style={{ background: 'var(--calm-bg-input)', padding: '1px 4px', borderRadius: '3px', fontSize: '10px' }}>.calm.json</code> files.
                </div>
            )}
        </aside>
    );
}

function Section({ title, collapsed, onToggle, badge, borderColor, children }: { title: string; collapsed: boolean; onToggle: () => void; badge?: string; borderColor?: string; children: React.ReactNode }) {
    const isHub = badge === 'Hub';
    const sectionStyle: React.CSSProperties = {
        marginBottom: '4px',
        ...(badge ? { borderLeft: `2px solid ${theme.green}`, marginLeft: '4px', background: tint(theme.green, 12) } : {}),
        ...(borderColor && !badge ? { borderLeft: `2px solid ${borderColor}`, marginLeft: '4px' } : {}),
    };
    return (
        <div style={sectionStyle}>
            <button onClick={onToggle} style={groupNameStyle}>
                <span style={{ fontSize: '10px', display: 'inline-block', transition: 'transform 0.15s', transform: collapsed ? 'rotate(-90deg)' : 'none' }}>▾</span>
                {badge && <span style={isHub ? hubBadgeStyle : wsBadgeStyle}>{badge}</span>}
                {borderColor && !badge && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: borderColor, flexShrink: 0 }} />}
                {title}
            </button>
            {!collapsed && children}
        </div>
    );
}

function PaletteItem({ icon, iconHtml, label, onDragStart, title }: { icon?: string; iconHtml?: string; label: string; onDragStart: (e: React.DragEvent) => void; title?: string }) {
    return (
        <div draggable onDragStart={onDragStart} style={itemStyle} title={title}>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px', flexShrink: 0 }}>
                {iconHtml ? <span dangerouslySetInnerHTML={{ __html: iconHtml }} /> : <span style={{ fontSize: '14px' }}>{icon}</span>}
            </span>
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--calm-fg)' }}>{label}</span>
        </div>
    );
}

const hubBlockIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4caf50" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg>';

function humanizeNs(slug: string): string {
    return slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function CollapsibleSub({ label, color, children }: { label: string; color: string; children: React.ReactNode }) {
    const [open, setOpen] = React.useState(true);
    return (
        <div>
            <button onClick={() => setOpen(!open)} style={{ ...subgroupStyle, fontSize: '10px', paddingLeft: '16px', color, cursor: 'pointer', background: 'none', border: 'none', width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '8px', transition: 'transform 0.15s', transform: open ? 'none' : 'rotate(-90deg)' }}>▾</span>
                {label}
            </button>
            {open && children}
        </div>
    );
}

const paletteStyle: React.CSSProperties = { width: '180px', minWidth: '180px', height: '100%', overflowY: 'auto', borderRight: '1px solid var(--calm-border)', background: 'var(--calm-bg)', padding: '8px 0' };
const headerStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 12px 6px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px', color: 'var(--calm-fg)' };
const searchInputStyle: React.CSSProperties = { width: '100%', height: '28px', padding: '0 24px 0 8px', fontSize: '11px', color: 'var(--calm-fg)', background: 'var(--calm-bg-input)', border: '1px solid var(--calm-border-input)', borderRadius: '4px', outline: 'none' };
const clearBtnStyle: React.CSSProperties = { position: 'absolute', right: '14px', top: '4px', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--calm-fg-muted)', fontSize: '14px' };
const groupNameStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 12px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.3px', color: 'var(--calm-fg-muted)', background: 'none', border: 'none', width: '100%', cursor: 'pointer', textAlign: 'left' };
const wsBadgeStyle: React.CSSProperties = { fontSize: '8px', fontWeight: 800, padding: '1px 4px', borderRadius: '3px', background: theme.green, color: theme.bg, letterSpacing: '0.5px' };
const hubBadgeStyle: React.CSSProperties = { fontSize: '8px', fontWeight: 800, padding: '1px 4px', borderRadius: '3px', background: theme.green, color: theme.bg, letterSpacing: '0.5px' };
const subgroupStyle: React.CSSProperties = { padding: '3px 12px 3px 20px', fontSize: '9px', fontWeight: 600, color: 'var(--calm-fg-muted)', textTransform: 'capitalize' };
const itemStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', cursor: 'grab', borderRadius: '4px', margin: '1px 6px' };
