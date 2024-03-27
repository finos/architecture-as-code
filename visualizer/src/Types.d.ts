export interface CALMManifest {
    nodes: Node[],
    relationships: Relationship[]
}

export type NodeType = 'actor' | 'system' | 'service' | 'database' | 'internal-network' | 'ldap' | 'dataclient';

export interface Node {
    name: string, 
    class?: string,
    'unique-id': string,
    'node-type': NodeType,
    description: string,
    'data-classification'?: string,
    'run-as'?: string,
    instance?: string
}

export type Relationship = InteractsRelationship | ConnectsRelationship | DeployedInRelationship | ComposedOfRelationship;

export interface InteractsRelationship {
    'relationship-type': {
        'interacts': {
            actor: string,
            nodes: string[]
        }
    },
    uniqueId: string,
}

export interface ConnectsRelationship {
    'relationship-type': {
        'connects': {
            source: string,
            destination: string
        }
    },
    uniqueId: string,
    protocol: string,
    authentication: string,
}

export interface DeployedInRelationship {
    'relationship-type': {
        'deployed-in': {
            container: string,
            nodes: string[]
        }
    },
    uniqueId: string,
}

export interface ComposedOfRelationship {
    'relationship-type': {
        'composed-of': {
            container: string,
            nodes: string[]
        },
    }
    uniqueId: string,
}