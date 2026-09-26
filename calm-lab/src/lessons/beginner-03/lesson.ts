import type { Lesson } from '../types';
import { composedOf, connectsBetween, interactsWith, validatedEditorFile } from '../checks';
import { BEGINNER_02 } from '../beginner-02/lesson';
import { endFiles } from '../chain';

const EDITOR_FILE = BEGINNER_02.editorFile;

// Paste-safe hints: each is the complete target file, building on the previous step.
const STEP_1_TARGET_FILE = `{
    "$schema": "https://calm.finos.org/release/1.2/meta/calm.json",
    "nodes": [
        {
            "unique-id": "payment-service",
            "node-type": "service",
            "name": "Payment Service",
            "description": "Processes card payments"
        },
        {
            "unique-id": "payment-database",
            "node-type": "database",
            "name": "Payment Database",
            "description": "Stores payment records"
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
            "description": "Processes card payments"
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
            "description": "Processes card payments"
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

export const BEGINNER_03: Lesson = {
    id: 'beginner-03',
    title: 'Connect nodes with relationships',
    summary: 'Add a database, an actor and a system, and connect them with connects, interacts and composed-of.',
    chainsFrom: 'beginner-02',
    editorFile: EDITOR_FILE,
    seedFiles: endFiles(BEGINNER_02),
    steps: [
        {
            id: 'connect-database',
            title: 'Add a database and connect it',
            body:
                'Add a `database` node to the `nodes` array. Add a `connects` relationship from your ' +
                'service to the database, with `source` and `destination` node references. Use `connects` ' +
                'for a service talking to infrastructure, and `interacts` for a person talking to a service. ' +
                'Save your change.',
            hint: { kind: 'file', content: STEP_1_TARGET_FILE },
            check: (state) => connectsBetween(state.doc, 'service', 'database') && state.validation.ok,
        },
        {
            id: 'add-actor',
            title: 'Add an actor who uses the service',
            body:
                'Add an `actor` node for the person who uses your service. Add an `interacts` relationship ' +
                'with an `actor` property and a `nodes` array that includes your service. Save your change.',
            hint: { kind: 'file', content: STEP_2_TARGET_FILE },
            check: (state) => interactsWith(state.doc, 'actor', 'service') && state.validation.ok,
        },
        {
            id: 'compose-system',
            title: 'Group the service and database into a system',
            body:
                'Add a `system` node for the overall system. Add a `composed-of` relationship: `container` ' +
                'is a single node id, and `nodes` is a list of the members — here, your service and database. ' +
                'Save your change.',
            hint: { kind: 'file', content: STEP_3_TARGET_FILE },
            check: (state) => composedOf(state.doc, 'system', ['service', 'database']) && state.validation.ok,
        },
        {
            id: 'validate',
            title: 'Validate the full architecture',
            body:
                'Run `calm validate -a architectures/my-first-architecture.json -f pretty`. The summary should ' +
                'report 0 errors. Check the Diagram tab to see all 4 nodes and 3 relationships.',
            hint: {
                kind: 'commands',
                commands: ['calm validate -a architectures/my-first-architecture.json -f pretty'],
            },
            check: (state) => composedOf(state.doc, 'system', ['service', 'database']) && validatedEditorFile(state),
        },
    ],
    completion: {
        heading: 'Lesson complete',
        message:
            'You connected nodes with connects, interacts and composed-of relationships, and validated the ' +
            'result with the real CALM engine. Tutorial 04 covers the VS Code extension, which has no lab lesson.',
        links: [],
    },
};
