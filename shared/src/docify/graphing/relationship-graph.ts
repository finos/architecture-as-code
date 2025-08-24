import {
    CalmRelationship,
    CalmInteractsType,
    CalmConnectsType,
    CalmDeployedInType,
    CalmComposedOfType
} from '@finos/calm-models/model';

export class CalmRelationshipGraph {
    private adjacencyList: Map<string, Set<string>> = new Map();
    private relationships: CalmRelationship[];

    constructor(relationships: CalmRelationship[]) {
        this.buildGraph(relationships);
        this.relationships = relationships;
    }

    private buildGraph(relationships: CalmRelationship[]) {
        relationships.forEach(rel => {
            const relType = rel.relationshipType;

            switch (relType.kind) {
            case 'interacts': {
                const t = relType as CalmInteractsType;
                this.addEdge(t.actor, t.nodes);
                break;
            }
            case 'connects': {
                const t = relType as CalmConnectsType;
                this.addEdge(t.source.node, [t.destination.node]);
                break;
            }
            case 'deployed-in': {
                const t = relType as CalmDeployedInType;
                this.addEdge(t.container, t.nodes);
                break;
            }
            case 'composed-of': {
                const t = relType as CalmComposedOfType;
                this.addEdge(t.container, t.nodes);
                break;
            }
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
            this.adjacencyList.get(dest)!.add(source); // bidirectional
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
            const relType = rel.relationshipType;

            switch (relType.kind) {
            case 'interacts': {
                const t = relType as CalmInteractsType;
                return t.actor === node || t.nodes.includes(node);
            }
            case 'connects': {
                const t = relType as CalmConnectsType;
                return t.source.node === node || t.destination.node === node;
            }
            case 'deployed-in':
            case 'composed-of': {
                const t = relType as CalmDeployedInType | CalmComposedOfType;
                return t.container === node || t.nodes.includes(node);
            }
            default:
                return false;
            }
        });
    }
}
