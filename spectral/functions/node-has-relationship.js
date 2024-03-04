/**
 * Checks that the given input, a unique ID, is referenced by at least one relationship.
 */
export default (input, _, context) => {
    let nodeName = input;
    let relationshipLabels = context.document.data.relationships?.map(relationship => [
        relationship?.parties?.source, 
        relationship?.parties?.destination,
        relationship?.parties?.container,
        relationship?.parties?.actor,
        relationship?.parties?.nodes
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