module.exports = class BasicTransformer {
    registerTemplateHelpers() {
        return {};
    }

    getTransformedModel(rawJson) {
        const document = rawJson['originalJson'];
        return {
            document: document
        };
    }
};
