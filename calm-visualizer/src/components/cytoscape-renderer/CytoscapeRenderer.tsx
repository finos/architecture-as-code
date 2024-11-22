import './cytoscape.css';
import React, {useEffect, useRef, useState} from 'react';
import cytoscape, {Core, EdgeSingular, EdgeSingularTraversing} from 'cytoscape';
import nodeHtmlLabel from 'cytoscape-node-html-label';
import coseBilkent from 'cytoscape-cose-bilkent';
import expandCollapse from 'cytoscape-expand-collapse';
import popper, { RefElement } from 'cytoscape-popper';
import tippy from 'tippy.js';
import cytoscapePopper from 'cytoscape-popper';

//Make some information available on tooltip hover

nodeHtmlLabel(cytoscape);
expandCollapse(cytoscape);

cytoscape.use(coseBilkent);

const layoutOptions  = {
    name: 'cose-bilkent',

}

function tippyFactory(ref: RefElement, content: HTMLElement){
    // Since tippy constructor requires DOM element/elements, create a placeholder
    var dummyDomEle = document.createElement('div');
 
    var tip = tippy( dummyDomEle, {
        getReferenceClientRect: ref.getBoundingClientRect,
        trigger: 'manual', // mandatory
        // dom element inside the tippy:
        content: content,
        // your own preferences:
        arrow: true,
        placement: 'bottom',
        hideOnClick: false,
        sticky: "reference",
 
        // if interactive:
        interactive: true,
        appendTo: document.body // or append dummyDomEle to document.body
    } );
 
    return tip;
 }

cytoscape.use(cytoscapePopper(tippyFactory))

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
            //EVENT LISTENING FOR TOOLTIP
            // cy.on('mouseover', 'edge', (event) => {
            //     const edge = event.target
            //     edge.tippy = edge.popper({
            //         content: () => {
            //            let content = document.createElement('div');
                 
            //            content.innerHTML = edge.data('label');
            //            content.className = 'edge-tooltip'
                 
            //            return content;
            //         },
            //      });

            //     edge.tippy.show();
            // })

            // cy.on('mouseout', 'edge', (event) => {
            //     const edge = event.target

            //     edge.tippy.hide(0);
            // })
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
                        //'text-wrap': 'ellipsis',
                        //"text-max-width": '100px'
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
