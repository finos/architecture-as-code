// src/infrastructure-transformer.js
export default class InfrastructureTransformer {
    /**
     * Register any template helpers (e.g., Handlebars helpers).
     * @returns {Object<string, Function>}
     */
    registerTemplateHelpers() {
        return {};
    }

    /**
     * Transforms a CALM Core JSON model into a flat document for templates.
     * @param {string} calmJson - The CALM Core schema JSON string.
     * @returns {{ document: { namespaceName?: string; databaseName?: string; databasePort?: number; appName?: string; applicationPort?: number; applicationImage?: string; lbHost?: string; lbPort?: number; secure?: boolean } }}
     */
    getTransformedModel(calmJson) {
        const data = calmJson['originalJson'];

        let namespaceName;
        let databaseName;
        let databasePort;
        let appName;
        let applicationPort;
        let applicationImage;
        let lbHost;
        let lbPort;
        let secure = false;

        const meta = Array.isArray(data.metadata)
            ? Object.assign({}, ...data.metadata)
            : data.metadata || {};
        namespaceName = meta.kubernetes && meta.kubernetes.namespace;

        (data.nodes || []).forEach((node) => {
            const type = node['node-type'];

            if (type === 'system' && node.controls) {
                const hasMicroSeg = Object.values(node.controls).some((ctrl) =>
                    Array.isArray(ctrl.requirements) &&
                    ctrl.requirements.some((req) => {
                        const configUrl = req['config-url'];
                        let id;
                        if (typeof configUrl === 'string') {
                            id = configUrl;
                        } else if (configUrl && typeof configUrl === 'object') {
                            id = configUrl['$id'];
                        }
                        return typeof id === 'string' && id.includes('micro-segmentation');
                    })
                );
                if (hasMicroSeg) {
                    secure = true;
                }
            }

            if (type === 'database') {
                databaseName = node['unique-id'];
                databasePort = this._findInterfaceValue(node.interfaces, 'port');
            }

            if (type === 'service') {
                appName = node['unique-id'];
                applicationPort = this._findInterfaceValue(node.interfaces, 'port');
                applicationImage = this._findInterfaceValue(node.interfaces, 'image');
            }

            if (type === 'network') {
                lbHost = this._findInterfaceValue(node.interfaces, 'host');
                lbPort = this._findInterfaceValue(node.interfaces, 'port');
            }
        });

        return {
            document: {
                namespaceName,
                databaseName,
                appName,
                applicationPort,
                applicationImage,
                lbHost,
                lbPort,
                databasePort,
                secure
            }
        };
    }

    _findInterfaceValue(interfaces = [], key) {
        if (!Array.isArray(interfaces)) {
            return undefined;
        }
        const iface = interfaces.find((i) =>
            Object.prototype.hasOwnProperty.call(i, key)
        );
        return iface ? iface[key] : undefined;
    }
}
