/**
 * Checks that the input value exists as a node with a matching unique ID.
 */
export default (input, _, context) => {
    if (!input) {
        return [];
    }
    // get uniqueIds of all nodes
    let names = context.document.data.nodes.map(node => node["unique-id"]);
    let results = [];

    if (!names.includes(input)) {
        results.push({
            message: `'${input}' does not refer to the unique-id of an existing node.`,
            path: [...context.path]
        });
    }
    return results;
}