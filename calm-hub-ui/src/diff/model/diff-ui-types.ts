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

export interface DiffGraphProps {
    architecture: CalmArchitectureSchema;
    diffResult: DiffResult | null;
    isFirst: boolean;
}

export interface DiffSectionProps<T> {
    title: string;
    items: T[];
    renderItem: (item: T) => string;
    className: string;
}

export interface DiffGraphPanelProps {
    archA: CalmArchitectureSchema | null;
    archB: CalmArchitectureSchema | null;
    diffResult: DiffResult | null;
    onFileLoad: (file: File, isFirst: boolean) => void;
}

export interface DiffPanelProps {
    diffResult: DiffResult | null;
    /** Message shown when there is no diff yet. Defaults to the upload-route wording. */
    emptyMessage?: string;
}
