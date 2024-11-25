import './cytoscape.css'
import React, { useEffect, useRef, useState } from 'react'
import cytoscape, { Core } from 'cytoscape'
import nodeHtmlLabel from 'cytoscape-node-html-label'
import coseBilkent from 'cytoscape-cose-bilkent'
import expandCollapse from 'cytoscape-expand-collapse'
import cytoscapePopper, { RefElement } from 'cytoscape-popper'
import tippy from 'tippy.js'
import Sidebar from '../sidebar/Sidebar'

//Make some information available on tooltip hover

nodeHtmlLabel(cytoscape)
expandCollapse(cytoscape)

cytoscape.use(coseBilkent)

const layoutOptions = {
    name: 'cose-bilkent',
    randomize: false,
    fit: true,
    padding: 50,
    nodeDimensionsIncludeLabels: true,
    nodeRepulsion: 10000,
    idealEdgeLength: 200,
    edgeElasticity: 0.1,
    gravity: 0.25,
    numIter: 2500,
    tile: true,
    tilingPaddingVertical: 50,
    tilingPaddingHorizontal: 50,
    animate: false,
    gravityRangeCompound: 1.5,
    gravityCompound: 1.0,
    gravityRange: 3.8,
}

function tippyFactory(ref: RefElement, content: HTMLElement) {
    // Since tippy constructor requires DOM element/elements, create a placeholder
    var dummyDomEle = document.createElement('div')

    var tip = tippy(dummyDomEle, {
        getReferenceClientRect: ref.getBoundingClientRect,
        trigger: 'manual', // mandatory
        // dom element inside the tippy:
        content: content,
        // your own preferences:
        arrow: true,
        placement: 'bottom',
        hideOnClick: false,
        sticky: 'reference',
        // if interactive:
        interactive: true,
        appendTo: document.body, // or append dummyDomEle to document.body
    })

    return tip
}

cytoscape.use(cytoscapePopper(tippyFactory))

export type Node = {
    classes?: string
    data: {
        label: string
        id: string
        [idx: string]: string
    }
}

export type Edge = {
    data: {
        label: string
        source: string
        target: string
        [idx: string]: string
    }
}

interface Props {
    nodes: Node[] | undefined
    edges: Edge[] | undefined
}

const CytoscapeRenderer = ({ nodes = [], edges = [] }: Props) => {
    const cyRef = useRef<HTMLDivElement>(null)
    const [cy, setCy] = useState<any | null>(null)
    const [selectedNode, setSelectedNode] = useState<Node['data'] | null>(null)

    useEffect(() => {
        if (cy) {
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
    }, [cy])

    useEffect(() => {
        // Destroy previous Cytoscape instance to avoid memory leaks
        /*if (cyRef.current) {
            cyRef.current.destroy();
        }*/

        // Initialize Cytoscape instance
        const container = cyRef.current

        if (!container) return

        const cyInstance: any = cytoscape({
            container: container, // container to render
            elements: [...nodes, ...edges], // graph data
            style: [
                {
                    selector: 'node',
                    style: {
                        width: '200px',
                        height: '100px',
                        shape: 'rectangle',
                    },
                },
                {
                    selector: 'edge',
                    style: {
                        width: 2,
                        'curve-style': 'bezier',
                        label: 'data(label)', // labels from data property
                        'target-arrow-shape': 'triangle',
                        //'text-wrap': 'ellipsis',
                        //"text-max-width": '100px'
                    },
                },
                {
                    selector: ':parent',
                    style: {
                        label: 'data(label)',
                    },
                },
            ],
            layout: layoutOptions,
            /*ready: function(this) {
                            this.expandCollapse({

                            })
                        }*/
        })

        cyInstance.nodeHtmlLabel([
            {
                query: 'node',
                halign: 'center',
                valign: 'center',
                halignBox: 'center',
                valignBox: 'center',
                tpl: (data: Node['data']) => {
                    return `<div class="node element">
  <p class="title">${data.label}</p>
  <p class="type">[database]</p>
</div>`
                },
            },
        ])

        cyInstance.on('tap', 'node', (e: any) => {
            e.preventDefault()
            const node = e.target
            setSelectedNode(node.data()) // Update state with the clicked node's data
        })
        setCy(cyInstance)

        return () => {
            cyInstance.destroy()
        }
        // } else {
        //     cy.json({ elements: [...nodes, ...edges] })
        //     cy.layout({ name: 'cose-bilkent' }).run()
        // }
    }, [nodes, edges]) // Re-render on cy, nodes or edges change

    return (
        <div className="relative flex h-screen w-full">
            <div
                ref={cyRef}
                className="flex-1 bg-white"
                style={{
                    height: '100vh',
                }}
            />

            {selectedNode && (
                <div className="absolute right-0 top-0 h-full">
                    <Sidebar
                        selectedNode={selectedNode}
                        closeSidebar={() => setSelectedNode(null)}
                    />
                </div>
            )}
        </div>
    )
}

export default CytoscapeRenderer
