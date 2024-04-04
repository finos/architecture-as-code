/**
 * Checks that the given input, a unique ID, is referenced by at least one relationship.
 */
export default (input, _, context) => {
    let nodeName = input;
    let relationshipLabels = context.document.data.relationships?.map(relationship => [
        relationship?.["relationship-type"]?.connects?.source?.node, 
        relationship?.["relationship-type"]?.connects?.destination?.node, 
        relationship?.["relationship-type"]?.interacts?.actor,
        relationship?.["relationship-type"]?.interacts?.nodes,
        relationship?.["relationship-type"]?.["composed-of"]?.container,
        relationship?.["relationship-type"]?.["composed-of"]?.nodes,
        relationship?.["relationship-type"]?.["deployed-in"]?.container,
        relationship?.["relationship-type"]?.["deployed-in"]?.nodes,
    ]).flat(3); // flatten down to an array
    let results = [];
    if (!relationshipLabels) {
        return [{
            message: `Node with ID '${nodeName}' is not referenced by any relationships.`,
            path: [...context.path]
        }];
    }
    if (!relationshipLabels.includes(nodeName)) {
        results.push({
            message: `Node with ID '${nodeName}' is not referenced by any relationships.`,
            path: [...context.path]
        });
    }
    return results;
}