import { Namespace, Pattern, PatternID, Version, Flow, FlowID, Architecture, ArchitectureID} from "../model/calm";

/**
 * Fetch namespaces and set them using the provided setter function.
 */
export async function fetchNamespaces(
    setNamespaces: (namespaces: Namespace[]) => void
) {
    try {
        const res = await fetch('/calm/namespaces');
        const data = await res.json();
        setNamespaces(data.values);
    } catch (error) {
        console.error('Error fetching namespaces:', error);
    }
}

/**
 * Fetch pattern IDs for a given namespace and set them using the provided setter function.
 */
export async function fetchPatternIDs(
    namespace: string,
    setPatternIDs: (patternIDs: PatternID[]) => void
) {
    try {
        const res = await fetch(`/calm/namespaces/${namespace}/patterns`);
        const data = await res.json();
        setPatternIDs(data.values.map((num: number) => num.toString()));
    } catch (error) {
        console.error(`Error fetching pattern IDs for namespace ${namespace}:`, error);
    }
}

/**
 * Fetch flow IDs for a given namespace and set them using the provided setter function.
 */
export async function fetchFlowIDs(
    namespace: string,
    setFlowIDs: (flowIDs: FlowID[]) => void
) {
    try {
        const res = await fetch(`/calm/namespaces/${namespace}/flows`);
        const data = await res.json();
        setFlowIDs(data.values.map((id: number) => id.toString()));
    } catch (error) {
        console.error(`Error fetching flow IDs for namespace ${namespace}:`, error);
    }
}

/**
 * Fetch versions for a given namespace and pattern ID and set them using the provided setter function.
 */
export async function fetchPatternVersions(
    namespace: string,
    patternID: string,
    setVersions: (versions: Version[]) => void
) {
    try {
        const res = await fetch(`/calm/namespaces/${namespace}/patterns/${patternID}/versions`);
        const data = await res.json();
        setVersions(data.values);
    } catch (error) {
        console.error(`Error fetching versions for pattern ID ${patternID}:`, error);
    }
}

/**
 * Fetch versions for a given namespace and flow ID and set them using the provided setter function.
 */
export async function fetchFlowVersions(
    namespace: string,
    flowID: string,
    setFlowVersions: (flowVersions: Version[]) => void
) {
    try {
        const res = await fetch(`/calm/namespaces/${namespace}/flows/${flowID}/versions`);
        const data = await res.json();
        setFlowVersions(data.values);
    } catch (error) {
        console.error(`Error fetching versions for flow ID ${flowID}:`, error);
    }
}

/**
 * Fetch a specific pattern by namespace, pattern ID, and version, and set it using the provided setter function.
 */
export async function fetchPattern(
    namespace: string,
    patternID: string,
    version: string,
    setPattern: (pattern: Pattern) => void
) {
    try {
        const res = await fetch(
            `/calm/namespaces/${namespace}/patterns/${patternID}/versions/${version}`
        );
        const data = await res.json();
        setPattern(data);
    } catch (error) {
        console.error(
            `Error fetching pattern for namespace ${namespace}, pattern ID ${patternID}, version ${version}:`,
            error
        );
    }
}

/**
 * Fetch a specific flow by namespace, flow ID, and version, and set it using the provided setter function.
 */
export async function fetchFlow(
    namespace: string,
    flowID: string,
    version: string,
    setFlow: (flow: Flow) => void
) {
    try {
        const res = await fetch(
            `/calm/namespaces/${namespace}/flows/${flowID}/versions/${version}`
        );
        const data = await res.json();
        setFlow(data);
    } catch (error) {
        console.error(
            `Error fetching flow for namespace ${namespace}, flow ID ${flowID}, version ${version}:`,
            error
        );
    }
}

/**
 * Fetch architecture IDs for a given namespace and set them using the provided setter function.
 */
export async function fetchArchitectureIDs(
    namespace: string,
    setArchitectureIDs: (architectureIDs: ArchitectureID[]) => void
) {
    try {
        const res = await fetch(`/calm/namespaces/${namespace}/architectures`);
        const data = await res.json();
        setArchitectureIDs(data.values.map((id: number) => id.toString()));
    } catch (error) {
        console.error(`Error fetching architecture IDs for namespace ${namespace}:`, error);
    }
}

/**
 * Fetch versions for a given namespace and architecture ID and set them using the provided setter function.
 */
export async function fetchArchitectureVersions(
    namespace: string,
    architectureID: string,
    setVersions: (versions: Version[]) => void
) {
    try {
        const res = await fetch(`/calm/namespaces/${namespace}/architectures/${architectureID}/versions`);
        const data = await res.json();
        setVersions(data.values);
    } catch (error) {
        console.error(`Error fetching versions for architecture ID ${architectureID}:`, error);
    }
}

/**
 * Fetch a specific architecture by namespace, architecture ID, and version, and set it using the provided setter function.
 */
export async function fetchArchitecture(
    namespace: string,
    architectureID: string,
    version: string,
    setArchitecture: (architecture: Architecture) => void
) {
    try {
        const res = await fetch(
            `/calm/namespaces/${namespace}/architectures/${architectureID}/versions/${version}`
        );
        const data = await res.json();
        setArchitecture(data);
    } catch (error) {
        console.error(
            `Error fetching architecture for namespace ${namespace}, architecture ID ${architectureID}, version ${version}:`,
            error
        );
    }
}