/** One architecture version whose `$schema` names a pattern version. */
export interface PatternImplementation {
    namespace: string;
    architectureId: number;
    version: string;
    /** The name on the name-based API. Absent for an architecture created through the numeric API. */
    customId?: string;
}
