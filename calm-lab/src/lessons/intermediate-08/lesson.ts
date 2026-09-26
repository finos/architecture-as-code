import type { CalmDocLike, Lesson } from '../types';
import { controlsIn, nodesOfType, validatedEditorFile } from '../checks';
import { BEGINNER_07 } from '../beginner-07/lesson';
import { endFiles } from '../chain';

const EDITOR_FILE = BEGINNER_07.editorFile;

// Paste-safe hints: each is the complete target file, building on the previous step.
const STEP_1_TARGET_FILE = `{
    "$schema": "https://calm.finos.org/release/1.2/meta/calm.json",
    "metadata": {
        "owner": "platform-team@example.com",
        "version": "1.0.0",
        "description": "E-commerce order processing platform",
        "tags": ["ecommerce", "microservices", "orders"]
    },
    "controls": {
        "security": {
            "description": "Data encryption and secure communication requirements",
            "requirements": [
                {
                    "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
                    "config": {
                        "control-id": "SEC-001",
                        "name": "Encryption at rest",
                        "description": "All data stores use AES-256 encryption at rest"
                    }
                }
            ]
        }
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

const STEP_2_TARGET_FILE = STEP_1_TARGET_FILE.replace(
    `    "controls": {
        "security": {
            "description": "Data encryption and secure communication requirements",
            "requirements": [
                {
                    "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
                    "config": {
                        "control-id": "SEC-001",
                        "name": "Encryption at rest",
                        "description": "All data stores use AES-256 encryption at rest"
                    }
                }
            ]
        }
    },`,
    `    "controls": {
        "security": {
            "description": "Data encryption and secure communication requirements",
            "requirements": [
                {
                    "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
                    "config": {
                        "control-id": "SEC-001",
                        "name": "Encryption at rest",
                        "description": "All data stores use AES-256 encryption at rest"
                    }
                }
            ]
        },
        "performance": {
            "description": "System-wide performance and scalability requirements",
            "requirements": [
                {
                    "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
                    "config": {
                        "control-id": "PERF-001",
                        "name": "Response time SLA",
                        "description": "The system meets a 200ms p99 latency target"
                    }
                }
            ]
        }
    },`,
);

const STEP_3_TARGET_FILE = STEP_2_TARGET_FILE.replace(
    `        {
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
        },`,
    `        {
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
            },
            "controls": {
                "compliance": {
                    "description": "PCI-DSS compliance for payment processing",
                    "requirements": [
                        {
                            "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
                            "config": {
                                "control-id": "PCI-001",
                                "name": "PCI-DSS compliance",
                                "description": "Payment processing follows PCI-DSS v4.0 requirements"
                            }
                        }
                    ]
                }
            }
        },`,
);

const STEP_4_TARGET_FILE = STEP_3_TARGET_FILE.replace(
    `        {
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
        },`,
    `        {
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
            },
            "controls": {
                "performance": {
                    "description": "API Gateway rate limiting and caching requirements",
                    "requirements": [
                        {
                            "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
                            "config": {
                                "control-id": "PERF-002",
                                "name": "Rate limiting and caching",
                                "description": "Requests are rate limited and cached at the gateway"
                            }
                        }
                    ]
                }
            }
        },`,
);

type Doc = CalmDocLike | null;

const topLevelDomains = (doc: Doc) => controlsIn(doc).map(([domain]) => domain);
const nodeDomains = (doc: Doc, types: string[]) =>
    types.flatMap((type) => nodesOfType(doc, type)).flatMap((node) => controlsIn(node).map(([domain]) => domain));

const hasSecurityControl = (doc: Doc) => topLevelDomains(doc).includes('security');
const hasTwoTopLevelDomains = (doc: Doc) => new Set(topLevelDomains(doc)).size >= 2;
const hasNodeControl = (doc: Doc) => nodeDomains(doc, ['service']).length > 0;
const hasTwoNodeDomains = (doc: Doc) => new Set(nodeDomains(doc, ['service', 'database'])).size >= 2;

export const INTERMEDIATE_08: Lesson = {
    id: 'intermediate-08',
    title: 'Controls',
    summary: 'Document security, performance and compliance requirements with architecture-level and node-level controls.',
    chainsFrom: 'beginner-07',
    editorFile: EDITOR_FILE,
    seedFiles: endFiles(BEGINNER_07),
    steps: [
        {
            id: 'architecture-security',
            title: 'Add an architecture-level security control',
            body:
                'Add a `controls` section at the top level with a `security` domain. Give it a ' +
                '`description` and a `requirements` array. Each requirement needs a `requirement-url` ' +
                'naming the schema its config must satisfy, plus either inline `config` or an external ' +
                '`config-url`. Use `https://calm.finos.org/release/1.2/meta/control-requirement.json` as ' +
                'the requirement-url, with a `config` of `control-id`, `name` and `description`. Save your change.',
            hint: { kind: 'file', content: STEP_1_TARGET_FILE },
            check: (state) => hasSecurityControl(state.doc) && state.validation.ok,
        },
        {
            id: 'architecture-performance',
            title: 'Add an architecture-level performance control',
            body:
                'Add a second domain to the top-level `controls` section, for example `performance`. ' +
                'It needs its own `description` and `requirements`, each with a `requirement-url` and ' +
                'a `config` or `config-url`. Save your change.',
            hint: { kind: 'file', content: STEP_2_TARGET_FILE },
            check: (state) => hasTwoTopLevelDomains(state.doc) && state.validation.ok,
        },
        {
            id: 'node-compliance',
            title: 'Add a node-level compliance control',
            body:
                'Add a `controls` section to a `service` node, for example a `compliance` domain. It ' +
                'needs the same shape as an architecture-level control: `description` and `requirements`. Save your change.',
            hint: { kind: 'file', content: STEP_3_TARGET_FILE },
            check: (state) => hasNodeControl(state.doc) && state.validation.ok,
        },
        {
            id: 'node-performance',
            title: 'Add a second node-level control',
            body:
                'Add a `controls` section to a `service` or `database` node, in a different domain ' +
                'from the last step, for example `performance`. Save your change.',
            hint: { kind: 'file', content: STEP_4_TARGET_FILE },
            check: (state) => hasNodeControl(state.doc) && hasTwoNodeDomains(state.doc) && state.validation.ok,
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
                hasSecurityControl(state.doc) && hasTwoTopLevelDomains(state.doc) &&
                hasNodeControl(state.doc) && hasTwoNodeDomains(state.doc) && validatedEditorFile(state),
        },
    ],
    completion: {
        heading: 'Lesson complete',
        message:
            'You added architecture-level and node-level controls to capture security, performance ' +
            'and compliance requirements, each with a requirement-url and a configured implementation.',
        links: [],
    },
};
