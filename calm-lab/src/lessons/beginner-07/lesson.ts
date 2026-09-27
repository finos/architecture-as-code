import { HOME_DIR, type CalmDocLike, type Lesson } from '../types';
import { composedOf, connectsBetween, interactsWith, nodesOfType, ranOk, validatedEditorFile } from '../checks';
import { BEGINNER_06 } from '../beginner-06/lesson';
import { endFiles } from '../chain';

const EDITOR_FILE = `${HOME_DIR}/architectures/ecommerce-platform.json`;
const FIRST_ARCHITECTURE = BEGINNER_06.editorFile;

const SEED_ARCHITECTURE = `{
    "$schema": "https://calm.finos.org/release/1.2/meta/calm.json",
    "nodes": [],
    "relationships": []
}
`;

// Paste-safe hints: each is the complete target file, building on the previous step.
const STEP_1_TARGET_FILE = `{
    "$schema": "https://calm.finos.org/release/1.2/meta/calm.json",
    "metadata": {
        "owner": "platform-team@example.com",
        "version": "1.0.0",
        "description": "E-commerce order processing platform",
        "tags": ["ecommerce", "microservices", "orders"]
    },
    "nodes": [
        {
            "unique-id": "customer",
            "node-type": "actor",
            "name": "Customer",
            "description": "Browses products and places orders"
        },
        {
            "unique-id": "admin",
            "node-type": "actor",
            "name": "Admin",
            "description": "Manages inventory and monitors orders"
        },
        {
            "unique-id": "api-gateway",
            "node-type": "service",
            "name": "API Gateway",
            "description": "Public entry point that routes client requests",
            "interfaces": [
                {
                    "unique-id": "gateway-https",
                    "protocol": "HTTPS",
                    "host": "api.ecommerce.example.com",
                    "port": 443
                }
            ],
            "metadata": {
                "tech-owner": "platform-team@example.com",
                "sla-tier": "tier-1"
            }
        }
    ],
    "relationships": [
        {
            "unique-id": "customer-to-gateway",
            "description": "Customer uses the platform through the API Gateway",
            "relationship-type": {
                "interacts": {
                    "actor": "customer",
                    "nodes": ["api-gateway"]
                }
            }
        },
        {
            "unique-id": "admin-to-gateway",
            "description": "Admin uses the platform through the API Gateway",
            "relationship-type": {
                "interacts": {
                    "actor": "admin",
                    "nodes": ["api-gateway"]
                }
            }
        }
    ]
}
`;

const STEP_2_TARGET_FILE = `{
    "$schema": "https://calm.finos.org/release/1.2/meta/calm.json",
    "metadata": {
        "owner": "platform-team@example.com",
        "version": "1.0.0",
        "description": "E-commerce order processing platform",
        "tags": ["ecommerce", "microservices", "orders"]
    },
    "nodes": [
        {
            "unique-id": "customer",
            "node-type": "actor",
            "name": "Customer",
            "description": "Browses products and places orders"
        },
        {
            "unique-id": "admin",
            "node-type": "actor",
            "name": "Admin",
            "description": "Manages inventory and monitors orders"
        },
        {
            "unique-id": "api-gateway",
            "node-type": "service",
            "name": "API Gateway",
            "description": "Public entry point that routes client requests",
            "interfaces": [
                {
                    "unique-id": "gateway-https",
                    "protocol": "HTTPS",
                    "host": "api.ecommerce.example.com",
                    "port": 443
                }
            ],
            "metadata": {
                "tech-owner": "platform-team@example.com",
                "sla-tier": "tier-1"
            }
        },
        {
            "unique-id": "order-service",
            "node-type": "service",
            "name": "Order Service",
            "description": "Manages the order lifecycle",
            "interfaces": [
                {
                    "unique-id": "order-api",
                    "protocol": "HTTPS",
                    "port": 8080
                }
            ],
            "metadata": {
                "tech-owner": "orders-team@example.com"
            }
        },
        {
            "unique-id": "inventory-service",
            "node-type": "service",
            "name": "Inventory Service",
            "description": "Tracks product stock levels",
            "interfaces": [
                {
                    "unique-id": "inventory-api",
                    "protocol": "HTTPS",
                    "port": 8081
                }
            ],
            "metadata": {
                "tech-owner": "inventory-team@example.com"
            }
        },
        {
            "unique-id": "payment-service",
            "node-type": "service",
            "name": "Payment Service",
            "description": "Processes payment transactions",
            "interfaces": [
                {
                    "unique-id": "payment-api",
                    "protocol": "HTTPS",
                    "port": 8082
                }
            ],
            "metadata": {
                "tech-owner": "payments-team@example.com",
                "pci-compliant": true
            }
        }
    ],
    "relationships": [
        {
            "unique-id": "customer-to-gateway",
            "description": "Customer uses the platform through the API Gateway",
            "relationship-type": {
                "interacts": {
                    "actor": "customer",
                    "nodes": ["api-gateway"]
                }
            }
        },
        {
            "unique-id": "admin-to-gateway",
            "description": "Admin uses the platform through the API Gateway",
            "relationship-type": {
                "interacts": {
                    "actor": "admin",
                    "nodes": ["api-gateway"]
                }
            }
        },
        {
            "unique-id": "gateway-to-orders",
            "description": "Routes order requests",
            "relationship-type": {
                "connects": {
                    "source": { "node": "api-gateway", "interfaces": ["gateway-https"] },
                    "destination": { "node": "order-service", "interfaces": ["order-api"] }
                }
            },
            "metadata": {
                "latency-sla": "100ms"
            }
        },
        {
            "unique-id": "gateway-to-inventory",
            "description": "Routes inventory requests",
            "relationship-type": {
                "connects": {
                    "source": { "node": "api-gateway", "interfaces": ["gateway-https"] },
                    "destination": { "node": "inventory-service", "interfaces": ["inventory-api"] }
                }
            },
            "metadata": {
                "latency-sla": "100ms"
            }
        },
        {
            "unique-id": "orders-to-payment",
            "description": "Takes payment for an order",
            "relationship-type": {
                "connects": {
                    "source": { "node": "order-service", "interfaces": ["order-api"] },
                    "destination": { "node": "payment-service", "interfaces": ["payment-api"] }
                }
            },
            "metadata": {
                "retry-policy": "exponential-backoff"
            }
        }
    ]
}
`;

const STEP_3_TARGET_FILE = `{
    "$schema": "https://calm.finos.org/release/1.2/meta/calm.json",
    "metadata": {
        "owner": "platform-team@example.com",
        "version": "1.0.0",
        "description": "E-commerce order processing platform",
        "tags": ["ecommerce", "microservices", "orders"]
    },
    "nodes": [
        {
            "unique-id": "customer",
            "node-type": "actor",
            "name": "Customer",
            "description": "Browses products and places orders"
        },
        {
            "unique-id": "admin",
            "node-type": "actor",
            "name": "Admin",
            "description": "Manages inventory and monitors orders"
        },
        {
            "unique-id": "api-gateway",
            "node-type": "service",
            "name": "API Gateway",
            "description": "Public entry point that routes client requests",
            "interfaces": [
                {
                    "unique-id": "gateway-https",
                    "protocol": "HTTPS",
                    "host": "api.ecommerce.example.com",
                    "port": 443
                }
            ],
            "metadata": {
                "tech-owner": "platform-team@example.com",
                "sla-tier": "tier-1"
            }
        },
        {
            "unique-id": "order-service",
            "node-type": "service",
            "name": "Order Service",
            "description": "Manages the order lifecycle",
            "interfaces": [
                {
                    "unique-id": "order-api",
                    "protocol": "HTTPS",
                    "port": 8080
                }
            ],
            "metadata": {
                "tech-owner": "orders-team@example.com"
            }
        },
        {
            "unique-id": "inventory-service",
            "node-type": "service",
            "name": "Inventory Service",
            "description": "Tracks product stock levels",
            "interfaces": [
                {
                    "unique-id": "inventory-api",
                    "protocol": "HTTPS",
                    "port": 8081
                }
            ],
            "metadata": {
                "tech-owner": "inventory-team@example.com"
            }
        },
        {
            "unique-id": "payment-service",
            "node-type": "service",
            "name": "Payment Service",
            "description": "Processes payment transactions",
            "interfaces": [
                {
                    "unique-id": "payment-api",
                    "protocol": "HTTPS",
                    "port": 8082
                }
            ],
            "metadata": {
                "tech-owner": "payments-team@example.com",
                "pci-compliant": true
            }
        },
        {
            "unique-id": "order-database",
            "node-type": "database",
            "name": "Order Database",
            "description": "Stores order records",
            "interfaces": [
                {
                    "unique-id": "order-db-jdbc",
                    "protocol": "JDBC",
                    "port": 5432
                }
            ],
            "metadata": {
                "database-type": "PostgreSQL",
                "backup-frequency": "daily"
            }
        },
        {
            "unique-id": "inventory-database",
            "node-type": "database",
            "name": "Inventory Database",
            "description": "Stores product stock levels",
            "interfaces": [
                {
                    "unique-id": "inventory-db-jdbc",
                    "protocol": "JDBC",
                    "port": 5433
                }
            ],
            "metadata": {
                "database-type": "PostgreSQL",
                "backup-frequency": "daily"
            }
        },
        {
            "unique-id": "ecommerce-platform",
            "node-type": "system",
            "name": "E-Commerce Platform",
            "description": "The complete order processing system"
        }
    ],
    "relationships": [
        {
            "unique-id": "customer-to-gateway",
            "description": "Customer uses the platform through the API Gateway",
            "relationship-type": {
                "interacts": {
                    "actor": "customer",
                    "nodes": ["api-gateway"]
                }
            }
        },
        {
            "unique-id": "admin-to-gateway",
            "description": "Admin uses the platform through the API Gateway",
            "relationship-type": {
                "interacts": {
                    "actor": "admin",
                    "nodes": ["api-gateway"]
                }
            }
        },
        {
            "unique-id": "gateway-to-orders",
            "description": "Routes order requests",
            "relationship-type": {
                "connects": {
                    "source": { "node": "api-gateway", "interfaces": ["gateway-https"] },
                    "destination": { "node": "order-service", "interfaces": ["order-api"] }
                }
            },
            "metadata": {
                "latency-sla": "100ms"
            }
        },
        {
            "unique-id": "gateway-to-inventory",
            "description": "Routes inventory requests",
            "relationship-type": {
                "connects": {
                    "source": { "node": "api-gateway", "interfaces": ["gateway-https"] },
                    "destination": { "node": "inventory-service", "interfaces": ["inventory-api"] }
                }
            },
            "metadata": {
                "latency-sla": "100ms"
            }
        },
        {
            "unique-id": "orders-to-payment",
            "description": "Takes payment for an order",
            "relationship-type": {
                "connects": {
                    "source": { "node": "order-service", "interfaces": ["order-api"] },
                    "destination": { "node": "payment-service", "interfaces": ["payment-api"] }
                }
            },
            "metadata": {
                "retry-policy": "exponential-backoff"
            }
        },
        {
            "unique-id": "orders-to-database",
            "description": "Stores order data",
            "relationship-type": {
                "connects": {
                    "source": { "node": "order-service", "interfaces": ["order-api"] },
                    "destination": { "node": "order-database", "interfaces": ["order-db-jdbc"] }
                }
            },
            "metadata": {
                "connection-pool-size": 20
            }
        },
        {
            "unique-id": "inventory-to-database",
            "description": "Stores stock data",
            "relationship-type": {
                "connects": {
                    "source": { "node": "inventory-service", "interfaces": ["inventory-api"] },
                    "destination": { "node": "inventory-database", "interfaces": ["inventory-db-jdbc"] }
                }
            },
            "metadata": {
                "connection-pool-size": 20
            }
        },
        {
            "unique-id": "platform-composition",
            "description": "The platform contains all services and databases",
            "relationship-type": {
                "composed-of": {
                    "container": "ecommerce-platform",
                    "nodes": ["api-gateway", "order-service", "inventory-service", "payment-service", "order-database", "inventory-database"]
                }
            }
        }
    ]
}
`;

type Doc = CalmDocLike | null;

const hasFrontDoor = (doc: Doc) => nodesOfType(doc, 'actor').length > 0 && interactsWith(doc, 'actor', 'service');
// The gateway plus the order, inventory and payment services.
const hasServices = (doc: Doc) => nodesOfType(doc, 'service').length >= 4 && connectsBetween(doc, 'service', 'service');
const hasData = (doc: Doc) => connectsBetween(doc, 'service', 'database') && composedOf(doc, 'system', ['service', 'database']);

export const BEGINNER_07: Lesson = {
    id: 'beginner-07',
    title: 'Build a complete e-commerce architecture',
    tutorial: { title: 'Build a Complete E-Commerce Microservice Architecture', url: 'https://calm.finos.org/tutorials/beginner/07-complete-architecture/' },
    chainsFrom: 'beginner-06',
    editorFile: EDITOR_FILE,
    seedFiles: {
        ...endFiles(BEGINNER_06),
        [EDITOR_FILE]: SEED_ARCHITECTURE,
    },
    steps: [
        {
            id: 'front-door',
            title: 'Add a customer and the API gateway',
            body:
                'The editor now opens a new file, `architectures/ecommerce-platform.json`. Add an `actor` ' +
                'node for a customer and a `service` node for the API gateway. Add an `interacts` relationship ' +
                'from the actor to the gateway, then save your change. The reference answer also adds an admin ' +
                'actor and an HTTPS interface on the gateway, but this step does not need them.',
            hint: { kind: 'file', content: STEP_1_TARGET_FILE },
            check: (state) => hasFrontDoor(state.doc) && state.validation.ok,
        },
        {
            id: 'services',
            title: 'Add the order, inventory and payment services',
            body:
                'Add three more `service` nodes for orders, inventory and payments, each with an interface. ' +
                'Connect the gateway to the order and inventory services, and the order service to the ' +
                'payment service, with `connects` relationships. Save your change.',
            hint: { kind: 'file', content: STEP_2_TARGET_FILE },
            check: (state) => hasServices(state.doc) && state.validation.ok,
        },
        {
            id: 'data',
            title: 'Add the databases and the platform',
            body:
                'Add a `database` node for orders and one for inventory, and connect each service to its ' +
                'database. Then add a `system` node for the platform with a `composed-of` relationship ' +
                'that contains the services and the databases. Save your change.',
            hint: { kind: 'file', content: STEP_3_TARGET_FILE },
            check: (state) => hasData(state.doc) && state.validation.ok,
        },
        {
            id: 'validate',
            title: 'Validate the architecture',
            body:
                'Run `calm validate -a architectures/ecommerce-platform.json -f pretty`. The summary ' +
                'should report 0 errors.',
            hint: {
                kind: 'commands',
                commands: ['calm validate -a architectures/ecommerce-platform.json -f pretty'],
            },
            check: (state) =>
                hasFrontDoor(state.doc) && hasServices(state.doc) && hasData(state.doc) && validatedEditorFile(state),
        },
        {
            id: 'compare',
            title: 'Compare the two architectures',
            body:
                'Run `calm diff -a architectures/my-first-architecture.json -b architectures/ecommerce-platform.json -f summary`. ' +
                'The summary lists the nodes and relationships that each architecture adds or removes. ' +
                'If you change the e-commerce file after the diff, run the diff again.',
            hint: {
                kind: 'commands',
                commands: ['calm diff -a architectures/my-first-architecture.json -b architectures/ecommerce-platform.json -f summary'],
            },
            check: (state) => ranOk(state, 'diff', { documentA: FIRST_ARCHITECTURE, documentB: state.editorFile }),
        },
    ],
    completion: {
        heading: 'Beginner track complete',
        message:
            'You built a complete e-commerce architecture with actors, services, databases and a ' +
            'system, validated it and compared it with your first architecture. You have completed ' +
            'the beginner track.',
        links: [],
    },
};
