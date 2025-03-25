import { CalmNode } from '@finos/calm-shared/model/node';
import { CalmConnectsType, CalmRelationship } from '@finos/calm-shared/model/relationship';

export class PatternBuilder {
    private schema = 'https://calm.finos.org/draft/2025-03/meta/';
    private nodes = [];
    private relationships = [];

    constructor(
        private id: string,
        private title: string
    ) {}

    public addNode(node: CalmNode): void {
        this.nodes.push({
            '$ref': this.schema + '/core.json#/defs/node',
            'type': 'object',
            'properties': {
                'unique-id': {
                    'const': node.uniqueId
                },
                'name': {
                    'const': node.name
                },
                'description': {
                    'const': node.description
                },
                'node-type': {
                    'const': node.nodeType
                }
            }
        });
    }

    private buildOptionsRelationship(options: object[]) {
        return {
            'relationship-type': {
                'options': {
                    'type': 'array',
                    'minItems': 1,
                    'maxItems': 1,
                    'prefixItems': options
                }
            }
        };
    }

    private getRelationshipType(relationship: CalmRelationship): object {
        if (relationship instanceof CalmConnectsType) {
            
        }
    }

    public addRelationship(relationship: CalmRelationship): void {
        this.relationships.push({
            '$ref': this.schema + '/core.json#/defs/relationship',
            'type': 'object',
            'properties': {
                'unique-id': {
                    'const': relationship.uniqueId
                },
                'description': {
                    'const': relationship.description
                },
                'relationship-type': {
                    'const': {
                        'connects': {
                            'source': { 'node': 'application-c' },
                            'destination': { 'node': 'node-1' }
                        }
                    }
                }
            }
        });
    }

    public build(): object {
        return {
            '$schema': this.schema + '/calm.json',
            '$id': this.id,
            'title': this.title,
            'type': 'object',
            'properties': {
                'nodes': {
                    'prefixItems': this.nodes
                },
                'relationships': {
                    'prefixItems': this.relationships
                }
            }
        };
    }
}