// eslint-disable-next-line no-undef
module.exports = class JsTransformer {
    registerTemplateHelpers() {
        return {
            uppercase: (text) => text.toUpperCase()
        };
    }

    getTransformedModel(rawJson) {
        const document = rawJson['originalJson'];
        return {
            document: {
                id: document.metadata['id'],
                name: document.metadata['title'],
                description: document.metadata['description'],
                nodes: document.nodes || [],
                relationships: document.relationships || []
            }
        };
    }
};
