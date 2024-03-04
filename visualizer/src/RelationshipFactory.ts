import * as joint from "@joint/core";
import { ComposedOfRelationship, ConnectsRelationship, DeployedInRelationship, InteractsRelationship } from './Types';

export class RelationshipFactory {
    constructor(private graph: joint.dia.Graph, private shapes: {[name: string]: joint.shapes.standard.Rectangle}) {}

    public createConnectsRelationship(relationship: ConnectsRelationship) {
        const link = new joint.shapes.standard.Link();
        link.appendLabel({
            attrs: {
                text: {
                    text: relationship.relationshipType + '\n[' + relationship.protocol + ']'
                }
            }
        });
    
        link.source(this.shapes[relationship.parties.source]);
        link.target(this.shapes[relationship.parties.destination]);
        link.addTo(this.graph);
    }
    
    public createDeployedInRelationship(relationship: DeployedInRelationship) {
        const target = this.shapes[relationship.parties.container]
    
        relationship.parties.nodes.map(source => {
            target.embed(this.shapes[source]);
            target.attributes.z = 1;
            this.shapes[source].attributes.z = 2;
        });
    }
    
    public createComposedOfRelationship(relationship: ComposedOfRelationship) {
        const source = this.shapes[relationship.parties.container]
    
        relationship.parties.nodes.map((target: string) => {
            const link = new joint.shapes.standard.Link();
            link.appendLabel({
                attrs: {
                    text: {
                        text: relationship.relationshipType
                    }
                }
            });
    
            link.source(source);
            link.target(this.shapes[target]);
            link.addTo(this.graph);
        });
    }
    
    public createInteractsRelationship(relationship: InteractsRelationship) {
        const source = this.shapes[relationship.parties.actor]
    
        relationship.parties.nodes.map(target => {
            const link = new joint.shapes.standard.Link();
            link.appendLabel({
                attrs: {
                    text: {
                        text: relationship.relationshipType
                    }
                }
            });
    
            link.source(source);
            link.target(this.shapes[target]);
            link.addTo(this.graph);
        });
    }
}
