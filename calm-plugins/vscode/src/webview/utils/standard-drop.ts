import type { Node } from 'reactflow';
import { mergeControls } from '@finos/calm-shared/browser';

/**
 * Apply a Standard's controls onto an existing canvas node without creating
 * a separate `standard` node or an "adheres to" relationship.
 */
export function applyStandardToNode(
    nodes: Node[],
    targetId: string,
    controls: Record<string, unknown> | undefined,
): Node[] {
    if (!controls || Object.keys(controls).length === 0) return nodes;
    const controlsCopy = JSON.parse(JSON.stringify(controls)) as Record<string, unknown>;
    return nodes.map((n) => {
        if (n.id !== targetId) return n;
        const data = { ...(n.data as Record<string, unknown>) };
        data.controls = mergeControls(
            (data.controls as Record<string, unknown>) ?? {},
            controlsCopy,
        );
        return { ...n, data };
    });
}
