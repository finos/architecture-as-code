import './cytoscape.css'
import { useEffect, useRef, useState } from 'react'
import cytoscape, { Core } from 'cytoscape'
import nodeHtmlLabel from 'cytoscape-node-html-label'
import coseBilkent from 'cytoscape-cose-bilkent'
import Sidebar from '../sidebar/Sidebar'

nodeHtmlLabel(cytoscape)

cytoscape.use(coseBilkent)

export type Node = {
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
    nodes: Node[]
    edges: Edge[]
}

const CytoscapeRenderer = ({ nodes = [], edges = [] }: Props) => {
    const cyRef = useRef<HTMLDivElement>(null)
    const [cy, setCy] = useState<Core | null>(null)
    const [selectedNode, setSelectedNode] = useState<Node['data'] | null>(null)

    useEffect(() => {
        // if (!cy) {
        // Initialize Cytoscape instance
        const container = cyRef.current

        if (!container) return

        const cyInstance = cytoscape({
            container: container, // container to render
            elements: [...nodes, ...edges], // graph data
            style: [
                {
                    selector: 'node',
                    style: {
                        width: '200px',
                        height: '200px',
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
            ],
            layout: {
                name: 'cose-bilkent', // Use grid layout for simplicity
            },
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
  <p class="description">Database which stores account, trade and position state</p>
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
