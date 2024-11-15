import Sidebar from '../sidebar/Sidebar'
import { BrowserJsPlumbInstance, newInstance } from '@jsplumb/browser-ui'
import saveAs from 'file-saver'
import { useEffect, useState } from 'react'
import { NodeLayout, RelationshipLayout } from '../../layout'
import { CALMNode } from '../../types'
import FileUploader from '../fileuploader/FileUploader'
import Graph from '../graph/Graph'

interface LayoutObject {
    'unique-id': string
    x: number
    y: number
}

function Drawer() {
    const [nodes, setNodes] = useState<NodeLayout[]>([])
    const [relationships, setRelationships] = useState<RelationshipLayout[]>([])
    const [instance, setInstance] = useState<BrowserJsPlumbInstance>()
    const [title, setTitle] = useState('Architecture as Code')
    const [selectedNode, setSelectedNode] = useState(null)

    const closeSidebar = () => {
        setSelectedNode(null)
    }

    function enhanceNodesWithLayout(
        nodes: CALMNode[],
        coords: LayoutObject[]
    ): NodeLayout[] {
        return nodes.map((node) => {
            const coordObject = coords.find(
                (coord) => coord['unique-id'] == node['unique-id']
            )
            return {
                ...node,
                x: coordObject?.x || 400,
                y: coordObject?.y || 400,
            }
        })
    }

    async function handleFile(instanceFile: File, layoutFile?: File) {
        const instanceString = await instanceFile.text()
        const calmInstance = JSON.parse(instanceString)
        setTitle(instanceFile.name)

        const nodePositions: LayoutObject[] = []
        if (layoutFile) {
            const layoutString = await layoutFile.text()
            const layout = JSON.parse(layoutString)
            layout.nodes.forEach((node: LayoutObject) =>
                nodePositions.push(node)
            )
        }

        setNodes(enhanceNodesWithLayout(calmInstance.nodes, nodePositions))
        setRelationships(calmInstance.relationships)
    }

    function onSave() {
        const outputNodes = nodes.map((node) => {
            const bounds = document
                .getElementById(node['unique-id'])
                ?.getBoundingClientRect()

            return {
                'unique-id': node['unique-id'],
                x: bounds?.x,
                y: bounds?.y,
            }
        })

        const output = JSON.stringify({
            nodes: outputNodes,
            relationships,
        })

        const blob = new Blob([output], { type: 'text/plain;charset=utf-8' })
        saveAs(blob, 'layout.json')
    }

    useEffect(() => {
        setInstance(
            newInstance({
                container: document.getElementById('app')!,
            })
        )
    }, [])

    return (
        <>
            <div
                className={`drawer drawer-end ${selectedNode ? 'drawer-open' : ''}`}
            >
                <input
                    type="checkbox"
                    className="drawer-toggle"
                    checked={!!selectedNode}
                    onChange={closeSidebar}
                />
                <div className="drawer-content">
                    <div className="text-xl font-bold">{title}</div>
                    <FileUploader callback={handleFile} />
                    <button className="btn" onClick={onSave}>
                        SaveAs
                    </button>
                    <div id="app">
                        {instance && (
                            <Graph
                                instance={instance}
                                nodes={nodes}
                                relationships={relationships}
                                setSelectedNode={setSelectedNode}
                            />
                        )}
                    </div>
                </div>
                {selectedNode && (
                    <Sidebar
                        selectedNode={selectedNode}
                        closeSidebar={closeSidebar}
                    />
                )}
            </div>
        </>
    )
}

export default Drawer
