export interface ConfigTypeSummary {
    type: string;
    schema: string;
}

export interface ConfigSummary {
    id: number;
    name: string;
    description?: string;
    versionCount: number;
}

/** The default config that applies to a namespace: its own, or that of its nearest ancestor. */
export interface NamespaceDefaultConfig {
    configType: string;
    /** The namespace that sets the default. */
    namespace: string;
    configId: number;
    version: string;
    inherited: boolean;
    config: object;
}
