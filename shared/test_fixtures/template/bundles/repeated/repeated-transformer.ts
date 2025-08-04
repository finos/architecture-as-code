/* eslint-disable  @typescript-eslint/no-explicit-any */
import {CalmTemplateTransformer} from '../../../../src/template/types';
import {CalmCore} from '../../../../src/model/core.js';


export default class RepeatedTransformer implements CalmTemplateTransformer {

    registerTemplateHelpers(): Record<string, (...args: any[]) => any> {
        return {
            uppercase: (text: string) => text.toUpperCase(),
            lowercase: (text: string) => text.toLowerCase(),
        };
    }
    
    getTransformedModel(architecture: CalmCore): any {
        const parsedData = architecture.toCanonicalSchema();

        if (parsedData.nodes && Array.isArray(parsedData.nodes)) {
            parsedData.nodes = parsedData.nodes.map(node => ({
                ...node,
                id: node['unique-id'] || node.id // Ensure id is set to unique-id if available
            }));
        }

        return parsedData;
    }
}
