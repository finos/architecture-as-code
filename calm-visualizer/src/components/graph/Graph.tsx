import { useEffect } from "react";
import './Graph.css'
import { BrowserJsPlumbInstance } from "@jsplumb/browser-ui"
import { NodeLayout, RelationshipLayout } from "../../layout";
import { CALMComposedOfRelationship, CALMConnectsRelationship, CALMDeployedInRelationship, CALMInteractsRelationship, CALMRelationship } from "../../types";

interface Props {
    instance: BrowserJsPlumbInstance,
    nodes: NodeLayout[],
    relationships: RelationshipLayout[]
}

function createConnectsRelationship(instance: BrowserJsPlumbInstance, relationship: CALMConnectsRelationship) {
    const r = relationship["relationship-type"]["connects"];
    instance.connect({
        source: document.getElementById(r.source.node)!,
        target: document.getElementById(r.destination.node)!,
        anchor: "Continuous",
        connector: {
            type: "Straight",
            options: {
                "stub": 25
            }
        },
        endpoint: {
            type: "Blank",
            options: {}
        },
        overlays: [
            { type: "Arrow", options: { location: 1 }},
            { type: "Label", options: { location: [ 0.5, 0.5 ], label:relationship.description, cssClass: 'graph-labels' }}
        ]
    });
}

function createInteractsRelationship(instance: BrowserJsPlumbInstance, relationship: CALMInteractsRelationship) {
    const r = relationship["relationship-type"]["interacts"];
    r.nodes.forEach(node => {
        instance.connect({
            source: document.getElementById(r.actor)!,
            target: document.getElementById(node)!,
            anchor: "Continuous",
            connector: {
                type: "Straight",
                options: {
                    "stub": 25
                }
            },
            endpoint: {
                type: "Blank",
                options: {
                }
            },
            overlays: [
                { type: "Arrow", options: { location: 1 }},
                { type: "Label", options: { location: [ 0.5, 0.5 ], label:relationship.description, cssClass: 'graph-labels' }}

            ]
        });
    })
}

function getUniqueCALMContainers(relationships: CALMRelationship[]) {
    const deployedInContainers: string[] = relationships.filter(relationship => 'deployed-in' in relationship["relationship-type"])
        .map(r => r as CALMDeployedInRelationship)
        .map(r => r["relationship-type"]["deployed-in"].container);

    const composedOfContainers: string[] = relationships.filter(relationship => 'composed-of' in relationship["relationship-type"])
        .map(r => r as CALMComposedOfRelationship)
        .map(r => r["relationship-type"]["composed-of"].container);

    const containers = [...deployedInContainers, ...composedOfContainers]
    return Array.from(new Set(containers));
}

function createGroups(instance: BrowserJsPlumbInstance, containers: string[]) {
    containers.forEach(container => {
        instance.addGroup({
            el: document.getElementById(container)!,
            id: container,
            anchor: "Continuous",
            endpoint: { type: "Dot", options: { radius: 3 } },
            dropOverride: true
        })
    })

}

function createDeployedInRelationship(instance: BrowserJsPlumbInstance, relationship: CALMDeployedInRelationship) {
    const container = relationship["relationship-type"]["deployed-in"].container
    const nodes = relationship["relationship-type"]["deployed-in"].nodes
    if (instance.getGroup(container).id === container) {
        nodes.forEach(node => {
            instance.addToGroup(container, document.getElementById(node)!)
        })
    }
}

function createComposedOfRelationship(instance: BrowserJsPlumbInstance, relationship: CALMComposedOfRelationship) {
    const container = relationship["relationship-type"]["composed-of"].container
    const nodes = relationship["relationship-type"]["composed-of"].nodes
    if (instance.getGroup(container).id === container) {
        nodes.forEach(node => {
            instance.addToGroup(container, document.getElementById(node)!)
        })
    }
}

function createGraphRelationship(instance: BrowserJsPlumbInstance, relationships: CALMRelationship[]) {
    const deployedInandComposedOfRelationships = relationships.filter(relationship => 'deployed-in' in relationship["relationship-type"]
        || 'composed-of' in relationship["relationship-type"]);

    const containers = getUniqueCALMContainers(deployedInandComposedOfRelationships);
    createGroups(instance, containers)

    relationships.forEach(relationship => {
        if ("connects" in relationship["relationship-type"]) {
            createConnectsRelationship(instance, relationship as CALMConnectsRelationship);
        } else if ("interacts" in relationship["relationship-type"]) {
            createInteractsRelationship(instance, relationship as CALMInteractsRelationship);
        } else if ("deployed-in" in relationship["relationship-type"]) {
            createDeployedInRelationship(instance, relationship as CALMDeployedInRelationship)
        } else {
            createComposedOfRelationship(instance, relationship as CALMComposedOfRelationship)
        }
    })
}

function Graph({ instance, nodes, relationships }: Props) {
    useEffect(() => {
        createGraphRelationship(instance, relationships);

        nodes.forEach(node => {
            instance.manage(document.getElementById(node["unique-id"])!);
        });
    }, [nodes, relationships, instance]);

    return (
        <>
            {
                nodes.map(node => {
                    return <div
                        key={node["unique-id"]}
                        id={node["unique-id"]}
                        className="node"
                        style={{
                            left: node.x,
                            top: node.y
                        }}
                    >
                        <div><b>{node.name}</b></div>
                        <div className="node-type">[{node["node-type"]}]</div>
                        <br />
                        <div className="node-description">{node.description}</div>
                    </div>
                })
            }
        </>
    );
}

export default Graph