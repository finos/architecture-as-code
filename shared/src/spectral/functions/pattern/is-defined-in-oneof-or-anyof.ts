import { JSONPath } from 'jsonpath-plus';
/**
 * Checks that the input value should be defined in a oneOf or anyOf block.
 */
export function isDefinedInOneOfOrAnyOf(input, { calmType }: { calmType: 'nodes' | 'relationships'}, context) {
    if (!input || typeof input !== 'string') {
        return [];
    }

    const names = JSONPath({ path: `$.properties.${calmType}.prefixItems[*].properties.unique-id.const`, json: context.document.data });
    const oneofs = JSONPath({ path: `$.properties.${calmType}.prefixItems[*].oneOf[*].properties.unique-id.const`, json: context.document.data });
    const anyofs = JSONPath({ path: `$.properties.${calmType}.prefixItems[*].anyOf[*].properties.unique-id.const`, json: context.document.data });

    const results = [];

    if (names.includes(input) && !oneofs.includes(input) && !anyofs.includes(input)) {
        results.push({
            message: `'${input}' is part of a pattern option and must be defined in a oneOf or anyOf block.`,
            path: [...context.path],
        });
    }
    return results;
};
