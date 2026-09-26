import { HOME_DIR, type CalmDocLike, type Lesson } from '../types';
import { validatedEditorFile } from '../checks';

const EDITOR_FILE = `${HOME_DIR}/architecture/trading-system.architecture.json`;

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

/**
 * Paste-safe hints: for the editing steps the hint is the COMPLETE
 * target file, so paste-replace-save always produces a valid result.
 */
const STEP_2_TARGET_FILE = `{
    "$schema": "https://calm.finos.org/release/1.2/meta/calm.json",
    "nodes": [
        {
            "unique-id": "trading-ui",
            "node-type": "webclient",
            "name": "Trading UI",
            "description": "Web client used by traders to submit and monitor orders"
        },
        {
            "unique-id": "orders-api",
            "node-type": "service",
            "name": "Orders API",
            "description": "Service that accepts and processes orders"
        }
    ],
    "relationships": []
}
`;

const STEP_3_TARGET_FILE = `{
    "$schema": "https://calm.finos.org/release/1.2/meta/calm.json",
    "nodes": [
        {
            "unique-id": "trading-ui",
            "node-type": "webclient",
            "name": "Trading UI",
            "description": "Web client used by traders to submit and monitor orders"
        },
        {
            "unique-id": "orders-api",
            "node-type": "service",
            "name": "Orders API",
            "description": "Service that accepts and processes orders"
        }
    ],
    "relationships": [
        {
            "unique-id": "trading-ui-connects-orders-api",
            "description": "Traders submit and monitor orders",
            "relationship-type": {
                "connects": {
                    "source": { "node": "trading-ui" },
                    "destination": { "node": "orders-api" }
                }
            }
        }
    ]
}
`;

export function hasOrdersApiNode(doc: CalmDocLike | null | undefined): boolean {
    const nodes = Array.isArray(doc?.nodes) ? (doc.nodes as Record<string, unknown>[]) : [];
    return nodes.some(
        (node) => node?.['unique-id'] === 'orders-api' && node?.['node-type'] === 'service',
    );
}

export function hasConnectsRelationship(doc: CalmDocLike | null | undefined): boolean {
    const nodes = Array.isArray(doc?.nodes) ? (doc.nodes as Record<string, unknown>[]) : [];
    const nodeIds = new Set(nodes.map((node) => node?.['unique-id']));
    const relationships = Array.isArray(doc?.relationships) ? (doc.relationships as Record<string, unknown>[]) : [];
    return relationships.some((relationship) => {
        const relationshipType = relationship?.['relationship-type'] as Record<string, unknown> | undefined;
        const connects = relationshipType?.connects as { source?: { node?: unknown }; destination?: { node?: unknown } } | undefined;
        return (
            connects?.source?.node === 'trading-ui' &&
            connects?.destination?.node === 'orders-api' &&
            nodeIds.has('trading-ui') &&
            nodeIds.has('orders-api')
        );
    });
}

export const QUICK_START: Lesson = {
    id: 'quick-start',
    title: 'Quick start: model a trading system',
    summary: 'Read, change and validate a small CALM architecture.',
    editorFile: EDITOR_FILE,
    seedFiles: {
        [`${HOME_DIR}/README.md`]:
            'Welcome to the CALM learning lab — a real CALM workspace, entirely in your browser.\n' +
            'Follow the steps on the left; type `help` in the terminal to see what you can run.\n',
        [EDITOR_FILE]: SEED_ARCHITECTURE,
    },
    steps: [
        {
            id: 'look-around',
            title: 'Look around',
            body:
                'A CALM architecture is just a file. In the terminal, run `ls` to see the workspace, ' +
                '`cat architecture/trading-system.architecture.json` to read the model, then ' +
                '`calm validate -a architecture/trading-system.architecture.json -f pretty` to check it against ' +
                'the real CALM 1.2 schemas.',
            hint: {
                kind: 'commands',
                commands: [
                    'ls',
                    'cat architecture/trading-system.architecture.json',
                    'calm validate -a architecture/trading-system.architecture.json -f pretty',
                ],
            },
            check: validatedEditorFile,
        },
        {
            id: 'add-orders-api',
            title: 'Add the Orders API',
            body:
                'The trading UI needs a backend. In the editor, add a second entry to `nodes` with ' +
                '`unique-id` `orders-api` and `node-type` `service` (plus a `name` and `description`), ' +
                'then save with the Save button or Cmd/Ctrl+S.',
            hint: { kind: 'file', content: STEP_2_TARGET_FILE },
            check: (state) => Boolean(state.doc) && hasOrdersApiNode(state.doc) && state.validation.ok,
        },
        {
            id: 'connect-them',
            title: 'Connect them',
            body:
                'Nodes on their own are just boxes. Add a `connects` relationship to the ' +
                '`relationships` array — from `trading-ui` to `orders-api` — save, then re-run ' +
                '`calm validate -a architecture/trading-system.architecture.json -f pretty`.',
            hint: { kind: 'file', content: STEP_3_TARGET_FILE },
            // State-based on purpose: saving runs the same engine as
            // `calm validate` (JSON Schema plus the Spectral rules, via
            // @finos/calm-shared/browser), so the tick must not additionally
            // require a terminal validate — learners who pasted the hint and
            // saved saw an all-green editor while the step refused to complete.
            check: (state) => Boolean(state.doc) && hasConnectsRelationship(state.doc) && state.validation.ok,
        },
    ],
    completion: {
        heading: 'Lesson complete',
        message:
            'You just modelled and validated a CALM architecture in your browser — no install required.',
        links: [
            {
                to: 'https://calm.finos.org/tutorials/beginner/01-setup',
                label: 'Continue with the full beginner tutorials →',
            },
            { to: 'https://calm.finos.org/learn', label: 'Back to the Learn hub' },
        ],
    },
};
