import React, { useState, useMemo } from 'react';
import { initAllPacks, getAllPacks, type PackDefinition, type NodeTypeEntry } from '../../extensions/index.js';

initAllPacks();

interface BuildingBlock {
    id: string;
    name: string;
    behaviour: string;
    nodeType: string;
    category?: string;
    description?: string;
    namespace?: string;
    sha?: string;
}

interface NodePaletteProps {
    buildingBlocks: BuildingBlock[];
}

export function NodePalette({ buildingBlocks }: NodePaletteProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ containers: true, infra: true, standards: true, guidelines: true, hub: false });

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

    const infraNodes = useMemo(() => buildingBlocks.filter((n) => n.behaviour === 'create-node' && !n.namespace), [buildingBlocks]);
    const standardNodes = useMemo(() => buildingBlocks.filter((n) => n.behaviour === 'apply-controls-on-drop' && n.id?.startsWith('standards:') && !n.namespace), [buildingBlocks]);
    const guidelineNodes = useMemo(() => buildingBlocks.filter((n) => n.behaviour === 'apply-controls-on-drop' && n.id?.startsWith('guidelines:') && !n.namespace), [buildingBlocks]);
    const hubNodes = useMemo(() => buildingBlocks.filter((n) => !!n.namespace), [buildingBlocks]);

    const hubByNamespace = useMemo(() => {
        const map = new Map<string, BuildingBlock[]>();
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

    function groupByCategory(items: BuildingBlock[]): Array<{ name: string; items: BuildingBlock[] }> {
        const map = new Map<string, BuildingBlock[]>();
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

    const filteredStandards = useMemo(() =>
        groupByCategory(standardNodes).map((g) => ({ ...g, items: g.items.filter((n) => matchesSearch(n.name, n.description)) })).filter((g) => g.items.length > 0),
        [standardNodes, lowerQuery] // eslint-disable-line
    );

    const filteredGuidelines = useMemo(() =>
        groupByCategory(guidelineNodes).map((g) => ({ ...g, items: g.items.filter((n) => matchesSearch(n.name, n.description)) })).filter((g) => g.items.length > 0),
        [guidelineNodes, lowerQuery] // eslint-disable-line
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

    const onDragStart = (e: React.DragEvent, node: BuildingBlock) => {
        e.dataTransfer.setData('application/building-block-id', node.id);
        e.dataTransfer.setData('application/building-block-behaviour', node.behaviour);
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

            {/* Standards */}
            {filteredStandards.length > 0 && (
                <Section title={`STANDARDS (${standardNodes.length})`} collapsed={!isSearching && collapsed.standards} onToggle={() => toggleSection('standards')} badge="WS">
                    {filteredStandards.map((group) => (
                        <React.Fragment key={group.name}>
                            <div style={subgroupStyle}>{group.name} ({group.items.length})</div>
                            {group.items.map((node) => (
                                <PaletteItem key={node.id} icon="📄" label={node.name} onDragStart={(e) => onDragStart(e, node)} title={node.description} />
                            ))}
                        </React.Fragment>
                    ))}
                </Section>
            )}

            {/* Guidelines */}
            {filteredGuidelines.length > 0 && (
                <Section title={`GUIDELINES (${guidelineNodes.length})`} collapsed={!isSearching && collapsed.guidelines} onToggle={() => toggleSection('guidelines')} badge="WS">
                    {filteredGuidelines.map((group) => (
                        <React.Fragment key={group.name}>
                            <div style={subgroupStyle}>{group.name} ({group.items.length})</div>
                            {group.items.map((node) => (
                                <PaletteItem key={node.id} icon="📖" label={node.name} onDragStart={(e) => onDragStart(e, node)} title={node.description} />
                            ))}
                        </React.Fragment>
                    ))}
                </Section>
            )}

            {/* Hub Namespaces */}
            {filteredHub.length > 0 && (
                <Section title={`HUB (${hubNodes.length})`} collapsed={!isSearching && collapsed.hub} onToggle={() => toggleSection('hub')} badge="Hub">
                    {filteredHub.map((group) => {
                        const blocks = group.items.filter((n) => n.behaviour === 'create-node');
                        const standards = group.items.filter((n) => n.behaviour === 'apply-controls-on-drop');
                        return (
                            <CollapsibleSub key={group.name} label={`${humanizeNs(group.name)} (${group.items.length})`} color="#2e7d32">
                                {blocks.length > 0 && (
                                    <CollapsibleSub key={`${group.name}-blocks`} label={`Building Blocks (${blocks.length})`} color="#4caf50">
                                        {blocks.map((node) => (
                                            <PaletteItem key={`${node.namespace}:${node.id}`} icon="" iconHtml={hubBlockIcon} label={node.name} onDragStart={(e) => onDragStart(e, node)} title={`[${node.namespace}] ${node.name}`} />
                                        ))}
                                    </CollapsibleSub>
                                )}
                                {(() => {
                                    const stdOnly = standards.filter((n) => !n.name.toLowerCase().includes('guideline'));
                                    const guideOnly = standards.filter((n) => n.name.toLowerCase().includes('guideline'));
                                    return (<>
                                        {stdOnly.length > 0 && (
                                            <CollapsibleSub key={`${group.name}-standards`} label={`Standards (${stdOnly.length})`} color="#66bb6a">
                                                {stdOnly.map((node) => (
                                                    <PaletteItem key={`${node.namespace}:${node.id}`} icon="" iconHtml={hubStandardIcon} label={node.name} onDragStart={(e) => onDragStart(e, node)} title={`[${node.namespace}] ${node.name}`} />
                                                ))}
                                            </CollapsibleSub>
                                        )}
                                        {guideOnly.length > 0 && (
                                            <CollapsibleSub key={`${group.name}-guidelines`} label={`Guidelines (${guideOnly.length})`} color="#81c784">
                                                {guideOnly.map((node) => (
                                                    <PaletteItem key={`${node.namespace}:${node.id}`} icon="" iconHtml={hubStandardIcon} label={node.name} onDragStart={(e) => onDragStart(e, node)} title={`[${node.namespace}] ${node.name}`} />
                                                ))}
                                            </CollapsibleSub>
                                        )}
                                    </>);
                                })()}
                            </CollapsibleSub>
                        );
                    })}
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
            {buildingBlocks.length === 0 && filteredPacks.length === 0 && !isSearching && (
                <div style={{ padding: '12px', fontSize: '11px', color: 'var(--calm-fg-muted)', lineHeight: 1.4 }}>
                    No components found. Ensure your workspace contains a <code style={{ background: 'var(--calm-bg-input)', padding: '1px 4px', borderRadius: '3px', fontSize: '10px' }}>building-blocks/</code> folder with <code style={{ background: 'var(--calm-bg-input)', padding: '1px 4px', borderRadius: '3px', fontSize: '10px' }}>.calm.json</code> files.
                </div>
            )}
        </aside>
    );
}

function Section({ title, collapsed, onToggle, badge, borderColor, children }: { title: string; collapsed: boolean; onToggle: () => void; badge?: string; borderColor?: string; children: React.ReactNode }) {
    const isHub = badge === 'Hub';
    const sectionStyle: React.CSSProperties = {
        marginBottom: '4px',
        ...(badge && !isHub ? { borderLeft: '2px solid #2e7d32', marginLeft: '4px', background: 'rgba(46,125,50,0.04)' } : {}),
        ...(isHub ? { borderLeft: '2px solid #2e7d32', marginLeft: '4px', background: 'rgba(46,125,50,0.04)' } : {}),
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

const hubIconSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/></svg>';
const hubBlockIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4caf50" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg>';
const hubStandardIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#66bb6a" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>';

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
const wsBadgeStyle: React.CSSProperties = { fontSize: '8px', fontWeight: 800, padding: '1px 4px', borderRadius: '3px', background: '#2e7d32', color: '#fff', letterSpacing: '0.5px' };
const hubBadgeStyle: React.CSSProperties = { fontSize: '8px', fontWeight: 800, padding: '1px 4px', borderRadius: '3px', background: '#2e7d32', color: '#fff', letterSpacing: '0.5px' };
const subgroupStyle: React.CSSProperties = { padding: '3px 12px 3px 20px', fontSize: '9px', fontWeight: 600, color: 'var(--calm-fg-muted)', textTransform: 'capitalize' };
const itemStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', cursor: 'grab', borderRadius: '4px', margin: '1px 6px' };
