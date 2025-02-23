// eslint-disable-next-line no-undef
module.exports = class JsTransformer {
    registerTemplateHelpers() {
        return {
            uppercase: (text) => text.toUpperCase()
        };
    }

    getTransformedModel(rawJson) {
        const document = JSON.parse(rawJson);
        return {
            document: {
                id: document.id,
                name: document.title,
                description: document.description,
                nodes: document.nodes || [],
                relationships: document.relationships || []
            }
        };
    }
};
