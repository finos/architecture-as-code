import { CalmService } from '../../../service/calm-service.js';
import { AdrService } from '../../../service/adr-service/adr-service.js';
import { Data, Adr, isSlug } from '../../../model/calm.js';

export type TypeInUrl = 'architectures' | 'patterns' | 'flows' | 'adrs' | 'standards' | 'interfaces' | 'controls';
export type TypeInUI = 'Architectures' | 'Patterns' | 'Flows' | 'ADRs' | 'Standards' | 'Interfaces' | 'Controls';

export interface LoadResourceOptions {
    version: string;
    type: string;
    namespace: string;
    resourceID: string;
    calmService: CalmService;
    onDataLoad: (data: Data) => void;
    onAdrLoad: (adr: Adr) => void;
    adrService: AdrService;
}

export function mapTypeInUrlToTypeInUI(urlType: TypeInUrl): TypeInUI {
    switch (urlType) {
        case 'architectures':
            return 'Architectures';
        case 'patterns':
            return 'Patterns';
        case 'flows':
            return 'Flows';
        case 'adrs':
            return 'ADRs';
        case 'standards':
            return 'Standards';
        case 'interfaces':
            return 'Interfaces';
        case 'controls':
            return 'Controls';
        default:
            throw new Error(`Unhandled type: ${urlType}`);
    }
}

export function mapTypeInUIToTypeInUrl(uiType: TypeInUI): TypeInUrl {
    switch (uiType) {
        case 'Architectures':
            return 'architectures';
        case 'Patterns':
            return 'patterns';
        case 'Flows':
            return 'flows';
        case 'ADRs':
            return 'adrs';
        case 'Standards':
            return 'standards';
        case 'Interfaces':
            return 'interfaces';
        case 'Controls':
            return 'controls';
        default:
            throw new Error(`Unhandled type: ${uiType}`);
    }
}

export function loadResourceForId(
    version: string,
    type: string,
    namespace: string,
    resourceID: string,
    calmService: CalmService,
    onDataLoad: (data: Data) => void,
) {
    if (isSlug(resourceID)) {
        calmService.fetchResourceByCustomId(namespace, resourceID, version, type).then(onDataLoad);
    }
}

export async function fetchVersionsForResource(
    resourceID: string,
    type: string,
    namespace: string,
    calmService: CalmService,
    adrService: AdrService,
): Promise<string[]> {
    if (isSlug(resourceID) && type !== 'ADRs') {
        return calmService.fetchVersionsByCustomId(namespace, resourceID, type);
    }
    switch (type) {
        case 'Architectures':
            return calmService.fetchArchitectureVersions(namespace, resourceID);
        case 'Patterns':
            return calmService.fetchPatternVersions(namespace, resourceID);
        case 'Flows':
            return calmService.fetchFlowVersions(namespace, resourceID);
        case 'Standards':
            return calmService.fetchStandardVersions(namespace, resourceID);
        case 'ADRs':
            return (await adrService.fetchAdrRevisions(namespace, resourceID))
                .filter((rev) => rev != null)
                .map((rev) => rev.toString());
        default:
            return [];
    }
}

export function loadResource({
    version,
    type,
    namespace,
    resourceID,
    calmService,
    onDataLoad,
    onAdrLoad,
    adrService,
}: LoadResourceOptions) {
    if (type === 'Architectures') {
        calmService.fetchArchitecture(namespace, resourceID, version).then(onDataLoad);
    } else if (type === 'Patterns') {
        calmService.fetchPattern(namespace, resourceID, version).then(onDataLoad);
    } else if (type === 'Flows') {
        calmService.fetchFlow(namespace, resourceID, version).then(onDataLoad);
    } else if (type === 'Standards') {
        calmService.fetchStandard(namespace, resourceID, version).then(onDataLoad);
    } else if (type === 'ADRs') {
        adrService.fetchAdr(namespace, resourceID, version).then(onAdrLoad);
    }
}
