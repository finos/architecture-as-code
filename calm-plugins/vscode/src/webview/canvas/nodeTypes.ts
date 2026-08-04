import type { NodeTypes } from 'reactflow';
import { ServiceNode } from './nodes/ServiceNode';
import { ActorNode } from './nodes/ActorNode';
import { DatabaseNode } from './nodes/DatabaseNode';
import { ContainerNode } from './nodes/ContainerNode';
import { WebclientNode } from './nodes/WebclientNode';
import { GenericNode } from './nodes/GenericNode';

export const nodeTypes: NodeTypes = {
    service: ServiceNode,
    actor: ActorNode,
    database: DatabaseNode,
    container: ContainerNode,
    webclient: WebclientNode,
    system: GenericNode,
    ecosystem: GenericNode,
    network: GenericNode,
    ldap: GenericNode,
    'data-asset': GenericNode,
    extension: GenericNode,
};
