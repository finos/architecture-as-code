export default class TradesTransformer {
    registerTemplateHelpers() {
        return {};
    }

    getTransformedModel(calmJson) {
        const data = calmJson.originalJson ?? calmJson;
        const nodes = data.nodes ?? [];

        const tradesApi = nodes.find(n => n['unique-id'] === 'trades-api');
        const mcpServer = nodes.find(n => n['unique-id'] === 'mcp-server');

        return {
            document: {
                'trades-api-image': this._iface(tradesApi, 'image'),
                'trades-api-port':  this._iface(tradesApi, 'port'),
                'mcp-server-image': this._iface(mcpServer, 'image'),
                'mcp-server-port':  this._iface(mcpServer, 'port'),
            }
        };
    }

    _iface(node, key) {
        return node?.interfaces?.find(i => key in i)?.[key];
    }
}
