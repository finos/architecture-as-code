export type Namespace = string;
export type PatternID = string;
export type Pattern = string;
export type Architecture = string;
export type ArchitectureID = string;
export type FlowID = string;
export type Flow = string;
export type Version = string;
export type CalmType =  'Architectures' | 'Patterns' | 'Flows';

export type Data = {
    id: string;
    version: string;
    name: Namespace;
    calmType: CalmType;
    data: Pattern | Architecture | Flow | undefined;
};
