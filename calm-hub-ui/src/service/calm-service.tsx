import { Data } from '../model/calm.js';
import { getAuthHeaders } from '../authService.js';

/**
 * Fetch namespaces and set them using the provided setter function.
 */
export async function fetchNamespaces(setNamespaces: (namespaces: string[]) => void) {
    try {
        const headers = await getAuthHeaders();
        const res = await fetch('/calm/namespaces', {
            method: 'GET',
            headers,
        });
        const data = await res.json();
        const namespaces = (data?.values ?? [])
            .map((v: { name?: string }) => v?.name)
            .filter((name: string | undefined): name is string => !!name);
        setNamespaces(namespaces);
    } catch (error) {
        console.error('Error fetching namespaces:', error);
    }
}

/**
 * Fetch pattern IDs for a given namespace and set them using the provided setter function.
 */
export async function fetchPatternIDs(
    namespace: string,
    setPatternIDs: (patternIDs: string[]) => void
) {
    try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/calm/namespaces/${encodeURIComponent(namespace)}/patterns`, {
            method: 'GET',
            headers,
        });
        const data = await res.json();
        setPatternIDs(data.values.map((num: number) => num.toString()));
    } catch (error) {
        console.error('Error fetching pattern IDs for namespace:', namespace, error);
    }
}

/**
 * Fetch flow IDs for a given namespace and set them using the provided setter function.
 */
export async function fetchFlowIDs(namespace: string, setFlowIDs: (flowIDs: string[]) => void) {
    try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/calm/namespaces/${encodeURIComponent(namespace)}/flows`, {
            method: 'GET',
            headers,
        });
        const data = await res.json();
        setFlowIDs(data.values.map((id: number) => id.toString()));
    } catch (error) {
        console.error('Error fetching flow IDs for namespace:', namespace, error);
    }
}

/**
 * Fetch versions for a given namespace and pattern ID and set them using the provided setter function.
 */
export async function fetchPatternVersions(
    namespace: string,
    patternID: string,
    setVersions: (versions: string[]) => void
) {
    try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/calm/namespaces/${encodeURIComponent(namespace)}/patterns/${encodeURIComponent(patternID)}/versions`, {
            method: 'GET',
            headers,
        });
        const data = await res.json();
        setVersions(data.values);
    } catch (error) {
        console.error('Error fetching versions for pattern ID:', patternID, error);
    }
}

/**
 * Fetch versions for a given namespace and flow ID and set them using the provided setter function.
 */
export async function fetchFlowVersions(
    namespace: string,
    flowID: string,
    setFlowVersions: (flowVersions: string[]) => void
) {
    try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/calm/namespaces/${encodeURIComponent(namespace)}/flows/${encodeURIComponent(flowID)}/versions`, {
            method: 'GET',
            headers,
        });
        const data = await res.json();
        setFlowVersions(data.values);
    } catch (error) {
        console.error('Error fetching versions for flow ID:', flowID, error);
    }
}

/**
 * Fetch a specific pattern by namespace, pattern ID, and version, and set it using the provided setter function.
 */
export async function fetchPattern(
    namespace: string,
    patternID: string,
    version: string,
    setPattern: (pattern: Data) => void
) {
    try {
        const headers = await getAuthHeaders();
        const res = await fetch(
            `/calm/namespaces/${encodeURIComponent(namespace)}/patterns/${encodeURIComponent(patternID)}/versions/${encodeURIComponent(version)}`,
            {
                method: 'GET',
                headers,
            }
        );
        const response = await res.json();
        const data: Data = {
            id: patternID,
            version: version,
            calmType: 'Patterns',
            name: namespace,
            data: response,
        };
        setPattern(data);
    } catch (error) {
        console.error(
            'Error fetching pattern for namespace:', namespace, 'pattern ID:', patternID, 'version:', version,
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
    setFlow: (flow: Data) => void
) {
    try {
        const headers = await getAuthHeaders();
        const res = await fetch(
            `/calm/namespaces/${encodeURIComponent(namespace)}/flows/${encodeURIComponent(flowID)}/versions/${encodeURIComponent(version)}`,
            {
                method: 'GET',
                headers,
            }
        );
        const response = await res.json();
        const data: Data = {
            id: flowID,
            version: version,
            calmType: 'Flows',
            name: namespace,
            data: response,
        };
        setFlow(data);
    } catch (error) {
        console.error(
            'Error fetching flow for namespace:', namespace, 'flow ID:', flowID, 'version:', version,
            error
        );
    }
}

/**
 * Fetch architecture IDs for a given namespace and set them using the provided setter function.
 */
export async function fetchArchitectureIDs(
    namespace: string,
    setArchitectureIDs: (architectureIDs: string[]) => void
) {
    try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/calm/namespaces/${encodeURIComponent(namespace)}/architectures`, {
            method: 'GET',
            headers,
        });
        const data = await res.json();
        setArchitectureIDs(data.values.map((id: number) => id.toString()));
    } catch (error) {
        console.error('Error fetching architecture IDs for namespace:', namespace, error);
    }
}

/**
 * Fetch versions for a given namespace and architecture ID and set them using the provided setter function.
 */
export async function fetchArchitectureVersions(
    namespace: string,
    architectureID: string,
    setVersions: (versions: string[]) => void
) {
    try {
        const headers = await getAuthHeaders();
        const res = await fetch(
            `/calm/namespaces/${encodeURIComponent(namespace)}/architectures/${encodeURIComponent(architectureID)}/versions`,
            {
                method: 'GET',
                headers,
            }
        );
        const data = await res.json();
        setVersions(data.values);
    } catch (error) {
        console.error('Error fetching versions for architecture ID:', architectureID, error);
    }
}

/**
 * Fetch a specific architecture by namespace, architecture ID, and version, and set it using the provided setter function.
 */
export async function fetchArchitecture(
    namespace: string,
    architectureID: string,
    version: string,
    setArchitecture: (architecture: Data) => void
) {
    try {
        const headers = await getAuthHeaders();
        const res = await fetch(
            `/calm/namespaces/${encodeURIComponent(namespace)}/architectures/${encodeURIComponent(architectureID)}/versions/${encodeURIComponent(version)}`,
            {
                method: 'GET',
                headers,
            }
        );
        const response = await res.json();
        const data: Data = {
            id: architectureID,
            version: version,
            calmType: 'Architectures',
            name: namespace,
            data: response,
        };
        setArchitecture(data);
    } catch (error) {
        console.error(
            'Error fetching architecture for namespace:', namespace, 'architecture ID:', architectureID, 'version:', version,
            error
        );
    }
}
