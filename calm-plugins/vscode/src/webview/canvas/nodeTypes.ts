import type { NodeTypes } from 'reactflow';
import { ContainerNode } from './nodes/ContainerNode';
import { GenericNode } from './nodes/GenericNode';

export const nodeTypes: NodeTypes = {
    service: GenericNode,
    actor: GenericNode,
    database: GenericNode,
    container: ContainerNode,
    webclient: GenericNode,
    system: GenericNode,
    ecosystem: GenericNode,
    network: GenericNode,
    ldap: GenericNode,
    'data-asset': GenericNode,
    extension: GenericNode,
};
