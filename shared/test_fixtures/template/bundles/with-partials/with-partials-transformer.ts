/* eslint-disable  @typescript-eslint/no-explicit-any */
import {CalmTemplateTransformer} from '../../../../src/template/types';
import {CalmCore} from '../../../../src/model/core.js';

export class CalmTransformer implements CalmTemplateTransformer {
    registerTemplateHelpers(): Record<string, (...args: any[]) => any> {
        return {
            uppercase: (text: string) => text.toUpperCase(),
            lookup: (nodes: Array<Record<string, any>>, id: string) => {
                return nodes.find(node => node['unique-id'] === id)?.name ?? `Unknown (${id})`;
            }
        };
    }

    getTransformedModel(architecture: CalmCore): any {

        const parsed = architecture.toCanonicalSchema();

        return {
            document: {
                id: parsed.metadata['id'],
                name: parsed['name'],
                description: parsed.metadata['description'],
                nodes: parsed.nodes || [],
                relationships: parsed.relationships || []
            }
        };
    }
}

export default CalmTransformer;
