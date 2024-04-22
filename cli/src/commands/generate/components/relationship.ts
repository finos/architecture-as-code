import { initLogger } from "../../helper";
import { getPropertyValue } from "./property";

export function instantiateRelationships(pattern: any, debug: boolean = false): any {
    const logger = initLogger(debug)
    const relationships = pattern?.properties?.relationships?.prefixItems;

    if (!relationships) {
        logger.error('Warning: pattern has no relationships defined');
        if (pattern?.properties?.relationships?.items) {
            logger.warn('Note: properties.relationships.items is deprecated: please use prefixItems instead.');
        }
        return [];
    }

    const outputRelationships = [];
    for (const relationship of relationships) {
        if (!('properties' in relationship)) {
            continue;
        }

        const out = {};
        for (const [key, detail] of Object.entries(relationship['properties'])) {
            out[key] = getPropertyValue(key, detail);
        }

        outputRelationships.push(out);
    }

    return outputRelationships;
}