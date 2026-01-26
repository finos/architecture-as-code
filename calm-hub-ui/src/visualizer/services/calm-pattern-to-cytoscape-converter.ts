import { CalmControlsSchema } from "../../../../calm-models/src/types/control-types.js";
import { CalmArchitectureSchema, CalmNodeSchema, CalmRelationshipSchema } from "../../../../calm-models/src/types/core-types.js";
import { CalmMetadataSchema } from "../../../../calm-models/src/types/metadata-types.js";
import { CalmPatternSchema, IndividualPrefixItem, PrefixItem } from "../contracts/calm-pattern-contracts.js";

export function isCalmPatternSchema(value: unknown): value is CalmPatternSchema {
    const castedValue = value as CalmPatternSchema;
    let check = castedValue != null;
    check = check && castedValue.type != null && typeof castedValue.type === 'string';
    check = check && castedValue.title != null && typeof castedValue.title === 'string';
    check = check && castedValue.required != null && Array.isArray(castedValue.required);
    check = check && castedValue.properties != null;
    check = check && Object.keys(castedValue.properties).includes('nodes');
    check = check && Object.keys(castedValue.properties).includes('relationships');
    return check;
}

function extractIndividualPrefixItem(item: PrefixItem): IndividualPrefixItem {
    if ('oneOf' in item) {
        // Assuming we want the properties of the first item in oneOf for simplicity
        return item.oneOf[0];
    }
    if ('anyOf' in item) {
        // Assuming we want the properties of the first item in anyOf for simplicity
        return item.anyOf[0];
    }
    return item;
}

function extractPropertiesFromPrefixItem(item: PrefixItem): Record<string, unknown> {
    const properties = extractIndividualPrefixItem(item).properties;
    const result: Record<string, unknown> = {};

    if (properties == null || typeof properties !== 'object') {
        return result;
    }

    Object.keys(properties).forEach(key => {
        const prop = properties[key];
        if (prop == null || typeof prop !== 'object') {
            return;
        }
        if ('const' in prop) {
            result[key] = prop.const;
        } else if ('prefixItems' in prop && Array.isArray(prop.prefixItems)) {
            result[key] = prop.prefixItems.map(extractPropertiesFromPrefixItem);
        } else {
            result[key] = extractPropertiesFromPrefixItem(prop as PrefixItem);
        }
    })

    return result;
}

export function convertCalmPatternToCalm(pattern?: CalmPatternSchema): CalmArchitectureSchema {
    const calmNodes = pattern?.properties.nodes.prefixItems.map(extractPropertiesFromPrefixItem);
    const calmRelationships = pattern?.properties.relationships.prefixItems.map(extractPropertiesFromPrefixItem);
    const metadata = pattern?.properties.metadata?.prefixItems.map(extractPropertiesFromPrefixItem);
    const controls = pattern?.properties.controls?.prefixItems.map(extractPropertiesFromPrefixItem);

    return {
        nodes: calmNodes as CalmNodeSchema[],
        relationships: calmRelationships as CalmRelationshipSchema[],
        metadata: metadata as CalmMetadataSchema | undefined,
        controls: controls as CalmControlsSchema | undefined,
    }
}