import type { Node, NodeProps } from '@xyflow/react';
import { colors } from '../../../../theme/colors.js';
import type { C4BoundaryData } from './c4Layout.js';

export function C4BoundaryNode({ data, width, height }: NodeProps<Node<C4BoundaryData>>) {
    return (
        <div
            data-testid="c4-boundary"
            style={{
                width,
                height,
                border: `2px dashed ${colors.text.muted}`,
                borderRadius: 10,
                boxSizing: 'border-box',
                position: 'relative',
            }}
        >
            <div style={{ position: 'absolute', left: 12, bottom: 8, color: colors.text.primary }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{data.label}</div>
                <div style={{ fontSize: 11, color: colors.text.secondary }}>[{data.kind}]</div>
            </div>
        </div>
    );
}
