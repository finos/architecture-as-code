export interface ConventionTypeSummary {
    type: string;
    schema: string;
}

export interface ConventionSummary {
    id: number;
    name: string;
    description?: string;
    versionCount: number;
}

/** The default convention that applies to a namespace: its own, or that of its nearest ancestor. */
export interface NamespaceDefaultConvention {
    conventionType: string;
    /** The namespace that sets the default. */
    namespace: string;
    conventionId: number;
    version: string;
    inherited: boolean;
    convention: object;
}
