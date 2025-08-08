export class TemplatePreprocessor {
    static preprocessTemplate(template: string): string {
        // Handlebars control structures and built-in keywords that should not be processed
        const handlebarsKeywords = new Set([
            'else', 'if', 'unless', 'each', 'with', 'lookup', 'this',
            'true', 'false', 'null', 'undefined', '@index', '@key', '@first', '@last'
        ]);

        // Matches helper-based calls like: {{list nodes[...] ...}}
        const helperPattern =
            /{{\s*(\w+)\s+((?:\w+|\[[^\]]+\]|\.|\['[^']+'']|\.\w+)+)((?:\s+\w+="[^"]*")*)\s*}}/g;

        // Matches standalone paths like: {{nodes[...]}}
        const extractablePattern =
            /{{\s*((?:\w+|\[[^\]]+\]|\.|\['[^']+'']|\.\w+)+)\s*}}/g;

        // Replace helper-based matches
        template = template.replace(helperPattern, (_match, helper, path, extras) => {
            // Skip if the path is a Handlebars keyword
            if (handlebarsKeywords.has(path.trim())) {
                return _match;
            }
            const safePath = path.replace(/"/g, '\\"');
            //TODO: What happens if a widget has same helper function as the DotNotation helper filter + sort etc?
            return `{{${helper} (convertFromDotNotation this "${safePath}" ${extras})${extras}}}`;
        });

        // Replace standalone paths, but exclude Handlebars keywords
        return template.replace(extractablePattern, (_match, path) => {
            // Skip if it's a Handlebars keyword or control structure
            if (handlebarsKeywords.has(path.trim())) {
                return _match; // Return unchanged
            }

            const safePath = path.replace(/"/g, '\\"');
            return `{{convertFromDotNotation this "${safePath}"}}`;
        });
    }
}
