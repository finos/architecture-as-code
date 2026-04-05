// src/infrastructure-transformer.js
export default class InfrastructureTransformer {
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
    let secure;

    // Flatten metadata
    const meta = Array.isArray(data.metadata)
        ? Object.assign({}, ...data.metadata)
        : data.metadata || {};
    namespaceName = meta.kubernetes && meta.kubernetes.namespace;

    // Process nodes
    for (const node of data.nodes || []) {
      switch (node['node-type']) {
        case 'system':
          if (
              node.controls &&
              Object.values(node.controls).some(ctrl =>
                  ctrl.requirements.some(req =>
                      (req['config-url'] || '').includes('micro-segmentation')
                  )
              )
          ) {
            secure = true;
          }
          break;

        case 'database':
          databaseName = node['unique-id'];
          databasePort = this._findInterfaceValue(node.interfaces, 'port');
          break;

        case 'service':
          appName = node['unique-id'];
          applicationPort = this._findInterfaceValue(node.interfaces, 'port');
          applicationImage = this._findInterfaceValue(node.interfaces, 'image');
          break;

        case 'network':
          lbHost = this._findInterfaceValue(node.interfaces, 'host');
          lbPort = this._findInterfaceValue(node.interfaces, 'port');
          break;

        default:
          break;
      }
    }

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

  /**
   * Helper to find a property in interfaces array.
   * @param {Array<object>} interfaces
   * @param {string} key
   * @returns {*}
   */
  _findInterfaceValue(interfaces = [], key) {
    const iface = interfaces.find(i =>
        Object.prototype.hasOwnProperty.call(i, key)
    );
    return iface ? iface[key] : undefined;
  }
}