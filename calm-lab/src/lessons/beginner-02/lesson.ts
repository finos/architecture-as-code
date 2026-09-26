import { HOME_DIR, type Lesson } from '../types';
import { completeNodes, validatedEditorFile } from '../checks';

const EDITOR_FILE = `${HOME_DIR}/architectures/my-first-architecture.json`;

const SEED_ARCHITECTURE = `{
    "$schema": "https://calm.finos.org/release/1.2/meta/calm.json",
    "nodes": [],
    "relationships": []
}
`;

// Paste-safe hint: the complete target file, so paste-replace-save always produces a valid result.
const STEP_2_TARGET_FILE = `{
    "$schema": "https://calm.finos.org/release/1.2/meta/calm.json",
    "nodes": [
        {
            "unique-id": "payment-service",
            "node-type": "service",
            "name": "Payment Service",
            "description": "Processes card payments"
        }
    ],
    "relationships": []
}
`;

export const BEGINNER_02: Lesson = {
    id: 'beginner-02',
    title: 'Create your first node',
    tutorial: { title: 'Create Your First Node', url: 'https://calm.finos.org/tutorials/beginner/02-first-node/' },
    editorFile: EDITOR_FILE,
    seedFiles: {
        [`${HOME_DIR}/README.md`]:
            'Welcome to the CALM learning lab — a real CALM workspace, entirely in your browser.\n' +
            'This lesson starts from an empty `architectures/my-first-architecture.json`. Follow the steps ' +
            'on the left; type `help` in the terminal to see what you can run.\n',
        [EDITOR_FILE]: SEED_ARCHITECTURE,
    },
    steps: [
        {
            id: 'look',
            title: 'Inspect the empty architecture',
            body:
                'Your workspace has an empty architecture file. In the terminal, run ' +
                '`cat architectures/my-first-architecture.json` to read it, then ' +
                '`calm validate -a architectures/my-first-architecture.json -f pretty` to check it against ' +
                'the real CALM 1.2 schemas. An empty model is valid.',
            hint: {
                kind: 'commands',
                commands: [
                    'cat architectures/my-first-architecture.json',
                    'calm validate -a architectures/my-first-architecture.json -f pretty',
                ],
            },
            check: validatedEditorFile,
        },
        {
            id: 'add-node',
            title: 'Add your first node',
            body:
                'A node needs four properties: `unique-id`, `node-type`, `name` and `description`. Built-in ' +
                'node types include `actor`, `system`, `service`, `database`, `network`, `ldap`, `webclient` and ' +
                '`data-asset`; you can also define a custom type. Add one node to the `nodes` array in the ' +
                'editor and save.',
            hint: { kind: 'file', content: STEP_2_TARGET_FILE },
            check: (state) => completeNodes(state.doc).length >= 1 && state.validation.ok,
        },
        {
            id: 'validate',
            title: 'Validate your node',
            body:
                'Save your change, then run ' +
                '`calm validate -a architectures/my-first-architecture.json -f pretty` again. A warning that ' +
                'the node is not referenced in any relationship is fine — you only have one node so far.',
            hint: {
                kind: 'commands',
                commands: ['calm validate -a architectures/my-first-architecture.json -f pretty'],
            },
            check: (state) => completeNodes(state.doc).length >= 1 && validatedEditorFile(state),
        },
    ],
    completion: {
        heading: 'Lesson complete',
        message: 'You added your first node to a CALM architecture and validated it with the real CALM engine.',
        links: [
            { to: '?lesson=beginner-03', label: 'Next lesson: Connect nodes with relationships' },
        ],
    },
};
