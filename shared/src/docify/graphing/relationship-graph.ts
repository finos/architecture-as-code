import {
    CalmComposedOfType,
    CalmConnectsType,
    CalmDeployedInType,
    CalmInteractsType,
    CalmRelationship
} from '../../model/relationship.js';


export class CalmRelationshipGraph {
    private adjacencyList: Map<string, Set<string>> = new Map();
    private relationships: CalmRelationship[];

    constructor(relationships: CalmRelationship[]) {
        this.buildGraph(relationships);
        this.relationships = relationships;
    }

    private buildGraph(relationships: CalmRelationship[]) {
        relationships.forEach(rel => {
            if (rel.relationshipType instanceof CalmInteractsType) {
                this.addEdge(rel.relationshipType.actor, rel.relationshipType.nodes);
            } else if (rel.relationshipType instanceof CalmConnectsType) {
                this.addEdge(rel.relationshipType.source.node, [rel.relationshipType.destination.node]);
            } else if (rel.relationshipType instanceof CalmDeployedInType) {
                this.addEdge(rel.relationshipType.container, rel.relationshipType.nodes);
            } else if (rel.relationshipType instanceof CalmComposedOfType) {
                this.addEdge(rel.relationshipType.container, rel.relationshipType.nodes);
            }
        });
    }

    private addEdge(source: string, destinations: string[]) {
        if (!this.adjacencyList.has(source)) {
            this.adjacencyList.set(source, new Set());
        }
        destinations.forEach(dest => {
            this.adjacencyList.get(source)!.add(dest);
            if (!this.adjacencyList.has(dest)) {
                this.adjacencyList.set(dest, new Set());
            }
            this.adjacencyList.get(dest)!.add(source); // Making the graph bidirectional
        });
    }

    public isRelated(startNode: string, targetNode: string): boolean {
        if (!this.adjacencyList.has(startNode) || !this.adjacencyList.has(targetNode)) {
            return false;
        }
        return this.bfs(startNode, targetNode);
    }

    public isNodeInRelationship(node: string): boolean {
        return this.adjacencyList.has(node) && this.adjacencyList.get(node)!.size > 0;
    }

    private bfs(startNode: string, targetNode: string): boolean {
        const queue: string[] = [startNode];
        const visited: Set<string> = new Set();

        while (queue.length > 0) {
            const node = queue.shift()!;
            if (node === targetNode) return true;
            visited.add(node);

            for (const neighbor of this.adjacencyList.get(node) || []) {
                if (!visited.has(neighbor)) {
                    queue.push(neighbor);
                }
            }
        }
        return false;
    }

    public getRelatedNodes(node: string): string[] {
        return this.adjacencyList.has(node) ? Array.from(this.adjacencyList.get(node)!) : [];
    }

    public getRelatedRelationships(node: string): CalmRelationship[] {
        return this.relationships.filter(rel => {
            if (rel.relationshipType instanceof CalmInteractsType) {
                return rel.relationshipType.actor === node || rel.relationshipType.nodes.includes(node);
            } else if (rel.relationshipType instanceof CalmConnectsType) {
                return rel.relationshipType.source.node === node || rel.relationshipType.destination.node === node;
            } else if (rel.relationshipType instanceof CalmDeployedInType) {
                return rel.relationshipType.container === node || rel.relationshipType.nodes.includes(node);
            } else if (rel.relationshipType instanceof CalmComposedOfType) {
                return rel.relationshipType.container === node || rel.relationshipType.nodes.includes(node);
            }
            return false;
        });
    }
}
