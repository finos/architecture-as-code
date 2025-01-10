import { useEffect } from "react";
import './Graph.css'
import { BrowserJsPlumbInstance } from "@jsplumb/browser-ui"
import { NodeLayout, RelationshipLayout } from "../../layout";
import { CALMConnectsRelationship, CALMInteractsRelationship, CALMRelationship } from "../../types";

interface Props {
    instance: BrowserJsPlumbInstance,
    nodes: NodeLayout[],
    relationships: RelationshipLayout[]
}

// const groups: string[] = [];

function createConnectsRelationship(instance: BrowserJsPlumbInstance, relationship: CALMConnectsRelationship) {
    const r = relationship["relationship-type"]["connects"];
    instance.connect({
        source: document.getElementById(r.source.node)!,
        target: document.getElementById(r.destination.node)!,
        anchor: "Continuous",
        connector: {
            type:"Straight",
            options: {
                "stub": 25
            }
        },
        endpoint: {
            type: "Blank",
            options: {}
        },
        overlays: [
            { type:"Arrow", options:{location:1}}
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
                type:"Straight",
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
                { type:"Arrow", options:{location:1}}
            ]
        });
    })
}

// function createDeployedInRelationship(instance: BrowserJsPlumbInstance, relationship: CALMDeployedInRelationship) {
//     const r = relationship["relationship-type"]["deployed-in"];
//     if (!groups.find(group => group === r.container)) {
//         groups.push(r.container);
//         instance.addGroup({
//             el: document.getElementById(r.container)!,
//             id: r.container,
//         });
//     }

//     r.nodes.forEach(node => {
//         instance.addToGroup(r.container, document.getElementById(node)!)
//     });
// }

function createGraphRelationship(instance: BrowserJsPlumbInstance, relationship: CALMRelationship) {
    if ("connects" in relationship["relationship-type"]) {
        createConnectsRelationship(instance, relationship as CALMConnectsRelationship);
    } else if ("interacts" in relationship["relationship-type"]) {
        createInteractsRelationship(instance, relationship as CALMInteractsRelationship);
    } else if ("deployed-in" in relationship["relationship-type"]) {
        // createDeployedInRelationship(instance, relationship as CALMDeployedInRelationship);
        // TODO: Fix the "deployed-in" relationship and add "contains" relationship
    }
}

function Graph({ instance, nodes, relationships }: Props) {
    useEffect(() => {
        relationships.map(relationship => {
            createGraphRelationship(instance, relationship);
        });

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
