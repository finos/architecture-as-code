import React, { useState, useMemo, type ReactNode } from 'react';
import { initAllPacks, getAllPacks, type PackDefinition, type NodeTypeEntry } from '../../packs/index.js';
import { buildPaletteDragPayload } from '../canvas/node-drop';
import { getCanvasNodeIconMarkup } from '../canvas/nodes/CanvasNodeIcon';
import { PaletteItem, Section } from './PalettePrimitives';

initAllPacks();

interface NodePaletteProps {
    /** Optional feature sections receive the core search term through the generic palette slot. */
    renderFeatureContent?: (searchQuery: string) => ReactNode;
}

export function NodePalette({ renderFeatureContent }: NodePaletteProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ containers: true });

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

    function matchesSearch(name: string, description?: string): boolean {
        if (!isSearching) return true;
        return name.toLowerCase().includes(lowerQuery) || (description?.toLowerCase().includes(lowerQuery) ?? false);
    }

    const filteredPacks = useMemo(() =>
        packs.map((p: PackDefinition) => ({
            ...p,
            nodes: p.nodes.filter((n: NodeTypeEntry) => matchesSearch(n.label, n.description)),
        })).filter((p: PackDefinition) => p.nodes.length > 0),
        [packs, lowerQuery] // eslint-disable-line
    );

    const toggleSection = (key: string) => setCollapsed((c) => ({ ...c, [key]: !c[key] }));

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
                            const payload = buildPaletteDragPayload({ nodeType: 'system', nodeLabel: 'Container', isContainer: true });
                            e.dataTransfer.setData('application/calm-node-type', payload['application/calm-node-type']);
                            e.dataTransfer.setData('application/calm-node-label', payload['application/calm-node-label']);
                            e.dataTransfer.setData('application/calm-container', payload['application/calm-container']);
                            e.dataTransfer.effectAllowed = 'move';
                        }}
                        title="Create a container to group nodes"
                    />
                </Section>
            )}

            {renderFeatureContent?.(lowerQuery)}

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
                            iconHtml={getCanvasNodeIconMarkup(node.typeId, 14) ?? node.icon}
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

        </aside>
    );
}

const paletteStyle: React.CSSProperties = { width: '180px', minWidth: '180px', height: '100%', overflowY: 'auto', borderRight: '1px solid var(--calm-border)', background: 'var(--calm-bg)', padding: '8px 0' };
const headerStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 12px 6px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px', color: 'var(--calm-fg)' };
const searchInputStyle: React.CSSProperties = { width: '100%', height: '28px', padding: '0 24px 0 8px', fontSize: '11px', color: 'var(--calm-fg)', background: 'var(--calm-bg-input)', border: '1px solid var(--calm-border-input)', borderRadius: '4px', outline: 'none' };
const clearBtnStyle: React.CSSProperties = { position: 'absolute', right: '14px', top: '4px', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--calm-fg-muted)', fontSize: '14px' };
