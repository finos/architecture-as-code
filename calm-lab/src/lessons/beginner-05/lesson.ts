import type { Lesson } from '../types';
import { connectsUsesInterfaces, nodeInterfaces, nodesOfType, validatedEditorFile } from '../checks';
import { BEGINNER_03 } from '../beginner-03/lesson';
import { endFiles } from '../chain';

const EDITOR_FILE = BEGINNER_03.editorFile;

// Paste-safe hints: each is the complete target file, building on the previous step.
const STEP_1_TARGET_FILE = `{
    "$schema": "https://calm.finos.org/release/1.2/meta/calm.json",
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
            "description": "Stores payment records"
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
                    "source": { "node": "payment-service" },
                    "destination": { "node": "payment-database" }
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
                    "source": { "node": "payment-service" },
                    "destination": { "node": "payment-database" }
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

export const BEGINNER_05: Lesson = {
    id: 'beginner-05',
    title: 'Add interfaces',
    summary: 'Add inline interfaces to your nodes, then reference them from a connects relationship.',
    chainsFrom: 'beginner-03',
    editorFile: EDITOR_FILE,
    seedFiles: endFiles(BEGINNER_03),
    steps: [
        {
            id: 'service-interface',
            title: 'Add an inline interface to the service',
            body:
                'Add an `interfaces` array to your service node. Give the interface a `unique-id`, ' +
                '`protocol` of `"HTTPS"`, a `host`, `port: 443` and a `path`. Save your change.',
            hint: { kind: 'file', content: STEP_1_TARGET_FILE },
            check: (state) =>
                nodesOfType(state.doc, 'service').some((node) => nodeInterfaces(node).length >= 1) && state.validation.ok,
        },
        {
            id: 'database-interface',
            title: 'Add an inline interface to the database',
            body:
                'Add an `interfaces` array to your database node. Give the interface a `unique-id`, ' +
                '`protocol` of `"JDBC"`, a `host`, a `port` and a `database` name. Save your change.',
            hint: { kind: 'file', content: STEP_2_TARGET_FILE },
            check: (state) =>
                nodesOfType(state.doc, 'database').some((node) => nodeInterfaces(node).length >= 1) && state.validation.ok,
        },
        {
            id: 'connect-interfaces',
            title: 'Name the interfaces on the connects relationship',
            body:
                'Update the `connects` relationship between your service and your database. Give ' +
                '`source` and `destination` an `interfaces` array naming the interface `unique-id` on ' +
                'that node. Save your change.',
            hint: { kind: 'file', content: STEP_3_TARGET_FILE },
            check: (state) => connectsUsesInterfaces(state.doc, 'service', 'database') && state.validation.ok,
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
            check: (state) => connectsUsesInterfaces(state.doc, 'service', 'database') && validatedEditorFile(state),
        },
    ],
    completion: {
        heading: 'Lesson complete',
        message:
            'You added inline interfaces to your service and database, and referenced them from a ' +
            'connects relationship for precise, validated integration points.',
        links: [],
    },
};
