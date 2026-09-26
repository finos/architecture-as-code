import type { Lesson } from '../types';
import { hasMetadata, nodesOfType, relationshipsOfKind, validatedEditorFile } from '../checks';
import { BEGINNER_05 } from '../beginner-05/lesson';
import { endFiles } from '../chain';

const EDITOR_FILE = BEGINNER_05.editorFile;

// Paste-safe hints: each is the complete target file, building on the previous step.
const STEP_1_TARGET_FILE = `{
    "$schema": "https://calm.finos.org/release/1.2/meta/calm.json",
    "metadata": {
        "owner": "payments-team@example.com",
        "version": "1.0.0",
        "description": "Payment processing architecture"
    },
    "nodes": [
        {
            "unique-id": "payment-service",
            "node-type": "service",
            "name": "Payment Service",
            "description": "Processes card payments",
            "interfaces": [
                {
                    "unique-id": "payment-service-api",
                    "protocol": "HTTPS",
                    "host": "api.example.com",
                    "port": 443,
                    "path": "/api/v1"
                }
            ]
        },
        {
            "unique-id": "payment-database",
            "node-type": "database",
            "name": "Payment Database",
            "description": "Stores payment records",
            "interfaces": [
                {
                    "unique-id": "payment-database-jdbc",
                    "protocol": "JDBC",
                    "host": "db.example.com",
                    "port": 5432,
                    "database": "payments"
                }
            ]
        },
        {
            "unique-id": "customer",
            "node-type": "actor",
            "name": "Customer",
            "description": "End user making a payment"
        },
        {
            "unique-id": "payment-system",
            "node-type": "system",
            "name": "Payment System",
            "description": "The overall payment processing system"
        }
    ],
    "relationships": [
        {
            "unique-id": "service-to-database",
            "relationship-type": {
                "connects": {
                    "source": { "node": "payment-service", "interfaces": ["payment-service-api"] },
                    "destination": { "node": "payment-database", "interfaces": ["payment-database-jdbc"] }
                }
            }
        },
        {
            "unique-id": "customer-to-service",
            "relationship-type": {
                "interacts": {
                    "actor": "customer",
                    "nodes": ["payment-service"]
                }
            }
        },
        {
            "unique-id": "system-composition",
            "relationship-type": {
                "composed-of": {
                    "container": "payment-system",
                    "nodes": ["payment-service", "payment-database"]
                }
            }
        }
    ]
}
`;

const STEP_2_TARGET_FILE = `{
    "$schema": "https://calm.finos.org/release/1.2/meta/calm.json",
    "metadata": {
        "owner": "payments-team@example.com",
        "version": "1.0.0",
        "description": "Payment processing architecture"
    },
    "nodes": [
        {
            "unique-id": "payment-service",
            "node-type": "service",
            "name": "Payment Service",
            "description": "Processes card payments",
            "interfaces": [
                {
                    "unique-id": "payment-service-api",
                    "protocol": "HTTPS",
                    "host": "api.example.com",
                    "port": 443,
                    "path": "/api/v1"
                }
            ],
            "metadata": {
                "owner": "payments-team@example.com",
                "tech-stack": ["Java", "Spring Boot"]
            }
        },
        {
            "unique-id": "payment-database",
            "node-type": "database",
            "name": "Payment Database",
            "description": "Stores payment records",
            "interfaces": [
                {
                    "unique-id": "payment-database-jdbc",
                    "protocol": "JDBC",
                    "host": "db.example.com",
                    "port": 5432,
                    "database": "payments"
                }
            ]
        },
        {
            "unique-id": "customer",
            "node-type": "actor",
            "name": "Customer",
            "description": "End user making a payment"
        },
        {
            "unique-id": "payment-system",
            "node-type": "system",
            "name": "Payment System",
            "description": "The overall payment processing system"
        }
    ],
    "relationships": [
        {
            "unique-id": "service-to-database",
            "relationship-type": {
                "connects": {
                    "source": { "node": "payment-service", "interfaces": ["payment-service-api"] },
                    "destination": { "node": "payment-database", "interfaces": ["payment-database-jdbc"] }
                }
            }
        },
        {
            "unique-id": "customer-to-service",
            "relationship-type": {
                "interacts": {
                    "actor": "customer",
                    "nodes": ["payment-service"]
                }
            }
        },
        {
            "unique-id": "system-composition",
            "relationship-type": {
                "composed-of": {
                    "container": "payment-system",
                    "nodes": ["payment-service", "payment-database"]
                }
            }
        }
    ]
}
`;

const STEP_3_TARGET_FILE = `{
    "$schema": "https://calm.finos.org/release/1.2/meta/calm.json",
    "metadata": {
        "owner": "payments-team@example.com",
        "version": "1.0.0",
        "description": "Payment processing architecture"
    },
    "nodes": [
        {
            "unique-id": "payment-service",
            "node-type": "service",
            "name": "Payment Service",
            "description": "Processes card payments",
            "interfaces": [
                {
                    "unique-id": "payment-service-api",
                    "protocol": "HTTPS",
                    "host": "api.example.com",
                    "port": 443,
                    "path": "/api/v1"
                }
            ],
            "metadata": {
                "owner": "payments-team@example.com",
                "tech-stack": ["Java", "Spring Boot"]
            }
        },
        {
            "unique-id": "payment-database",
            "node-type": "database",
            "name": "Payment Database",
            "description": "Stores payment records",
            "interfaces": [
                {
                    "unique-id": "payment-database-jdbc",
                    "protocol": "JDBC",
                    "host": "db.example.com",
                    "port": 5432,
                    "database": "payments"
                }
            ]
        },
        {
            "unique-id": "customer",
            "node-type": "actor",
            "name": "Customer",
            "description": "End user making a payment"
        },
        {
            "unique-id": "payment-system",
            "node-type": "system",
            "name": "Payment System",
            "description": "The overall payment processing system"
        }
    ],
    "relationships": [
        {
            "unique-id": "service-to-database",
            "relationship-type": {
                "connects": {
                    "source": { "node": "payment-service", "interfaces": ["payment-service-api"] },
                    "destination": { "node": "payment-database", "interfaces": ["payment-database-jdbc"] }
                }
            },
            "metadata": {
                "latency": "< 50ms",
                "encryption": "TLS"
            }
        },
        {
            "unique-id": "customer-to-service",
            "relationship-type": {
                "interacts": {
                    "actor": "customer",
                    "nodes": ["payment-service"]
                }
            }
        },
        {
            "unique-id": "system-composition",
            "relationship-type": {
                "composed-of": {
                    "container": "payment-system",
                    "nodes": ["payment-service", "payment-database"]
                }
            }
        }
    ]
}
`;

export const BEGINNER_06: Lesson = {
    id: 'beginner-06',
    title: 'Document with metadata',
    summary: 'Add metadata to your architecture, a node and a relationship to document ownership and operational context.',
    chainsFrom: 'beginner-05',
    editorFile: EDITOR_FILE,
    seedFiles: endFiles(BEGINNER_05),
    steps: [
        {
            id: 'architecture-metadata',
            title: 'Add metadata to the architecture',
            body:
                'Add a top-level `metadata` object next to `nodes` and `relationships`. Include an ' +
                '`owner`, a `version` and a `description`. Metadata can also be an array of ' +
                '`{ "key": ..., "value": ... }` objects, but the object form is simpler. Save your change.',
            hint: { kind: 'file', content: STEP_1_TARGET_FILE },
            check: (state) => hasMetadata(state.doc) && state.validation.ok,
        },
        {
            id: 'node-metadata',
            title: 'Add metadata to the service node',
            body:
                'Add a `metadata` object to your service node. Include an `owner` and a `tech-stack`. ' +
                'Save your change.',
            hint: { kind: 'file', content: STEP_2_TARGET_FILE },
            check: (state) => nodesOfType(state.doc, 'service').some((node) => hasMetadata(node)) && state.validation.ok,
        },
        {
            id: 'relationship-metadata',
            title: 'Add metadata to the connects relationship',
            body:
                'Add a `metadata` object to the `connects` relationship between your service and your ' +
                'database. Include a `latency` and an `encryption` field. Save your change.',
            hint: { kind: 'file', content: STEP_3_TARGET_FILE },
            check: (state) => relationshipsOfKind(state.doc, 'connects').some((rel) => hasMetadata(rel)) && state.validation.ok,
        },
        {
            id: 'validate',
            title: 'Validate the architecture',
            body:
                'Run `calm validate -a architectures/my-first-architecture.json -f pretty`. The summary ' +
                'should report 0 errors.',
            hint: {
                kind: 'commands',
                commands: ['calm validate -a architectures/my-first-architecture.json -f pretty'],
            },
            check: (state) =>
                hasMetadata(state.doc) &&
                nodesOfType(state.doc, 'service').some((node) => hasMetadata(node)) &&
                relationshipsOfKind(state.doc, 'connects').some((rel) => hasMetadata(rel)) &&
                validatedEditorFile(state),
        },
    ],
    completion: {
        heading: 'Lesson complete',
        message:
            'You added metadata to your architecture, your service node and your connects ' +
            'relationship, documenting ownership, technical context and operational detail.',
        links: [],
    },
};
