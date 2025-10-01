import { CalmNodeCanonicalModel } from '@finos/calm-models/canonical';
import { VMLeafNode, VMAttach } from '../../types';
import { VMNodeFactory } from './vm-factory-interfaces';
import { ifaceId, prettyLabel } from '../utils';


type WithOptionalLabel = CalmNodeCanonicalModel & { label?: string };

export const labelFor = (n?: WithOptionalLabel, id?: string) =>
    n?.name || n?.label || n?.['unique-id'] || (id ? prettyLabel(id) : '');


/**
 * Standard implementation of VMNodeFactory for creating leaf nodes with interface attachments
 */
export class StandardVMNodeFactory implements VMNodeFactory {
    createLeafNode(node: CalmNodeCanonicalModel, renderInterfaces: boolean): { node: VMLeafNode; attachments: VMAttach[] } {
        const attachments: VMAttach[] = [];
        const leaf: VMLeafNode = {
            id: node['unique-id'],
            label: labelFor(node, node['unique-id']),
            nodeType: node['node-type']
        };

        if (renderInterfaces && Array.isArray(node.interfaces) && node.interfaces.length > 0) {
            leaf.interfaces = node.interfaces.map(itf => {
                const iid = ifaceId(node['unique-id'], itf['unique-id']);
                attachments.push({ from: node['unique-id'], to: iid });
                return { id: iid, label: `◻ ${itf.name || itf['unique-id']}` };
            });
        }

        return { node: leaf, attachments };
    }
}
