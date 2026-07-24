/**
 * Lesson content and progress checks for the learning lab.
 * Checks are pure functions of a state snapshot assembled by Lab.jsx:
 *   {doc, validation, hasValidatedOk, validatedWithRelationship}
 */

export const HOME_DIR = '/workspace';
export const ARCHITECTURE_FILE = '/workspace/architecture/trading-system.architecture.json';

const SEED_ARCHITECTURE = `{
    "$schema": "https://calm.finos.org/release/1.2/meta/calm.json",
    "nodes": [
        {
            "unique-id": "trading-ui",
            "node-type": "webclient",
            "name": "Trading UI",
            "description": "Web client used by traders to submit and monitor orders"
        }
    ],
    "relationships": []
}
`;

export const SEED_FILES = {
    '/workspace/README.md':
        'Welcome to the CALM learning lab — a real CALM workspace, entirely in your browser.\n' +
        'Follow the steps on the left; type `help` in the terminal to see what you can run.\n',
    [ARCHITECTURE_FILE]: SEED_ARCHITECTURE,
};

export function hasOrdersApiNode(doc) {
    const nodes = Array.isArray(doc?.nodes) ? doc.nodes : [];
    return nodes.some(
        (node) => node?.['unique-id'] === 'orders-api' && node?.['node-type'] === 'service',
    );
}

export function hasConnectsRelationship(doc) {
    const nodes = Array.isArray(doc?.nodes) ? doc.nodes : [];
    const nodeIds = new Set(nodes.map((node) => node?.['unique-id']));
    const relationships = Array.isArray(doc?.relationships) ? doc.relationships : [];
    return relationships.some((relationship) => {
        const connects = relationship?.['relationship-type']?.connects;
        return (
            connects?.source?.node === 'trading-ui' &&
            connects?.destination?.node === 'orders-api' &&
            nodeIds.has('trading-ui') &&
            nodeIds.has('orders-api')
        );
    });
}

export const STEPS = [
    {
        id: 'look-around',
        title: 'Look around',
        body:
            'A CALM architecture is just a file. In the terminal, run `ls` to see the workspace, ' +
            '`cat architecture/trading-system.architecture.json` to read the model, then ' +
            '`calm validate architecture/trading-system.architecture.json` to check it against ' +
            'the real CALM 1.2 schemas.',
        hint:
            'ls\n' +
            'cat architecture/trading-system.architecture.json\n' +
            'calm validate architecture/trading-system.architecture.json',
        check: (state) => state.hasValidatedOk,
    },
    {
        id: 'add-orders-api',
        title: 'Add the Orders API',
        body:
            'The trading UI needs a backend. In the editor, add a second entry to `nodes` with ' +
            '`unique-id` `orders-api` and `node-type` `service` (plus a `name` and `description`), ' +
            'then save with the Save button or Cmd/Ctrl+S.',
        hint:
            '{\n' +
            '    "unique-id": "orders-api",\n' +
            '    "node-type": "service",\n' +
            '    "name": "Orders API",\n' +
            '    "description": "Service that accepts and processes orders"\n' +
            '}',
        check: (state) =>
            Boolean(state.doc) && hasOrdersApiNode(state.doc) && state.validation.ok,
    },
    {
        id: 'connect-them',
        title: 'Connect them',
        body:
            'Nodes on their own are just boxes. Add a `connects` relationship to the ' +
            '`relationships` array — from `trading-ui` to `orders-api` — save, then re-run ' +
            '`calm validate architecture/trading-system.architecture.json`.',
        hint:
            '{\n' +
            '    "unique-id": "trading-ui-connects-orders-api",\n' +
            '    "description": "Traders submit and monitor orders",\n' +
            '    "relationship-type": {\n' +
            '        "connects": {\n' +
            '            "source": { "node": "trading-ui" },\n' +
            '            "destination": { "node": "orders-api" }\n' +
            '        }\n' +
            '    }\n' +
            '}',
        check: (state) =>
            Boolean(state.doc) &&
            hasConnectsRelationship(state.doc) &&
            state.validatedWithRelationship,
    },
];

export const COMPLETION = {
    heading: 'Lesson complete',
    message:
        'You just modelled and validated a CALM architecture in your browser — no install required.',
    links: [
        {to: '/tutorials/beginner/01-setup', label: 'Continue with the full beginner tutorials →'},
        {to: '/learn', label: 'Back to the Learn hub'},
    ],
};
