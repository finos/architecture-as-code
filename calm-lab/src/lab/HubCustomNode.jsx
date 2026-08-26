// Ported from calm-hub-ui/src/visualizer/components/reactflow/CustomNode.tsx (commit 6547fb37),
// lab-skinned: keeps the fixed-width wrapper and the hidden source/target
// handles the floating edges rely on; drops the Hub's hover panel, AIGF badges
// and control chrome; node-type colour accents come from the ported THEME.
// Keep logic in sync until the shared renderer package extraction.

import React from 'react';
import {Handle, Position} from 'reactflow';
import styles from './lab.module.css';
import {extractNodeType} from './hubRenderer/calmHelpers';
import {getNodeTypeColor} from './hubRenderer/theme';

export default function HubCustomNode({data}) {
    const nodeType = extractNodeType(data) || 'unknown';
    const color = getNodeTypeColor(nodeType);

    return (
        <div
            className={styles.flowNode}
            style={{borderColor: color}}
            title={data.description || ''}
            data-testid="custom-node">
            {/* Hidden handles to satisfy React Flow; floating edge computes actual attachment */}
            <Handle type="source" position={Position.Right} id="source" style={{opacity: 0}} />
            <Handle type="target" position={Position.Left} id="target" style={{opacity: 0}} />
            <div className={styles.flowNodeLabel}>
                <span className={styles.flowNodeDot} style={{background: color}} aria-hidden="true" />
                <span>{data.label}</span>
            </div>
            <div className={styles.flowNodeType}>{nodeType}</div>
        </div>
    );
}
