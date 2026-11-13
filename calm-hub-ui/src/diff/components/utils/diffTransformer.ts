import type { Node, Edge } from '@xyflow/react';
import type { CalmArchitectureSchema } from '@finos/calm-models/types';
import type { DiffResult } from '@finos/calm-models/diff';
import { parseCALMData } from '../../../visualizer/components/reactflow/utils/calmTransformer.js';
import { applyDiffStatus } from './applyDiffStatus.js';

export function parseCALMDataWithDiff(
    data: CalmArchitectureSchema,
    diffResult: DiffResult | null,
    isFirst: boolean,
): { nodes: Node[]; edges: Edge[] } {
    return applyDiffStatus(parseCALMData(data), diffResult, isFirst);
}
