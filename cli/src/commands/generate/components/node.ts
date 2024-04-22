import { initLogger } from "../../helper";
import { getPropertyValue } from "./property";

export function instantiateNode(node: any): any {
    const out = {};
    for (const [key, detail] of Object.entries(node['properties'])) {
        if (key === 'interfaces') {
            const interfaces = instantiateNodeInterfaces(detail);
            out['interfaces'] = interfaces;
        }
        else {
            out[key] = getPropertyValue(key, detail);
        }
    }
    return out;
}

export function instantiateNodes(pattern: any, debug: boolean = false): any {
    const logger = initLogger(debug);
    const nodes = pattern?.properties?.nodes?.prefixItems;
    if (!nodes) {
        logger.error('Warning: pattern has no nodes defined.');
        if (pattern?.properties?.nodes?.items) {
            logger.warn('Note: properties.relationships.items is deprecated: please use prefixItems instead.');
        }
        return [];
    }
    const outputNodes = [];

    for (const node of nodes) {
        if (!('properties' in node)) {
            continue;
        }

        outputNodes.push(instantiateNode(node));
    }
    return outputNodes;
}


export function instantiateNodeInterfaces(detail: any, debug: boolean = false): any[] {
    const logger = initLogger(debug);
    const interfaces = [];
    if (!('prefixItems' in detail)) {
        logger.error('No items in interfaces block.');
        return [];
    }

    const interfaceDefs = detail.prefixItems;
    for (const interfaceDef of interfaceDefs) {
        if (!('properties' in interfaceDef)) {
            continue;
        }

        const out = {};
        for (const [key, detail] of Object.entries(interfaceDef['properties'])) {
            out[key] = getPropertyValue(key, detail);
        }

        interfaces.push(out);
    }

    return interfaces;
}