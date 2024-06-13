export interface CALMInstantiation {
    nodes: CALMNode[],
    relationships: CALMRelationship[]
}

export type NodeType = 'actor' | 'system' | 'service' | 'database' | 'network' | 'ldap' | 'dataclient';

export interface CALMNode {
    name: string, 
    class?: string,
    'unique-id': string,
    'node-type': NodeType,
    description: string,
    'data-classification'?: string,
    'run-as'?: string,
    instance?: string
}

export type CALMRelationship = CALMInteractsRelationship | CALMConnectsRelationship | CALMDeployedInRelationship | CALMComposedOfRelationship;

export interface CALMInteractsRelationship {
    'relationship-type': {
        'interacts': {
            actor: string,
            nodes: string[]
        }
    },
    uniqueId: string,
    description?: string
}

export interface CALMConnectsRelationship {
    'relationship-type': {
        'connects': {
            source: { node: string, interface?: string },
            destination: { node: string, interface?: string }
        }
    },
    uniqueId: string,
    protocol?: string,
    authentication?: string,
    description?: string
}

export interface CALMDeployedInRelationship {
    'relationship-type': {
        'deployed-in': {
            container: string,
            nodes: string[]
        }
    },
    uniqueId: string,
    description?: string
}

export interface CALMComposedOfRelationship {
    'relationship-type': {
        'composed-of': {
            container: string,
            nodes: string[]
        },
    }
    uniqueId: string,
    description?: string
}