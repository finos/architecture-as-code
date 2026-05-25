import type {
    CalmArchitectureSchema,
    CalmNodeSchema,
    CalmRelationshipSchema,
} from '@finos/calm-models/types';
import type { DiffResult } from '@finos/calm-models/diff';

export type DiffStatus = 'added' | 'removed' | 'modified' | 'renamed' | 'unchanged';

export interface DiffNodeData extends CalmNodeSchema {
    diffStatus?: DiffStatus;
    originalId?: string;
}

export interface DiffEdgeData extends CalmRelationshipSchema {
    diffStatus?: DiffStatus;
    originalId?: string;
}

/** A diffable CALM document: an architecture instance or a pattern JSON Schema. */
export type DiffSource = CalmArchitectureSchema | Record<string, unknown>;

export type DiffSourceType = 'Architectures' | 'Patterns';

export interface DiffGraphProps {
    source: DiffSource;
    sourceType: DiffSourceType;
    diffResult: DiffResult | null;
    isFirst: boolean;
}
