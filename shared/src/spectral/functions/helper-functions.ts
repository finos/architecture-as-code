
export function detectDuplicates(matches, seenIds, messages) {
    for (const match of matches) {
        const id = match['value'];

        if (seenIds.has(id)) {
            messages.push({
                message: `Duplicate unique-id detected. ID: ${id}, path: ${match['pointer']}`,
                path: [match['pointer']]
            });
        }
        else {
            seenIds.add(id);
        }
    }
}

export function numericalPlaceHolder(input, _, context) {
    if (input == -1) {
        return [{
            message: 'Value was equal to -1 - placeholder property detected',
            path: [...context.path]
        }];
    }
}