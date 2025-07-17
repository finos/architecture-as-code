import { CalmAdrMeta } from "@finos/calm-shared/src/model/adr.js";

export type Namespace = string;
export type PatternID = string;
export type Pattern = string;
export type Architecture = string;
export type ArchitectureID = string;
export type FlowID = string;
export type AdrID = string;
export type Flow = string;
export type Version = string;
export type Revision = string;
export type Adr = CalmAdrMeta;
export type CalmType =  'Architectures' | 'Patterns' | 'Flows' | 'ADRs';

export type Data = {
    id: string;
    version: string;
    name: Namespace;
    data: Pattern | Architecture | Flow | Adr | undefined;
    calmType: CalmType;
};
