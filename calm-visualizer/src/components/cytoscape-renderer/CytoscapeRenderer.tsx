import './cytoscape.css';
import React, {useEffect, useRef, useState} from 'react';
import cytoscape, {Core} from 'cytoscape';
import nodeHtmlLabel from 'cytoscape-node-html-label';
import coseBilkent from 'cytoscape-cose-bilkent';
import expandCollapse from 'cytoscape-expand-collapse';

//Make some information available on tooltip hover

nodeHtmlLabel(cytoscape);
expandCollapse(cytoscape);

cytoscape.use(coseBilkent);

const layoutOptions  = {
    name: 'cose-bilkent',

}

export type Node = {
    classes?: string;
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
                        return `<div class="node element">
  <p class="title">${data.label}</p>
  <p class="type">[database]</p>
<!--  <p class="description">Database which stores account, trade and position state</p>-->
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
                        width: "200px",
                        height: "100px",
                        shape:  "rectangle",
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
                {
                    selector: ":parent",
                    style: {
                        "label": "data(label)"
                    }
                }
            ],
            layout: {
                name: 'cose-bilkent', // Use grid layout for simplicity
            },
            /*ready: function(this) {
                this.expandCollapse({

                })
            }*/
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
