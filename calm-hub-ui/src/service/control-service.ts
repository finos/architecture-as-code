import { getAuthHeaders } from '../authService.js';
import { ControlDetail } from '../model/control.js';

/**
 * Fetch domains and return them.
 */
export async function fetchDomains(setDomains: (domains: string[]) => void) {
    try {
        const headers = await getAuthHeaders();
        const res = await fetch('/calm/domains', {
            method: 'GET',
            headers,
        });
        const data = await res.json();
        const values = Array.isArray(data?.values) ? data.values : [];
        const domains = values.filter((v: unknown): v is string => typeof v === 'string');
        setDomains(domains);
    } catch (error) {
        console.error('Error fetching domains:', error);
    }
}

/**
 * Fetch controls for a given domain.
 */
export async function fetchControlsForDomain(
    domain: string,
    setControls: (controls: ControlDetail[]) => void
) {
    try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/calm/domains/${domain}/controls`, {
            method: 'GET',
            headers,
        });
        const data = await res.json();
        const values = Array.isArray(data?.values) ? data.values : [];
        setControls(values);
    } catch (error) {
        console.error(`Error fetching controls for domain ${domain}:`, error);
    }
}

/**
 * Fetch requirement versions for a control.
 */
export async function fetchRequirementVersions(
    domain: string,
    controlId: number,
    setVersions: (versions: string[]) => void
) {
    try {
        const headers = await getAuthHeaders();
        const res = await fetch(
            `/calm/domains/${domain}/controls/${controlId}/requirement/versions`,
            {
                method: 'GET',
                headers,
            }
        );
        const data = await res.json();
        setVersions(Array.isArray(data?.values) ? data.values : []);
    } catch (error) {
        console.error(
            `Error fetching requirement versions for control ${controlId}:`,
            error
        );
    }
}

/**
 * Fetch requirement JSON at a specific version.
 */
export async function fetchRequirementForVersion(
    domain: string,
    controlId: number,
    version: string
): Promise<unknown> {
    try {
        const headers = await getAuthHeaders();
        const res = await fetch(
            `/calm/domains/${domain}/controls/${controlId}/requirement/versions/${version}`,
            {
                method: 'GET',
                headers,
            }
        );
        return await res.json();
    } catch (error) {
        console.error(
            `Error fetching requirement version ${version} for control ${controlId}:`,
            error
        );
        return undefined;
    }
}

/**
 * Fetch configuration IDs for a control.
 */
export async function fetchConfigurationsForControl(
    domain: string,
    controlId: number,
    setConfigIds: (configIds: number[]) => void
) {
    try {
        const headers = await getAuthHeaders();
        const res = await fetch(
            `/calm/domains/${domain}/controls/${controlId}/configurations`,
            {
                method: 'GET',
                headers,
            }
        );
        const data = await res.json();
        setConfigIds(Array.isArray(data?.values) ? data.values : []);
    } catch (error) {
        console.error(
            `Error fetching configurations for control ${controlId}:`,
            error
        );
    }
}

/**
 * Fetch versions for a specific configuration.
 */
export async function fetchConfigurationVersions(
    domain: string,
    controlId: number,
    configId: number,
    setVersions: (versions: string[]) => void
) {
    try {
        const headers = await getAuthHeaders();
        const res = await fetch(
            `/calm/domains/${domain}/controls/${controlId}/configurations/${configId}/versions`,
            {
                method: 'GET',
                headers,
            }
        );
        const data = await res.json();
        setVersions(Array.isArray(data?.values) ? data.values : []);
    } catch (error) {
        console.error(
            `Error fetching configuration versions for config ${configId}:`,
            error
        );
    }
}

/**
 * Fetch configuration JSON at a specific version.
 */
export async function fetchConfigurationForVersion(
    domain: string,
    controlId: number,
    configId: number,
    version: string
): Promise<unknown> {
    try {
        const headers = await getAuthHeaders();
        const res = await fetch(
            `/calm/domains/${domain}/controls/${controlId}/configurations/${configId}/versions/${version}`,
            {
                method: 'GET',
                headers,
            }
        );
        return await res.json();
    } catch (error) {
        console.error(
            `Error fetching configuration version ${version} for config ${configId}:`,
            error
        );
        return undefined;
    }
}
