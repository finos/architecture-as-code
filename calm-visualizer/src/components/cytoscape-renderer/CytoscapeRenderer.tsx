import './cytoscape.css';
import React, {useEffect, useRef, useState} from 'react';
import cytoscape, {Core} from 'cytoscape';
import nodeHtmlLabel from 'cytoscape-node-html-label';

nodeHtmlLabel(cytoscape)

export type Node = {
    data: {
        label: string;
        id: string;
        [idx: string]: string;
    }
}

export type Edge = {
    data: {
        label: string
        source: string;
        target: string;
        [idx: string]: string;
    };

}

interface Props {
    nodes: Node[];
    edges: Edge[];
}

const CytoscapeRenderer = ({ nodes = [], edges = [] }: Props) => {
    const cyRef = useRef(null);
    const [cy, setCy] = useState<Core | null>(null);

    useEffect(() => {
        if(cy) {
            cy.nodeHtmlLabel([
                {
                    query:  '.node',
                    halign: 'center',
                    valign: 'center',
                    halignBox:  'center',
                    valignBox: 'center',
                    tpl: (data: Node["data"]) => {
                        return `<div class="node">
  <p class="title">${data.label}</p>
  <p class="type">[database]</p>
  <p class="description">Database which stores account, trade and position state</p>
</div>`
                    }
                }
            ])
        }
    }, [cy]);

    useEffect(() => {
        // Destroy previous Cytoscape instance to avoid memory leaks
        /*if (cyRef.current) {
            cyRef.current.destroy();
        }*/

        // Initialize Cytoscape instance
        const container = cyRef.current;

        setCy(cytoscape({
            container: container, // container to render
            elements: [...nodes, ...edges], // graph data
            style: [
                {
                    selector: 'node',
                    style: {
                        opacity: 0,
                        width: "mapData (degree, 0, 10, 5,  20)",
                        height: "mapData (degree, 0  10, 5,  20)",
                        shape:  "rectangle"
                        /*'background-color': 'white',
                        'label': 'data(label)', // labels from data property
                        'color': 'black',
                        'text-valign': 'center',

                        width: '200px',
                        "border-style": "solid",
                        "border-color": "black",
                        "border-width": "2px"*/
                    },
                },
                {
                    selector: 'edge',
                    style: {
                        'width': 2,
                        'curve-style': 'bezier',
                        'label':  'data(label)', // labels from data property
                        'target-arrow-shape': 'triangle',
                    },
                },
            ],
            layout: {
                name: 'grid', // Use grid layout for simplicity
            },
        }));

        /*return () => {
            if (cyRef.current) {
                cyRef.current.destroy();
            }
        };*/
    }, [nodes, edges]); // Re-render on nodes or edges change

    return <div ref={cyRef} style={{ width: '90%', height: '1000px', backgroundColor: "white" }} />;
};

export default CytoscapeRenderer;
