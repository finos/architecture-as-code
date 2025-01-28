import { BaseCalmVisitor, CalmNode, CalmInteractsRelationship, CalmConnectsRelationship, parse } from "../../../../shared/src/model";
import { CalmComposedOfRelationship, CalmDeployedInRelationship } from "../../../../shared/src/model/model";
import { Edge, Node } from "../cytoscape-renderer/CytoscapeRenderer";


export class CalmVisualizationVisitor extends BaseCalmVisitor {
    private nodes: Node[] = [];
    private edges: Edge[] = [];

    // The Keys of this object are the ID's of the nodes to go inside the value
    private groups = new Map<string, string[]>([]);

    constructor(calm: string) {
        super();
        parse(calm).forEach(item => item.accept(this));
    }

    public visitCalmNode(element: CalmNode): void {
        this.nodes.push({
            classes: 'node',
            data: {
                id: element.uniqueId,
                label: element.name,
                description: element.description,
                type: element.type
            }
        });
    }

    public visitCalmComposedOfRelationship(element: CalmComposedOfRelationship): void {
        element.nodes.forEach(node => {
            if (this.groups.has(node)) {
                this.groups.get(node)!.push(element.container);
            }
            this.groups.set(node, [element.container]);
        });
    }

    public visitCalmDeployedInRelationship(element: CalmDeployedInRelationship): void {
        element.nodes.forEach(node => {
            if (this.groups.has(node)) {
                this.groups.get(node)!.push(element.container);
            }
            this.groups.set(node, [element.container]);
        });
    }

    public visitCalmInteractsRelationship(element: CalmInteractsRelationship): void {
        element.nodes.forEach(node => {
            this.edges.push({
                data: {
                    id: element.uniqueId, // same unique ID for each line?
                    label: element.description,
                    source: element.actor,
                    target: node
                }
            });
        });
    }

    public visitCalmConnectsRelationship(element: CalmConnectsRelationship): void {
        this.edges.push({
            data: {
                id: element.uniqueId,
                label: element.description,
                source: element.source,
                target: element.target
            }
        });
    }

    public getNodes(): Node[] {
        return this.nodes;
    }

    public getEdges(): Edge[] {
        return this.edges;
    } 
}