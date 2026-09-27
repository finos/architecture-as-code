import type { CalmDocLike, Lesson } from '../types';
import { flowsWithTransitions, validatedEditorFile } from '../checks';
import { INTERMEDIATE_08 } from '../intermediate-08/lesson';
import { endFiles } from '../chain';

const EDITOR_FILE = INTERMEDIATE_08.editorFile;
const BASE_FILE = endFiles(INTERMEDIATE_08)[EDITOR_FILE];

const CONTROLS_TO_NODES = `    },
    "nodes": [`;

const ORDER_FLOW_ITEM = `        {
            "unique-id": "order-processing-flow",
            "name": "Customer Order Processing",
            "description": "End-to-end flow from a customer placing an order to payment processing",
            "transitions": [
                {
                    "relationship-unique-id": "customer-to-gateway",
                    "sequence-number": 1,
                    "description": "Customer submits an order to the API Gateway",
                    "direction": "source-to-destination"
                },
                {
                    "relationship-unique-id": "gateway-to-orders",
                    "sequence-number": 2,
                    "description": "API Gateway routes the order to Order Service",
                    "direction": "source-to-destination"
                },
                {
                    "relationship-unique-id": "orders-to-payment",
                    "sequence-number": 3,
                    "description": "Order Service initiates payment processing",
                    "direction": "source-to-destination"
                }
            ]
        }`;

const STOCK_FLOW_ITEM = `        {
            "unique-id": "inventory-check-flow",
            "name": "Inventory Stock Check",
            "description": "Admin checks current inventory stock levels through the platform",
            "transitions": [
                {
                    "relationship-unique-id": "admin-to-gateway",
                    "sequence-number": 1,
                    "description": "Admin requests inventory status",
                    "direction": "source-to-destination"
                },
                {
                    "relationship-unique-id": "gateway-to-inventory",
                    "sequence-number": 2,
                    "description": "API Gateway routes the request to Inventory Service",
                    "direction": "source-to-destination"
                },
                {
                    "relationship-unique-id": "inventory-to-database",
                    "sequence-number": 3,
                    "description": "Inventory Service queries current stock levels",
                    "direction": "source-to-destination"
                },
                {
                    "relationship-unique-id": "inventory-to-database",
                    "sequence-number": 4,
                    "description": "Inventory Database returns stock data",
                    "direction": "destination-to-source"
                },
                {
                    "relationship-unique-id": "gateway-to-inventory",
                    "sequence-number": 5,
                    "description": "Inventory Service returns the stock report",
                    "direction": "destination-to-source"
                }
            ]
        }`;

// Paste-safe hints: each is the complete target file, building on the previous step.
const STEP_1_TARGET_FILE = BASE_FILE.replace(
    CONTROLS_TO_NODES,
    `    },\n    "flows": [\n${ORDER_FLOW_ITEM}\n    ],\n    "nodes": [`,
);

const STEP_3_TARGET_FILE = STEP_1_TARGET_FILE.replace(
    `${ORDER_FLOW_ITEM}\n    ],\n    "nodes": [`,
    `${ORDER_FLOW_ITEM},\n${STOCK_FLOW_ITEM}\n    ],\n    "nodes": [`,
);

type Doc = CalmDocLike | null;

const hasOrderFlow = (doc: Doc) => flowsWithTransitions(doc, 3).length >= 1;
const hasTwoFlows = (doc: Doc) => flowsWithTransitions(doc, 2).length >= 2;

export const INTERMEDIATE_09: Lesson = {
    id: 'intermediate-09',
    title: 'Business flows',
    tutorial: { title: 'Model Business Flows', url: 'https://calm.finos.org/tutorials/intermediate/09-business-flows/' },
    chainsFrom: 'intermediate-08',
    editorFile: EDITOR_FILE,
    seedFiles: endFiles(INTERMEDIATE_08),
    steps: [
        {
            id: 'order-flow',
            title: 'Add the order processing flow',
            body:
                'Add a `flows` array at the top level, alongside `nodes` and `relationships`. Give a flow a ' +
                '`unique-id`, `name`, `description`, and a `transitions` array of at least three items, each with ' +
                'a `relationship-unique-id` naming an existing relationship, a `sequence-number`, and a ' +
                '`description`. Trace the customer order from the gateway through to payment. Save your change.',
            hint: { kind: 'file', content: STEP_1_TARGET_FILE },
            check: (state) => hasOrderFlow(state.doc) && state.validation.ok,
        },
        {
            id: 'validate-order-flow',
            title: 'Validate the flow',
            body: 'Run `calm validate -a architectures/ecommerce-platform.json -f pretty`. The summary should report 0 errors.',
            hint: { kind: 'commands', commands: ['calm validate -a architectures/ecommerce-platform.json -f pretty'] },
            check: (state) => hasOrderFlow(state.doc) && validatedEditorFile(state),
        },
        {
            id: 'stock-flow',
            title: 'Add a second flow',
            body:
                'Add a second flow to the `flows` array, for example an inventory stock check. Give it at ' +
                'least two transitions. A transition can reuse the same relationship with the opposite ' +
                '`direction` to model a response flowing back. Save your change.',
            hint: { kind: 'file', content: STEP_3_TARGET_FILE },
            check: (state) => hasTwoFlows(state.doc) && state.validation.ok,
        },
        {
            id: 'validate',
            title: 'Validate the architecture',
            body: 'Run `calm validate -a architectures/ecommerce-platform.json -f pretty` again after saving. The summary should report 0 errors.',
            hint: { kind: 'commands', commands: ['calm validate -a architectures/ecommerce-platform.json -f pretty'] },
            check: (state) => hasTwoFlows(state.doc) && validatedEditorFile(state),
        },
    ],
    completion: {
        heading: 'Lesson complete',
        message:
            'You mapped business processes onto your architecture as flows. Each flow is an ordered sequence ' +
            'of transitions over your relationships, and a transition direction can model a response that flows back.',
        links: [],
    },
};
