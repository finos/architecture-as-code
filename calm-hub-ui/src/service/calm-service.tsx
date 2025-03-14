import {
    Namespace,
    PatternID,
    Version,
    FlowID,
    ArchitectureID,
    Data,
} from '../model/calm.js';
import { getToken } from "../authService";

/**
 * Fetch namespaces and set them using the provided setter function.
 */
export async function fetchNamespaces(setNamespaces: (namespaces: Namespace[]) => void) {
    try {
        const accessToken = await getToken();
        const res = await fetch('/calm/namespaces',{
                        method: 'GET',
                        headers: {'Authorization': `Bearer ${accessToken}`,},
                        });
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
        const accessToken = await getToken();
        const res = await fetch(`/calm/namespaces/${namespace}/patterns`,{
                            method: 'GET',
                            headers: {'Authorization': `Bearer ${accessToken}`,},
                            });
        const data = await res.json();
        setPatternIDs(data.values.map((num: number) => num.toString()));
    } catch (error) {
        console.error(`Error fetching pattern IDs for namespace ${namespace}:`, error);
    }
}

/**
 * Fetch flow IDs for a given namespace and set them using the provided setter function.
 */
export async function fetchFlowIDs(namespace: string, setFlowIDs: (flowIDs: FlowID[]) => void) {
    try {
        const accessToken = await getToken();
        const res = await fetch(`/calm/namespaces/${namespace}/flows`,{
                            method: 'GET',
                            headers: {'Authorization': `Bearer ${accessToken}`,},
                            });
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
        const accessToken = await getToken();
        const res = await fetch(`/calm/namespaces/${namespace}/patterns/${patternID}/versions`,{
                            method: 'GET',
                            headers: {'Authorization': `Bearer ${accessToken}`,},
                            });
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
        const accessToken = await getToken();
        const res = await fetch(`/calm/namespaces/${namespace}/flows/${flowID}/versions`,{
                            method: 'GET',
                            headers: {'Authorization': `Bearer ${accessToken}`,},
                            });
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
    setPattern: (pattern: Data) => void
) {
    try {
        const accessToken = await getToken();
        const res = await fetch(
            `/calm/namespaces/${namespace}/patterns/${patternID}/versions/${version}`,{
                method: 'GET',
                headers: {'Authorization': `Bearer ${accessToken}`,},
            });
        const response = await res.json();
        const data: Data = { name: namespace, data: response}
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
    setFlow: (flow: Data) => void
) {
    try {
        const accessToken = await getToken();
        const res = await fetch(
            `/calm/namespaces/${namespace}/flows/${flowID}/versions/${version}`,{
                 method: 'GET',
                 headers: {'Authorization': `Bearer ${accessToken}`,},
             });
        const response = await res.json();
        const data: Data = { name: namespace, data: response}
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
        const accessToken = await getToken();
        const res = await fetch(`/calm/namespaces/${namespace}/architectures`,{
                            method: 'GET',
                            headers: {'Authorization': `Bearer ${accessToken}`,},
                          });
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

        const accessToken = await getToken();
        const res = await fetch(`/calm/namespaces/${namespace}/architectures/${architectureID}/versions`,{
                            method: 'GET',
                            headers: {'Authorization': `Bearer ${accessToken}`,},
                          });
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
    setArchitecture: (architecture: Data) => void
) {
    try {
        const accessToken = await getToken();
        const res = await fetch(
            `/calm/namespaces/${namespace}/architectures/${architectureID}/versions/${version}`,{
                method: 'GET',
                headers: {'Authorization': `Bearer ${accessToken}`,},
            });
        const response = await res.json();
        const data: Data = { name: namespace, data: response}
        setArchitecture(data);
    } catch (error) {
        console.error(
            `Error fetching architecture for namespace ${namespace}, architecture ID ${architectureID}, version ${version}:`,
            error
        );
    }
}
