import { CalmArchitectureSchema, CalmNodeSchema, CalmNodeTypeSchema, CalmProtocolSchema, CalmRelationshipSchema, CalmRelationshipTypeSchema } from "../../../../calm-models/src/types/core-types.js";
import { CalmPatternSchema, NodePrefixItem, PrefixItem, RelationshipPrefixItem } from "../contracts/calm-pattern-contracts.js";

export function isCalmPatternSchema(value: any): value is CalmPatternSchema {
    let check = value != null;
    check = check && value.type != null && typeof value.type === 'string';
    check = check && value.title != null && typeof value.title === 'string';
    check = check && value.required != null && Array.isArray(value.required);
    check = check && value.properties != null;
    check = check && Object.keys(value.properties).includes('nodes');
    check = check && Object.keys(value.properties).includes('relationships');
    return check;
}

function convertCalmPatternNodeToCalm(node: NodePrefixItem): CalmNodeSchema {
    const properties = node.properties;

    return {
        'unique-id': properties["unique-id"].const,
        'node-type': properties["node-type"].const as CalmNodeTypeSchema,
        name: properties.name.const,
        description: properties.description.const,
        interfaces: properties.interfaces?.prefixItems.map(extractPropertiesFromPrefixItem),
        controls: properties.controls ? extractPropertiesFromPrefixItem(properties.controls) : undefined,
    };
}

function convertCalmPatternRelationshipToCalm(relationship: RelationshipPrefixItem): CalmRelationshipSchema {
    const properties = relationship.properties;

    return {
        'unique-id': properties["unique-id"].const,
        description: properties.description.const,
        'relationship-type': properties['relationship-type'].const as CalmRelationshipTypeSchema,
        protocol: properties.protocol?.const as CalmProtocolSchema,
        controls: properties.controls ? extractPropertiesFromPrefixItem(properties.controls) : undefined,
    }
}

function extractPropertiesFromPrefixItem(item: PrefixItem): any {
    const properties = item.properties

    let result: { [key: string]: any } = {};

    Object.keys(properties).forEach(key => {
        if (properties[key]?.const !== undefined) {
            result[key] = properties[key].const;
        } else if (properties[key]?.prefixItems !== undefined) {
            result[key] = properties[key].prefixItems.map(extractPropertiesFromPrefixItem);
        } else {
            result[key] = extractPropertiesFromPrefixItem(properties[key]);
        }
    })

    return result;
}

export function convertCalmPatternToCalm(pattern?: CalmPatternSchema): CalmArchitectureSchema {
    const calmNodes = pattern?.properties.nodes.prefixItems.map(convertCalmPatternNodeToCalm);
    const calmRelationships = pattern?.properties.relationships.prefixItems.map(convertCalmPatternRelationshipToCalm);
    const metadata = pattern?.properties.metadata?.prefixItems.map(extractPropertiesFromPrefixItem);
    const controls = pattern?.properties.controls?.prefixItems.map(extractPropertiesFromPrefixItem);

    return {
        nodes: calmNodes,
        relationships: calmRelationships,
        metadata: metadata,
        controls: controls as any,
    }
}