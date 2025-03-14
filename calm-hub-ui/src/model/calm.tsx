export type Namespace = string;
export type PatternID = string;
export type Pattern = string;
export type Architecture = string;
export type ArchitectureID = string;
export type FlowID = string;
export type Flow = string;
export type Version = string;
export type Data = {
    name: Namespace,
    data: Pattern | Architecture | Flow | undefined
};
