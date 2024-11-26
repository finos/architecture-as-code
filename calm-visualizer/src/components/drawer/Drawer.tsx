import Sidebar from '../sidebar/Sidebar'
import saveAs from 'file-saver'
import { useState } from 'react'
import { NodeLayout, RelationshipLayout } from '../../layout'
import {
    CALMComposedOfRelationship,
    CALMConnectsRelationship,
    CALMDeployedInRelationship,
    CALMInstantiation,
    CALMInteractsRelationship,
    CALMNode,
} from '../../types'
import FileUploader from '../fileuploader/FileUploader'
import CytoscapeRenderer, {
    Edge,
    Node,
} from '../cytoscape-renderer/CytoscapeRenderer.tsx'

interface LayoutObject {
    'unique-id': string
    x: number
    y: number
}

const getComposedOfRelationships = (calmInstance: CALMInstantiation) => {
    const composedOfRelationships: {
        [idx: string]: {
            type: 'parent' | 'child'
            parent?: string
        }
    } = {}

    calmInstance.relationships
        .filter(
            (relationship) => 'composed-of' in relationship['relationship-type']
        )
        .map((r) => r as CALMComposedOfRelationship)
        .map((relationship) => {
            const rel = relationship['relationship-type']['composed-of']
            composedOfRelationships[rel['container']] = { type: 'parent' }
            rel['nodes'].forEach((node) => {
                composedOfRelationships[node] = {
                    type: 'child',
                    parent: rel['container'],
                }
            })
        })

    return composedOfRelationships
}

const getDeployedInRelationships = (calmInstance: CALMInstantiation) => {
    const deployedInRelationships: {
        [idx: string]: {
            type: 'parent' | 'child'
            parent?: string
        }
    } = {}

    calmInstance.relationships
        .filter(
            (relationship) => 'deployed-in' in relationship['relationship-type']
        )
        .map((r) => r as CALMDeployedInRelationship)
        .map((relationship) => {
            const rel = relationship['relationship-type']['deployed-in']
            console.log(rel)
            deployedInRelationships[rel['container']] = { type: 'parent' }
            rel['nodes'].forEach((node) => {
                deployedInRelationships[node] = {
                    type: 'child',
                    parent: rel['container'],
                }
            })
        })

    return deployedInRelationships
}

function Drawer() {
    const [nodes, setNodes] = useState<NodeLayout[]>([])
    const [relationships, setRelationships] = useState<RelationshipLayout[]>([])
    const [title, setTitle] = useState('Architecture as Code')
    const [selectedNode, setSelectedNode] = useState(null)
    const [calmInstance, setCALMInstance] = useState(null)
    const [cyNodes, setCyNodes] = useState<Node[] | undefined>()
    const [cyEdges, setCyEdges] = useState<Edge[] | undefined>()

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

    const getData = (calmInstance: CALMInstantiation) => {
        const composedOfRelationships = getComposedOfRelationships(calmInstance)
        const deployedInRelationships = getDeployedInRelationships(calmInstance)

        const nodes = calmInstance.nodes.map((node) => {
            const newData: Node = {
                classes: 'node',
                data: {
                    classes: 'node',
                    label: node.name,
                    description: node.description,
                    type: node['node-type'],
                    id: node['unique-id'],
                },
            }

            if (composedOfRelationships[node['unique-id']]?.type === 'parent') {
                newData.classes = 'group'
            }

            if (
                composedOfRelationships[node['unique-id']]?.type === 'child' &&
                composedOfRelationships[node['unique-id']]['parent']
            ) {
                newData.data.parent =
                    composedOfRelationships[node['unique-id']].parent!
            }

            if (deployedInRelationships[node['unique-id']]?.type === 'parent') {
                newData.classes = 'group'
            }

            if (
                deployedInRelationships[node['unique-id']]?.type === 'child' &&
                deployedInRelationships[node['unique-id']]['parent'] &&
                !newData.data.parent
            ) {
                newData.data.parent =
                    deployedInRelationships[node['unique-id']].parent!
            }
            return newData
        })

        const connectsRelationships = calmInstance.relationships
            .filter(
                (relationship) =>
                    'connects' in relationship['relationship-type']
            )
            .map((r) => r as CALMConnectsRelationship)
            .map((relationship) => {
                if (
                    'connects' in relationship['relationship-type'] &&
                    relationship['unique-id'] &&
                    relationship.description &&
                    relationship['relationship-type'].connects.source.node &&
                    relationship['relationship-type'].connects.destination.node
                ) {
                    const source =
                        relationship['relationship-type'].connects.source.node
                    const target =
                        relationship['relationship-type'].connects.destination
                            .node
                    return {
                        data: {
                            id: relationship['unique-id'],
                            label: relationship.description,
                            source,
                            target,
                            smooth: {
                                enabled: true,
                                type: 'curvedCW',
                                roundness: 0.1,
                            },
                        },
                    }
                }
            })
            .filter((relationship) => relationship != undefined)

        const interactsRelationship = calmInstance.relationships
            .filter(
                (relationship) =>
                    'interacts' in relationship['relationship-type']
            )
            .map((r) => r as CALMInteractsRelationship)
            .map((relationship) => {
                if (
                    'interacts' in relationship['relationship-type'] &&
                    relationship['unique-id'] &&
                    relationship.description
                ) {
                    return {
                        data: {
                            id: relationship['unique-id'],
                            label: relationship.description,
                            source: relationship['relationship-type'].interacts
                                .actor,
                            target: relationship['relationship-type'].interacts
                                .nodes[0],
                            smooth: {
                                enabled: true,
                                type: 'curvedCW',
                                roundness: 0.1,
                            },
                        },
                    }
                }
            })
            .filter((relationship) => relationship != undefined)

        setCyNodes(nodes)
        setCyEdges([...interactsRelationship, ...connectsRelationships])
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

        setCALMInstance(calmInstance)
        getData(calmInstance)
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
                        {calmInstance && (
                            <CytoscapeRenderer
                                nodes={cyNodes}
                                edges={cyEdges}
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
