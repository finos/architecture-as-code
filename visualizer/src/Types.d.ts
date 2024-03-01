export interface Node {
    name: string, 
    class: string,
    uniqueId: string,
    nodeType: string,
    extras?: {[field: string]: unknown}
}

export type Relationship = InteractsRelationship | ConnectsRelationship | DeployedInRelationship | ComposedOfRelationship;

export interface InteractsRelationship {
    relationshipType: 'interacts',
    uniqueId: string,
    parties: {
        actor: string,
        nodes: string[]
    }
}

export interface ConnectsRelationship {
    relationshipType: 'connects',
    uniqueId: string,
    protocol?: string,
    authentication?: string,
    parties: {
        source: string,
        destination: string
    }
}

export interface DeployedInRelationship {
    relationshipType: 'deployed-in',
    uniqueId: string,
    parties: {
        container: string,
        nodes: string[]
    }
}

export interface ComposedOfRelationship {
    relationshipType: 'composed-of',
    uniqueId: string,
    parties: {
        container: string,
        nodes: string[]
    }
}