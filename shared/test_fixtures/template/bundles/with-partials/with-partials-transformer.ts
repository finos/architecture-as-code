/* eslint-disable  @typescript-eslint/no-explicit-any */
import {CalmTemplateTransformer} from '@finos/calm-shared';

export class CalmTransformer implements CalmTemplateTransformer {
    registerTemplateHelpers(): Record<string, (...args: any[]) => any> {
        return {
            uppercase: (text: string) => text.toUpperCase(),
            lookup: (nodes: Array<Record<string, any>>, id: string) => {
                return nodes.find(node => node['unique-id'] === id)?.name ?? `Unknown (${id})`;
            }
        };
    }

    getTransformedModel(inputJson: string): any {
        try {
            const parsed = JSON.parse(inputJson);

            return {
                document: {
                    id: parsed.name,
                    name: parsed.name,
                    description: parsed.description,
                    nodes: parsed.nodes || [],
                    relationships: parsed.relationships || []
                }
            };
        } catch (error) {
            throw new Error(`Error parsing CALM JSON: ${error.message}`);
        }
    }
}

export default CalmTransformer;
