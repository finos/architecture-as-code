import React, { useMemo, useState } from 'react';
import { useCanvasStore } from '../../stores/canvas-store';
import { theme } from '../../canvas/theme-colors';
import { CollapsibleSub, hubBlockIcon, humanizeNs, PaletteItem, Section, subgroupStyle } from '../../panels/PalettePrimitives';
import type { CanvasFeatureRuntime } from '../types';

interface StandardNode {
    id: string;
    name: string;
    behaviour: string;
    nodeType: string;
    category?: string;
    description?: string;
    namespace?: string;
}

function matchesSearch(query: string, name: string, description?: string): boolean {
    return !query || name.toLowerCase().includes(query) || (description?.toLowerCase().includes(query) ?? false);
}

export function StandardsControlsPaletteSurface({ runtime }: { runtime: CanvasFeatureRuntime }) {
    const standardNodes = useCanvasStore((state) => state.standardNodes as StandardNode[]);
    const hubLoading = useCanvasStore((state) => state.hubLoading);
    return (
        <StandardsControlsPaletteView
            standardNodes={standardNodes}
            hubLoading={hubLoading}
            searchQuery={runtime.paletteSearchQuery ?? ''}
        />
    );
}

export function StandardsControlsPaletteView({ standardNodes, hubLoading, searchQuery }: {
    standardNodes: StandardNode[];
    hubLoading: boolean;
    searchQuery: string;
}) {
    const [collapsed, setCollapsed] = useState({ infrastructure: true, hub: false });
    const query = searchQuery.toLowerCase().trim();
    const isSearching = query.length > 0;

    const infrastructure = useMemo(() => {
        const groups = new Map<string, StandardNode[]>();
        for (const node of standardNodes) {
            if (node.behaviour !== 'create-node' || node.namespace || !matchesSearch(query, node.name, node.description)) continue;
            const category = node.category ?? 'General';
            groups.set(category, [...(groups.get(category) ?? []), node]);
        }
        return [...groups.entries()]
            .map(([name, items]) => ({ name, items }))
            .sort((left, right) => left.name.localeCompare(right.name));
    }, [query, standardNodes]);

    const namespaces = useMemo(() => {
        const groups = new Map<string, StandardNode[]>();
        for (const node of standardNodes) {
            if (!node.namespace || !matchesSearch(query, node.name, node.description)) continue;
            groups.set(node.namespace, [...(groups.get(node.namespace) ?? []), node]);
        }
        return [...groups.entries()]
            .map(([name, items]) => ({ name, items }))
            .sort((left, right) => left.name.localeCompare(right.name));
    }, [query, standardNodes]);

    const onDragStart = (event: React.DragEvent, node: StandardNode) => {
        event.dataTransfer.setData('application/standard-node-id', node.id);
        event.dataTransfer.setData('application/standard-node-behaviour', node.behaviour);
        event.dataTransfer.setData('application/calm-node-type', node.nodeType);
        event.dataTransfer.setData('application/calm-node-label', node.name);
        event.dataTransfer.effectAllowed = 'move';
    };

    return (
        <>
            {infrastructure.length > 0 && (
                <Section
                    title={`NODES (${infrastructure.reduce((count, group) => count + group.items.length, 0)})`}
                    collapsed={!isSearching && collapsed.infrastructure}
                    onToggle={() => setCollapsed((state) => ({ ...state, infrastructure: !state.infrastructure }))}
                    badge="WS"
                >
                    {infrastructure.map((group) => (
                        <React.Fragment key={group.name}>
                            <div style={subgroupStyle}>{group.name}</div>
                            {group.items.map((node) => <PaletteItem key={node.id} icon="⬡" label={node.name} onDragStart={(event) => onDragStart(event, node)} title={node.description} />)}
                        </React.Fragment>
                    ))}
                </Section>
            )}
            {hubLoading && (
                <div style={{ padding: '6px 12px', fontSize: '11px', color: theme.green, display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid var(--calm-border)' }}>
                    <span style={{ display: 'inline-block', width: '10px', height: '10px', border: `2px solid ${theme.green}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                    Loading Standard Nodes from Hub...
                </div>
            )}
            {namespaces.length > 0 && (
                <Section
                    title={`HUB (${namespaces.reduce((count, group) => count + group.items.length, 0)})`}
                    collapsed={!isSearching && collapsed.hub}
                    onToggle={() => setCollapsed((state) => ({ ...state, hub: !state.hub }))}
                    badge="Hub"
                >
                    {namespaces.map((group) => (
                        <CollapsibleSub key={group.name} label={`${humanizeNs(group.name)} — Standard Nodes (${group.items.length})`} color={theme.green}>
                            {group.items.map((node) => <PaletteItem key={`${node.namespace}:${node.id}`} iconHtml={hubBlockIcon} label={node.name} onDragStart={(event) => onDragStart(event, node)} title={`[${node.namespace}] ${node.name}`} />)}
                        </CollapsibleSub>
                    ))}
                </Section>
            )}
            {infrastructure.length === 0 && namespaces.length === 0 && !hubLoading && !isSearching && (
                <div style={{ padding: '12px', fontSize: '11px', color: 'var(--calm-fg-muted)', lineHeight: 1.4 }}>
                    No workspace or Hub standard nodes found. Add standard-node definitions under <code>standard-nodes/</code> as <code>.calm.json</code> files.
                </div>
            )}
        </>
    );
}