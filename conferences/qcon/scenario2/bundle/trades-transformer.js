import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default class TradesTransformer {
    registerTemplateHelpers() {
        return {};
    }

    getTransformedModel(calmJson) {
        const data = calmJson.originalJson ?? calmJson;
        const nodes = data.nodes ?? [];

        const tradesApi = nodes.find(n => n['unique-id'] === 'trades-api');
        const mcpServer = nodes.find(n => n['unique-id'] === 'mcp-server');

        // Extract denied symbols from control configuration
        const deniedSymbols = this._extractDeniedSymbols(mcpServer);

        return {
            document: {
                'trades-api-image': this._iface(tradesApi, 'image'),
                'trades-api-port':  this._iface(tradesApi, 'port'),
                'mcp-server-image': this._iface(mcpServer, 'image'),
                'mcp-server-port':  this._iface(mcpServer, 'port'),
                'denied-symbols': deniedSymbols,
            }
        };
    }

    _iface(node, key) {
        return node?.interfaces?.find(i => key in i)?.[key];
    }

    _extractDeniedSymbols(mcpServer) {
        try {
            // Try to load the control config from the local file
            const configPath = join(__dirname, '..', 'calm', 'controls', 'mcp-guardrail.config.json');
            const configContent = readFileSync(configPath, 'utf-8');
            const config = JSON.parse(configContent);
            
            // Convert array to comma-separated string
            if (config['denied-symbols'] && Array.isArray(config['denied-symbols'])) {
                return config['denied-symbols'].join(',');
            }
        } catch (error) {
            console.warn('Could not load control config, using defaults:', error.message);
        }
        
        // Fallback to default values
        return 'VOD,GME,AMC';
    }
}
