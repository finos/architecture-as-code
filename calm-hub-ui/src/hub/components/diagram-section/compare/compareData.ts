import { CalmService } from '../../../../service/calm-service.js';
import { Data, isSlug } from '../../../../model/calm.js';

export type ComparableType = 'Architectures' | 'Patterns';

/**
 * Fetch the list of available versions for an architecture or pattern, handling
 * both slug (custom-id) and numeric resource identifiers.
 */
export async function fetchVersionList(
    calmService: CalmService,
    namespace: string,
    calmType: ComparableType,
    id: string,
): Promise<string[]> {
    if (isSlug(id)) {
        return calmService.fetchVersionsByCustomId(namespace, id);
    }
    return calmType === 'Architectures'
        ? calmService.fetchArchitectureVersions(namespace, id)
        : calmService.fetchPatternVersions(namespace, id);
}

/**
 * Fetch a specific version of an architecture or pattern, handling both slug
 * (custom-id) and numeric resource identifiers.
 */
export async function fetchVersionData(
    calmService: CalmService,
    namespace: string,
    calmType: ComparableType,
    id: string,
    version: string,
): Promise<Data> {
    if (isSlug(id)) {
        return calmService.fetchResourceByCustomId(namespace, id, version, calmType);
    }
    return calmType === 'Architectures'
        ? calmService.fetchArchitecture(namespace, id, version)
        : calmService.fetchPattern(namespace, id, version);
}
