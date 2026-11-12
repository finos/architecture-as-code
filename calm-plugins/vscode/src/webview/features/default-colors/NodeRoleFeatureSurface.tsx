import React from 'react';
import type { CanvasFeatureRuntime } from '../types';
import { NodeRoleMenu, type NodeRole } from './NodeRoleMenu';

export function NodeRoleFeatureSurface({ runtime }: { runtime: CanvasFeatureRuntime }) {
    const menu = runtime.nodeContextMenu;
    if (!menu) return null;

    const updateStyle = (role?: NodeRole) => {
        runtime.setNodes((nodes) => nodes.map((node) => {
            if (node.id !== menu.nodeId) return node;
            const data = (node.data ?? {}) as Record<string, unknown>;
            const metadata = { ...((data.metadata as Record<string, unknown>) ?? {}) };
            if (role) metadata['standard-node-style'] = { background: role.background, text: role.text };
            else delete metadata['standard-node-style'];
            return { ...node, data: { ...data, metadata } };
        }));
        setTimeout(() => runtime.emitChange(true), 0);
    };

    return (
        <NodeRoleMenu
            x={menu.x}
            y={menu.y}
            onSelect={updateStyle}
            onClear={() => updateStyle()}
            onClose={() => runtime.setNodeContextMenu(null)}
        />
    );
}