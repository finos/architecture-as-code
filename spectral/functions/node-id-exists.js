/**
 * Checks that the input value exists as a node with a matching unique ID.
 */
export default (input, _, context) => {
    if (!input) {
        return [];
    }
    // get uniqueIds of all nodes
    let names = context.document.data.nodes.map(node => node.uniqueId);
    let results = [];

    if (!names.includes(input)) {
        results.push({
            message: `'${input}' does not refer to the uniqueId of an existing node.`,
            path: [...context.path]
        });
    }
    return results;
}