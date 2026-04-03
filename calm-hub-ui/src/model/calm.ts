import { CalmAdrMeta } from '@finos/calm-shared/src/view-model/adr.js';
import {
    CalmArchitectureSchema,
    CalmPatternSchema,
    CalmFlowSchema,
} from '@finos/calm-models/types';

export type Namespace = string;
export type PatternID = string;
export type Pattern = CalmPatternSchema;
export type Architecture = CalmArchitectureSchema;
export type ArchitectureID = string;
export type FlowID = string;
export type AdrID = string;
export type Flow = CalmFlowSchema;
export type Version = string;
export type Revision = string;
export type Adr = CalmAdrMeta;
export type CalmType = 'Architectures' | 'Patterns' | 'Flows' | 'ADRs' | 'Standards';

/**
 * Summary returned from the API for namespace-scoped resources.
 */
export interface ResourceSummary {
    id: number;
    name: string;
    description: string;
}

/**
 * Summary returned from the API for ADR resources (title + status instead of name + description).
 */
export interface AdrSummary {
    id: number;
    title: string;
    status: string;
}

export type Data =
    | {
        id: string;
        version: string;
        name: Namespace;
        data: Architecture | undefined;
        calmType: 'Architectures';
    }
    | {
        id: string;
        version: string;
        name: Namespace;
        data: Pattern | undefined;
        calmType: 'Patterns';
    }
    | {
        id: string;
        version: string;
        name: Namespace;
        data: Flow | undefined;
        calmType: 'Flows';
    }
    | {
        id: string;
        version: string;
        name: Namespace;
        data: Adr | undefined;
        calmType: 'ADRs';
    }
    | {
        id: string;
        version: string;
        name: Namespace;
        data: unknown;
        calmType: 'Standards';
    };
