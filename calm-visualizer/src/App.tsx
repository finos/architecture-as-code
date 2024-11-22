import './App.css'
import Drawer from './components/drawer/Drawer'
import CytoscapeRenderer, {Node, Edge} from "./components/cytoscape-renderer/CytoscapeRenderer.tsx";

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

const getData = (): [Node[], Edge[]] => {
    const nodes = traderXJson.nodes.map(node => ({data: {label: node.name, description: node.description, type: node["node-type"], id: node["unique-id"]}}))

    const edges = traderXJson.relationships.filter(relationship => !relationship["relationship-type"]["composed-of"] && !relationship["relationship-type"]["deployed-in"]).map(relationship => {
        if(relationship["relationship-type"]["interacts"] && relationship["unique-id"]  && relationship.description) {
            return  {
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
                }}
        }
        if(relationship["relationship-type"]["connects"] && relationship["unique-id"] && relationship.description && relationship["relationship-type"].connects.source.node && relationship["relationship-type"].connects.destination.node) {
            const source = relationship["relationship-type"].connects.source.node;
            const target =  relationship["relationship-type"].connects.destination.node;
            return {
                data: {
                    id: relationship["unique-id"],
                    label: relationship.description,
                    source ,
                    target,
                    smooth: {
                        enabled: true,
                        type: "curvedCW",
                        roundness: 0.1
                    }}}
        }
        return {data: {id: '5', label: "Dummy label", source: "1", target: "2"}}
        /*if(relationship["relationship-type"]["composed-of"]) {
            // return {}
        }
        if(relationship["relationship-type"]["deployed-in"]) {
            return {}
        }*/

    })

    return [nodes, edges];
}

function App() {
    const [nodes, edges]  = getData();

    return (
        <>
            <Drawer />
            <CytoscapeRenderer nodes={nodes} edges={edges} />
        </>
    )
}

export default App
