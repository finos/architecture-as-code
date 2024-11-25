import Sidebar from '../sidebar/Sidebar'
import { BrowserJsPlumbInstance, newInstance } from '@jsplumb/browser-ui'
import saveAs from 'file-saver'
import { useEffect, useState } from 'react'
import { NodeLayout, RelationshipLayout } from '../../layout'
import { CALMNode } from '../../types'
import FileUploader from '../fileuploader/FileUploader'
import CytoscapeRenderer, {Edge, Node} from "../cytoscape-renderer/CytoscapeRenderer.tsx";

interface LayoutObject {
    'unique-id': string
    x: number
    y: number
}
const traderXJson = {
    "$schema": "https://calm.finos.org/draft/2024-10/meta/calm.json",
    "nodes": [
        {
            "unique-id": "traderx-system",
            "node-type": "system",
            "name": "TraderX",
            "description": "Simple Trading System"
        },
        {
            "unique-id": "traderx-trader",
            "node-type": "actor",
            "name": "Trader",
            "description": "Person who manages accounts and executes trades"
        },
        {
            "unique-id": "web-client",
            "node-type": "webclient",
            "name": "Web Client",
            "description": "Browser based web interface for TraderX",
            "data-classification": "Confidential",
            "run-as": "user"
        },
        {
            "unique-id": "web-gui-process",
            "node-type": "service",
            "name": "Web GUI",
            "description": "Allows employees to manage accounts and book trades",
            "data-classification": "Confidential",
            "run-as": "systemId"
        },
        {
            "unique-id": "position-service",
            "node-type": "service",
            "name": "Position Service",
            "description": "Server process which processes trading activity and updates positions",
            "data-classification": "Confidential",
            "run-as": "systemId"
        },
        {
            "unique-id": "traderx-db",
            "node-type": "database",
            "name": "TraderX DB",
            "description": "Database which stores account, trade and position state",
            "data-classification": "Confidential",
            "run-as": "systemId"
        },
        {
            "unique-id": "internal-bank-network",
            "node-type": "network",
            "name": "Bank ABC Internal Network",
            "description": "Internal network for Bank ABC",
            "instance": "Internal Network"
        },
        {
            "unique-id": "reference-data-service",
            "node-type": "service",
            "name": "Reference Data Service",
            "description": "Service which provides reference data",
            "data-classification": "Confidential",
            "run-as": "systemId"
        },
        {
            "unique-id": "trading-services",
            "node-type": "service",
            "name": "Trading Services",
            "description": "Service which provides trading services",
            "data-classification": "Confidential",
            "run-as": "systemId"
        },
        {
            "unique-id": "trade-feed",
            "node-type": "service",
            "name": "Trade Feed",
            "description": "Message bus for streaming updates to trades and positions",
            "data-classification": "Confidential",
            "run-as": "systemId"
        },
        {
            "unique-id": "trade-processor",
            "node-type": "service",
            "name": "Trade Processor",
            "description": "Process incoming trade requests, settle and persist",
            "data-classification": "Confidential",
            "run-as": "systemId"
        },
        {
            "unique-id": "accounts-service",
            "node-type": "service",
            "name": "Accounts Service",
            "description": "Service which provides account management",
            "data-classification": "Confidential",
            "run-as": "systemId"
        },
        {
            "unique-id": "people-service",
            "node-type": "service",
            "name": "People Service",
            "description": "Service which provides user details management",
            "data-classification": "Confidential",
            "run-as": "systemId"
        },
        {
            "unique-id": "user-directory",
            "node-type": "ldap",
            "name": "User Directory",
            "description": "Golden source of user data",
            "data-classification": "PII",
            "run-as": "systemId"
        }
    ],
    "relationships": [
        {
            "unique-id": "trader-executes-trades",
            "description": "Executes Trades",
            "relationship-type": {
                "interacts": {
                    "actor": "traderx-trader",
                    "nodes": [
                        "web-client"
                    ]
                }
            }
        },
        {
            "unique-id": "trader-manages-accounts",
            "description": "Manage Accounts",
            "relationship-type": {
                "interacts": {
                    "actor": "traderx-trader",
                    "nodes": [
                        "web-client"
                    ]
                }
            }
        },
        {
            "unique-id": "trader-views-trade-status",
            "description": "View Trade Status / Positions",
            "relationship-type": {
                "interacts": {
                    "actor": "traderx-trader",
                    "nodes": [
                        "web-client"
                    ]
                }
            }
        },
        {
            "unique-id": "web-client-uses-web-gui",
            "description": "Web client interacts with the Web GUI process.",
            "relationship-type": {
                "connects": {
                    "source": {
                        "node": "web-client"
                    },
                    "destination": {
                        "node": "web-gui-process"
                    }
                }
            },
            "protocol": "HTTPS"
        },
        {
            "unique-id": "web-gui-uses-position-service-for-position-queries",
            "description": "Load positions for account.",
            "relationship-type": {
                "connects": {
                    "source": {
                        "node": "web-gui-process"
                    },
                    "destination": {
                        "node": "position-service"
                    }
                }
            },
            "protocol": "HTTPS"
        },
        {
            "unique-id": "web-gui-uses-position-service-for-trade-queries",
            "description": "Load trades for account.",
            "relationship-type": {
                "connects": {
                    "source": {
                        "node": "web-gui-process"
                    },
                    "destination": {
                        "node": "position-service"
                    }
                }
            },
            "protocol": "HTTPS"
        },
        {
            "unique-id": "position-service-uses-traderx-db-for-positions",
            "description": "Looks up default positions for a given account.",
            "relationship-type": {
                "connects": {
                    "source": {
                        "node": "position-service"
                    },
                    "destination": {
                        "node": "traderx-db"
                    }
                }
            },
            "protocol": "JDBC"
        },
        {
            "unique-id": "position-service-uses-traderx-db-for-trades",
            "description": "Looks up all trades for a given account.",
            "relationship-type": {
                "connects": {
                    "source": {
                        "node": "position-service"
                    },
                    "destination": {
                        "node": "traderx-db"
                    }
                }
            },
            "protocol": "JDBC"
        },
        {
            "unique-id": "traderx-system-is-deployed-in-internal-bank-network",
            "relationship-type": {
                "deployed-in": {
                    "container": "internal-bank-network",
                    "nodes": [
                        "traderx-system"
                    ]
                }
            }
        },
        {
            "unique-id": "traderx-system-is-composed-of",
            "relationship-type": {
                "composed-of": {
                    "container": "traderx-system",
                    "nodes": [
                        "web-client",
                        "web-gui-process",
                        "position-service",
                        "traderx-db",
                        "people-service",
                        "reference-data-service",
                        "trading-services",
                        "trade-feed",
                        "trade-processor",
                        "accounts-service"
                    ]
                }
            }
        },
        {
            "unique-id": "traderx-system-components-are-deployed-in-internal-bank-network",
            "relationship-type": {
                "deployed-in": {
                    "container": "internal-bank-network",
                    "nodes": [
                        "web-client",
                        "web-gui-process",
                        "position-service",
                        "traderx-db",
                        "people-service",
                        "reference-data-service",
                        "trading-services",
                        "trade-feed",
                        "trade-processor",
                        "accounts-service",
                        "user-directory"
                    ]
                }
            }
        },
        {
            "unique-id": "web-gui-process-uses-reference-data-service",
            "description": "Looks up securities to assist with creating a trade ticket.",
            "relationship-type": {
                "connects": {
                    "source": {
                        "node": "web-gui-process"
                    },
                    "destination": {
                        "node": "reference-data-service"
                    }
                }
            },
            "protocol": "HTTPS"
        },
        {
            "unique-id": "web-gui-process-uses-trading-services",
            "description": "Creates new trades and cancels existing trades.",
            "relationship-type": {
                "connects": {
                    "source": {
                        "node": "web-gui-process"
                    },
                    "destination": {
                        "node": "trading-services"
                    }
                }
            },
            "protocol": "HTTPS"
        },
        {
            "unique-id": "web-gui-process-uses-trade-feed",
            "description": "Subscribes to trade/position updates feed for currently viewed account.",
            "relationship-type": {
                "connects": {
                    "source": {
                        "node": "web-gui-process"
                    },
                    "destination": {
                        "node": "trade-feed"
                    }
                }
            },
            "protocol": "WebSocket"
        },
        {
            "unique-id": "trade-processor-connects-to-trade-feed",
            "description": "Processes incoming trade requests, persist and publish updates.",
            "relationship-type": {
                "connects": {
                    "source": {
                        "node": "trade-processor"
                    },
                    "destination": {
                        "node": "trade-feed"
                    }
                }
            },
            "protocol": "SocketIO"
        },
        {
            "unique-id": "trade-processor-connects-to-traderx-db",
            "description": "Looks up current positions when bootstrapping state, persist trade state and position state.",
            "relationship-type": {
                "connects": {
                    "source": {
                        "node": "trade-processor"
                    },
                    "destination": {
                        "node": "traderx-db"
                    }
                }
            },
            "protocol": "JDBC"
        },
        {
            "unique-id": "web-gui-process-uses-accounts-service",
            "description": "Creates/Updates accounts. Gets list of accounts.",
            "relationship-type": {
                "connects": {
                    "source": {
                        "node": "web-gui-process"
                    },
                    "destination": {
                        "node": "accounts-service"
                    }
                }
            },
            "protocol": "HTTPS"
        },
        {
            "unique-id": "web-gui-process-uses-people-service",
            "description": "Looks up people data based on typeahead from GUI.",
            "relationship-type": {
                "connects": {
                    "source": {
                        "node": "web-gui-process"
                    },
                    "destination": {
                        "node": "people-service"
                    }
                }
            },
            "protocol": "HTTPS"
        },
        {
            "unique-id": "people-service-connects-to-user-directory",
            "description": "Looks up people data.",
            "relationship-type": {
                "connects": {
                    "source": {
                        "node": "people-service"
                    },
                    "destination": {
                        "node": "user-directory"
                    }
                }
            },
            "protocol": "LDAP"
        },
        {
            "unique-id": "trading-services-connects-to-reference-data-service",
            "description": "Validates securities when creating trades.",
            "relationship-type": {
                "connects": {
                    "source": {
                        "node": "trading-services"
                    },
                    "destination": {
                        "node": "reference-data-service"
                    }
                }
            },
            "protocol": "HTTPS"
        },
        {
            "unique-id": "trading-services-uses-trade-feed",
            "description": "Publishes updates to trades and positions after persisting in the DB.",
            "relationship-type": {
                "connects": {
                    "source": {
                        "node": "trading-services"
                    },
                    "destination": {
                        "node": "trade-feed"
                    }
                }
            },
            "protocol": "HTTPS"
        },
        {
            "unique-id": "trading-services-uses-account-service",
            "description": "Validates accounts when creating trades.",
            "relationship-type": {
                "connects": {
                    "source": {
                        "node": "trading-services"
                    },
                    "destination": {
                        "node": "accounts-service"
                    }
                }
            },
            "protocol": "HTTPS"
        },
        {
            "unique-id": "accounts-service-uses-traderx-db-for-accounts",
            "description": "CRUD operations on account",
            "relationship-type": {
                "connects": {
                    "source": {
                        "node": "accounts-service"
                    },
                    "destination": {
                        "node": "traderx-db"
                    }
                }
            },
            "protocol": "JDBC"
        }
    ]
}

const getComposedOfRelationships = () => {
    const composedOfRelationships: {
        [idx: string]: {
            type: "parent" | "child";
            parent?: string;
        }
    } = {}

    traderXJson.relationships.forEach(relationship => {
        if (relationship["relationship-type"]["composed-of"]) {
            const rel = relationship["relationship-type"]["composed-of"];
            composedOfRelationships[rel["container"]] = {type: "parent"}
            rel["nodes"].forEach(node => {
                composedOfRelationships[node] = {
                    type: "child",
                    parent: rel["container"]
                }
            })
        }
    })

    return composedOfRelationships;
}
const getDeployedInRelationships = () => {
    const deployedInRelationships: {
        [idx: string]: {
            type: "parent" | "child";
            parent?: string;
        }
    } = {}
    traderXJson.relationships.forEach(relationship => {
        if (relationship["relationship-type"]["deployed-in"]) {
            const rel = relationship["relationship-type"]["deployed-in"];
            deployedInRelationships[rel["container"]] = {type: "parent"}
            rel["nodes"].forEach(node => {
                deployedInRelationships[node] = {
                    type: "child",
                    parent: rel["container"]
                }
            })
        }
    })

    return deployedInRelationships;
}

function Drawer() {
    //const [_nodes, edges] = getData();
    const [nodes, setNodes] = useState<NodeLayout[]>([])
    const [relationships, setRelationships] = useState<RelationshipLayout[]>([])
    const [instance, setInstance] = useState<BrowserJsPlumbInstance>()
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

    const getData = (calmInstance : any) => {
        const composedOfRelationships = getComposedOfRelationships();
        const deployedInRelationships = getDeployedInRelationships();
    
        const nodes = calmInstance.nodes.map(node => {
                const newData: Node = {
                    classes: 'node',
                    data: {
                        classes: 'node',
                        label: node.name,
                        description: node.description, type: node["node-type"], id: node["unique-id"]
                    }
                }
    
                if (composedOfRelationships[node["unique-id"]]?.type === "parent") {
                    newData.classes = "group";
                }
    
                if (composedOfRelationships[node["unique-id"]]?.type === "child" && composedOfRelationships[node["unique-id"]]["parent"]) {
                    newData.data.parent = composedOfRelationships[node["unique-id"]].parent!;
                }
    
                if (deployedInRelationships[node["unique-id"]]?.type === "parent") {
                    newData.classes = "group";
                }
    
                if (deployedInRelationships[node["unique-id"]]?.type === "child" && deployedInRelationships[node["unique-id"]]["parent"] && !newData.data.parent) {
                    newData.data.parent = deployedInRelationships[node["unique-id"]].parent!;
                }
                return newData;
            }
        )
    
        const edges = calmInstance.relationships.filter(relationship => !relationship["relationship-type"]["composed-of"] && !relationship["relationship-type"]["deployed-in"]).map(relationship => {
            if (relationship["relationship-type"]["interacts"] && relationship["unique-id"] && relationship.description) {
                return {
                    data: {
                        id: relationship["unique-id"],
                        label: relationship.description,
                        source: relationship["relationship-type"].interacts.actor,
                        target: relationship["relationship-type"].interacts.nodes[0],
                        smooth: {
                            enabled: true,
                            type: "curvedCW",
                            roundness: 0.1
                        }
                    }
                }
            }
            if (relationship["relationship-type"]["connects"] && relationship["unique-id"] && relationship.description && relationship["relationship-type"].connects.source.node && relationship["relationship-type"].connects.destination.node) {
                const source = relationship["relationship-type"].connects.source.node;
                const target = relationship["relationship-type"].connects.destination.node;
                return {
                    data: {
                        id: relationship["unique-id"],
                        label: relationship.description,
                        source,
                        target,
                        smooth: {
                            enabled: true,
                            type: "curvedCW",
                            roundness: 0.1
                        }
                    }
                }
            }
    
        })
        setCyNodes(nodes);
        setCyEdges(edges);
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

        setCALMInstance(calmInstance);
        getData(calmInstance);
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
                        {/*{instance && (
                            <Graph
                                instance={instance}
                                nodes={nodes}
                                relationships={relationships}
                                setSelectedNode={setSelectedNode}
                            />
                        )}*/}
                        <CytoscapeRenderer nodes={cyNodes} edges={cyEdges}/>
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
