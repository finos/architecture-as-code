import { ComposedOfRelationship, ConnectsRelationship, DeployedInRelationship, InteractsRelationship, Node, Relationship } from './Types';

export class MermaidBuilder {
    private nodes: string[] = [];
    private arrowRelationships: string[] = [];
    private subgraphRelationships: string[] = [];

    private styles: string[] = [];

    public addNode(node: Node): void {
        if (node['node-type'] === 'actor') {
            this.nodes.push(`${node['unique-id']}((${this.capitalizeFirstLetter(node['node-type'])}: ${node.name}))`);
        } else if (node['node-type'] === 'database') {
            this.nodes.push(`${node['unique-id']}[(${this.capitalizeFirstLetter(node['node-type'])}: ${node.name})]`);
        } else {
            this.nodes.push(`${node['unique-id']}[${this.capitalizeFirstLetter(node['node-type'])}: ${node.name}]`);
        }
    }

    private capitalizeFirstLetter(s: string): string {
        return s.charAt(0).toUpperCase() + s.slice(1);
    }

    public addRelationship(relationship: Relationship): void {
        if ('connects' in relationship['relationship-type']) {
            this.addConnectsRelationship(relationship as ConnectsRelationship);
        } else if ('interacts' in relationship['relationship-type']) {
            this.addInteractsRelationship(relationship as InteractsRelationship);
        } else if ('deployed-in' in relationship['relationship-type']) {
            this.addDeployedInRelationship(relationship as DeployedInRelationship);
        } else if ('composed-of' in relationship['relationship-type']) {
            this.addComposedOfRelationship(relationship as ComposedOfRelationship);
        }
    }

    private addConnectsRelationship(r: ConnectsRelationship): void {
        const parties = r['relationship-type']['connects'];
        const label = `connects ${r.protocol || ''} ${r.authentication || ''}`;

        this.arrowRelationships.push(`${parties.source} -->|${label}| ${parties.destination}`);
    }

    private addInteractsRelationship(r: InteractsRelationship): void {
        const parties = r['relationship-type']['interacts'];

        parties.nodes.map(nodeId => {
            this.arrowRelationships.push(`${parties.actor} -->|interacts| ${nodeId}`);
        });
    }

    private addDeployedInRelationship(r: DeployedInRelationship): void {
        const parties = r['relationship-type']['deployed-in'];

        this.subgraphRelationships.push(`
            subgraph ${parties.container} [${parties.container}]
                ${parties.nodes.join('\n')}
            end
        `);
        this.styles.push(`style ${parties.container} stroke-dasharray: 5 5`);
        this.styles.push(`style ${parties.container} fill: none`);
    }

    private addComposedOfRelationship(r: ComposedOfRelationship): void {
        const parties = r['relationship-type']['composed-of'];

        this.subgraphRelationships.push(`
            subgraph ${parties.container} [${parties.container}]
                ${parties.nodes.join('\n')}
            end
        `);
        this.styles.push(`style ${parties.container} stroke-dasharray: 5 5`);
        this.styles.push(`style ${parties.container} fill: none`);
    }

    public getMermaid(): string {
        return `
            flowchart LR
                ${this.nodes.join('\n')}

                ${this.arrowRelationships.join('\n')}

                ${this.subgraphRelationships.join('\n')}

                ${this.styles.join('\n')}
        `;
    }
}