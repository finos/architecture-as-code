import './cytoscape.css'
import { useEffect, useRef, useState } from 'react'
import cytoscape, {Core, NodeSingular} from 'cytoscape'
import nodeHtmlLabel from 'cytoscape-node-html-label'
import coseBilkent from 'cytoscape-cose-bilkent'
import expandCollapse from 'cytoscape-expand-collapse'
import fcose from 'cytoscape-fcose';
import cytoscapePopper, { RefElement } from 'cytoscape-popper'
import tippy from 'tippy.js'
import Sidebar from '../sidebar/Sidebar'

//Make some information available on tooltip hover

nodeHtmlLabel(cytoscape)
expandCollapse(cytoscape)

cytoscape.use(fcose);
cytoscape.use(coseBilkent);

const fcoseLayoutOptions = {
    name: 'fcose'
}

const coseBilkentLayoutOptions = {
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
    let dummyDomEle = document.createElement('div')

    let tip = tippy(dummyDomEle, {
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
        id: string
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
    const [cy, setCy] = useState<Core | null>(null)
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

            //@ts-expect-error
            cy.nodeHtmlLabel([
                {
                    query: '.node',
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
                }
            ])

            cy.on('tap', 'node', (e: Event) => {
                e.preventDefault()
                const node = e.target as  unknown as  NodeSingular | null
                setSelectedNode(node?.data()) // Update state with the clicked node's data
            })

            return () => {
                cy.destroy()
            }
        }
    }, [cy])

    useEffect(() => {
        // Initialize Cytoscape instance
        const container = cyRef.current

        if (!container) return

        setCy(cytoscape({
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
                    },
                },
                {
                    selector: ':parent',
                    style: {
                        label: 'data(label)',
                    },
                },
            ],
            layout: fcoseLayoutOptions,
        }))

    }, [nodes, edges]) // Re-render on cy, nodes or edges change

    return (
        <div className="relative flex h-screen w-11/12 m-auto">
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
