// Ported from calm-hub-ui/src/visualizer/components/reactflow/SystemGroupNode.tsx (commit 2e08db88),
// lab-skinned: same translucent dashed container with a clickable name chip and
// pass-through pointer events; colours from the lab chassis palette.
// Keep logic in sync until the shared renderer package extraction.

import {Handle, Position, type NodeProps} from 'reactflow';
import styles from './lab.module.css';

export default function HubGroupNode({data}: NodeProps) {
    return (
        <div className={styles.flowGroup}>
            {/* Hidden handles to satisfy React Flow; floating edge computes actual attachment */}
            <Handle
                type="source"
                position={Position.Right}
                id="source"
                style={{opacity: 0, pointerEvents: 'all'}}
            />
            <Handle
                type="target"
                position={Position.Left}
                id="target"
                style={{opacity: 0, pointerEvents: 'all'}}
            />
            <div className={styles.flowGroupLabel}>{data.label}</div>
        </div>
    );
}
