/**
 * Checks that the input value exists as an interface with matching unique ID defined under a node in the document.
 */
export default (input, _, context) => {
    if (!input) {
        return [];
    }
    // get uniqueIds of all interfaces 
    let names = context.document.data.nodes.flatMap(node => node?.interfaces?.map(inter => inter['unique-id']));
    let results = [];

    if (!names.includes(input)) {
        results.push({
            message: `'${input}' does not refer to the unique-id of an existing interface.`,
            path: [...context.path]
        });
    }
    return results;
}