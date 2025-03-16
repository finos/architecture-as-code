module.exports = class BasicTransformer {
    registerTemplateHelpers() {
        return {};
    }

    getTransformedModel(rawJson) {
        const document = JSON.parse(rawJson);
        return {
            document: document
        };
    }
};
