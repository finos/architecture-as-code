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

// const groups: string[] = [];

function createConnectsRelationship(instance: BrowserJsPlumbInstance, relationships: CALMConnectsRelationship[]) {
    relationships.map(
            relationship =>{
                const connects  = relationship["relationship-type"]["connects"];
                instance.connect({
                    source: document.getElementById(connects.source.node)!,
                    target: document.getElementById(connects.destination.node)!,
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
        );
    }

    function createInteractsRelationship(instance: BrowserJsPlumbInstance, relationships: CALMInteractsRelationship[]) {
        relationships.map(relationship => {
            const interacts = relationship["relationship-type"]["interacts"];
            interacts.nodes.forEach(node => {
                instance.connect({
                    source: document.getElementById(interacts.actor)!,
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
                    overlays:[ 
                        { type:"Arrow", options:{location:1}}
                    ]
                });
            })
        })
    }

function getUniqueCALMDeployedInContainers(relationships : CALMDeployedInRelationship[]){
    const deployedInContainers : string[] =  relationships.map(relationship=> relationship["relationship-type"]["deployed-in"].container);
    return Array.from(new Set(deployedInContainers));
}

function createGroups({instance, containers}:{instance: BrowserJsPlumbInstance, containers: string[]}){
    containers.forEach(container =>{
        instance.addGroup({
            el: document.getElementById(container)!,
            id: container,
            anchor:"Continuous",
            endpoint:{ type:"Dot", options:{ radius:3 } },
            dropOverride:true
        })   
    })

}

function createDeployedInRelationship( instance: BrowserJsPlumbInstance , relationships: CALMDeployedInRelationship[] ) {
    const containers = getUniqueCALMDeployedInContainers(relationships)
    createGroups({instance, containers}); 
    relationships.map(relationship => {
        const container = relationship["relationship-type"]["deployed-in"].container
        const nodes = relationship["relationship-type"]["deployed-in"].nodes
        if ( instance.getGroup(container).id === container){
            nodes.forEach(node => {
                instance.addToGroup(container, document.getElementById(node)!)
            })
        }
    })
}

function getUniqueCALMComposedOfContainers(relationships : CALMComposedOfRelationship[]){
    const composedOfContainers : string[] =  relationships.map(relationship=> relationship["relationship-type"]["composed-of"].container);
    return Array.from(new Set(composedOfContainers));
}

function createComposedOfRelationship( instance: BrowserJsPlumbInstance , relationships: CALMComposedOfRelationship[] ) {
    const containers =  getUniqueCALMComposedOfContainers(relationships)
    createGroups({instance, containers}); 
    relationships.map(relationship => {
        const container = relationship["relationship-type"]["composed-of"].container
        const nodes = relationship["relationship-type"]["composed-of"].nodes
        if ( instance.getGroup(container).id === container){
            nodes.forEach(node => {
                instance.addToGroup(container, document.getElementById(node)!)
            })
        }
    })
}

function createGraphRelationship(instance: BrowserJsPlumbInstance, relationships: CALMRelationship[]) {
    const filterDeployedIn : CALMDeployedInRelationship[] = relationships.filter(relationship => 'deployed-in' in relationship["relationship-type"]).map(relationship => relationship as CALMDeployedInRelationship);
    const filterComposedOf = relationships.filter(relationship => 'composed-of' in relationship["relationship-type"]).map(relationship => relationship as CALMComposedOfRelationship);
    const filterConnect = relationships.filter(relationship => 'connects' in relationship["relationship-type"]).map(relationship => relationship as CALMConnectsRelationship)
    const filterInteracts = relationships.filter(relationship => 'interacts' in relationship["relationship-type"]).map(relationship => relationship as CALMInteractsRelationship)

    createConnectsRelationship(instance, filterConnect);

    createInteractsRelationship(instance, filterInteracts);

    createDeployedInRelationship(instance, filterDeployedIn);

    createComposedOfRelationship(instance, filterComposedOf); 
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