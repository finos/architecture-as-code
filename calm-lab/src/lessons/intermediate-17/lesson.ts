import { HOME_DIR, type CalmDocLike, type HintFiles, type Lesson, type LessonState } from '../types';
import {
    fileJson, hasDescription, hasPlaceholder, nodeById, nodeInterfaces, nodes, patternConnects, patternItemConsts, patternNodeIds, patternNodeTypes,
    patternRequires,
    ranOk, rejected, relationships,
} from '../checks';
import { INTERMEDIATE_10 } from '../intermediate-10/lesson';
import { endFiles } from '../chain';

const PATTERN = `${HOME_DIR}/patterns/web-app-pattern.json`;
const GENERATED = `${HOME_DIR}/architectures/generated-webapp.json`;
const BROKEN = `${HOME_DIR}/architectures/broken-webapp.json`;

const GENERATE = 'calm generate -p patterns/web-app-pattern.json -o architectures/generated-webapp.json';
// `-a` paths resolve the same from the working directory and from the pattern's folder.
const VALIDATE = 'calm validate -p patterns/web-app-pattern.json -a architectures/generated-webapp.json -f pretty';
const VALIDATE_BROKEN = 'calm validate -p patterns/web-app-pattern.json -a architectures/broken-webapp.json -f pretty';

const PATTERN_SEED = `{
    "$schema": "https://calm.finos.org/release/1.2/meta/calm.json",
    "$id": "https://example.com/patterns/web-app-pattern.json",
    "title": "Web Application Pattern",
    "type": "object",
    "properties": {}
}
`;

// The file `calm generate` overwrites; seeded so the editor has a file to open.
const GENERATED_SEED = `{
    "$schema": "https://calm.finos.org/release/1.2/meta/calm.json",
    "nodes": [],
    "relationships": []
}
`;

const PATTERN_FILE = `{
    "$schema": "https://calm.finos.org/release/1.2/meta/calm.json",
    "$id": "https://example.com/patterns/web-app-pattern.json",
    "title": "Web Application Pattern",
    "description": "A 3-tier web application: a web frontend, an API service and a database.",
    "type": "object",
    "properties": {
        "nodes": {
            "type": "array",
            "minItems": 3,
            "maxItems": 3,
            "prefixItems": [
                {
                    "$ref": "https://calm.finos.org/release/1.2/meta/core.json#/defs/node",
                    "type": "object",
                    "properties": {
                        "unique-id": { "const": "web-frontend" },
                        "node-type": { "const": "webclient" },
                        "name": { "const": "Web Frontend" }
                    }
                },
                {
                    "$ref": "https://calm.finos.org/release/1.2/meta/core.json#/defs/node",
                    "type": "object",
                    "properties": {
                        "unique-id": { "const": "api-service" },
                        "node-type": { "const": "service" },
                        "name": { "const": "API Service" }
                    }
                },
                {
                    "$ref": "https://calm.finos.org/release/1.2/meta/core.json#/defs/node",
                    "type": "object",
                    "properties": {
                        "unique-id": { "const": "app-database" },
                        "node-type": { "const": "database" },
                        "name": { "const": "Application Database" }
                    }
                }
            ]
        },
        "relationships": {
            "type": "array",
            "minItems": 2,
            "maxItems": 2,
            "prefixItems": [
                {
                    "$ref": "https://calm.finos.org/release/1.2/meta/core.json#/defs/relationship",
                    "type": "object",
                    "properties": {
                        "unique-id": { "const": "frontend-to-api" },
                        "relationship-type": {
                            "const": {
                                "connects": {
                                    "source": { "node": "web-frontend" },
                                    "destination": { "node": "api-service" }
                                }
                            }
                        }
                    }
                },
                {
                    "$ref": "https://calm.finos.org/release/1.2/meta/core.json#/defs/relationship",
                    "type": "object",
                    "properties": {
                        "unique-id": { "const": "api-to-database" },
                        "relationship-type": {
                            "const": {
                                "connects": {
                                    "source": { "node": "api-service" },
                                    "destination": { "node": "app-database" }
                                }
                            }
                        }
                    }
                }
            ]
        }
    },
    "required": ["nodes", "relationships"]
}
`;

// What the tutorial's copy-and-rename gives: a valid architecture whose API node is not `api-service`.
const BROKEN_SEED = `{
    "$schema": "https://example.com/patterns/web-app-pattern.json",
    "nodes": [
        {
            "unique-id": "web-frontend",
            "node-type": "webclient",
            "name": "Web Frontend",
            "description": "[[ DESCRIPTION ]]"
        },
        {
            "unique-id": "backend-api",
            "node-type": "service",
            "name": "API Service",
            "description": "[[ DESCRIPTION ]]"
        },
        {
            "unique-id": "app-database",
            "node-type": "database",
            "name": "Application Database",
            "description": "[[ DESCRIPTION ]]"
        }
    ],
    "relationships": [
        {
            "unique-id": "frontend-to-api",
            "relationship-type": {
                "connects": {
                    "source": { "node": "web-frontend" },
                    "destination": { "node": "backend-api" }
                }
            }
        },
        {
            "unique-id": "api-to-database",
            "relationship-type": {
                "connects": {
                    "source": { "node": "backend-api" },
                    "destination": { "node": "app-database" }
                }
            }
        }
    ]
}
`;

// The tutorial's enhancements, by node-type and by the node-types a relationship connects.
const NODE_ENHANCEMENTS: Record<string, { description: string; interface?: { name: string; host: string; port: number } }> = {
    webclient: { description: 'Browser application that customers use to reach the service.' },
    service: {
        description: 'REST API that holds the business logic of the web application.',
        interface: { name: 'https', host: 'api.example.com', port: 443 },
    },
    database: {
        description: 'PostgreSQL database that stores the application data.',
        interface: { name: 'postgres', host: 'db.example.com', port: 5432 },
    },
};
const RELATIONSHIP_DESCRIPTIONS: Record<string, string> = {
    'webclient>service': 'The web frontend calls the API over HTTPS.',
    'service>database': 'The API reads and writes application data.',
};

// The architecture `calm generate` writes for the learner's pattern, with the placeholders filled in:
// their own ids keep the next validate passing. The tutorial's pattern until theirs has its three nodes.
const enhancedFile = (state: HintFiles): string => {
    const learner = fileJson(state, PATTERN);
    const pattern = patternNodeIds(learner).length === 3 ? learner : JSON.parse(PATTERN_FILE) as CalmDocLike;
    const patternNodes = patternItemConsts(pattern, 'nodes');
    const typeOf = (id: unknown) => String(patternNodes.find((node) => node['unique-id'] === id)?.['node-type']);
    const nodeList = patternNodes.map((node) => {
        const id = String(node['unique-id']);
        const enhancement = NODE_ENHANCEMENTS[String(node['node-type'])];
        const iface = enhancement?.interface;
        return {
            ...node,
            name: node['name'] ?? id,
            description: node['description'] ?? enhancement?.description ?? `The ${id} node.`,
            ...(iface && { interfaces: [{ 'unique-id': `${id}-${iface.name}`, host: iface.host, port: iface.port }] }),
        };
    });
    const relationshipList = patternItemConsts(pattern, 'relationships').map((relationship) => {
        const connects = (relationship['relationship-type'] as { connects?: { source?: { node?: unknown }; destination?: { node?: unknown } } } | undefined)?.connects;
        const link = `${typeOf(connects?.source?.node)}>${typeOf(connects?.destination?.node)}`;
        return {
            'unique-id': relationship['unique-id'],
            description: relationship['description'] ?? RELATIONSHIP_DESCRIPTIONS[link] ?? 'Connects two nodes of the pattern.',
            ...relationship,
        };
    });
    return `${JSON.stringify({ $schema: pattern?.['$id'], nodes: nodeList, relationships: relationshipList }, null, 4)}\n`;
};

const NODE_TYPES = ['database', 'service', 'webclient'];

// Three constant nodes (a webclient, a service and a database) and two constant connects between them.
const patternComplete = (state: LessonState) => {
    const pattern = fileJson(state, PATTERN);
    const required = patternRequires(pattern);
    const ids = patternNodeIds(pattern);
    const types = patternNodeTypes(pattern).map(String).sort();
    const links = patternConnects(pattern);
    return required.nodes === 3 && required.relationships === 2 && ids.length === 3
        && types.join() === NODE_TYPES.join()
        && links.length === 2 && links.every((link) => link !== undefined && ids.includes(link.source) && ids.includes(link.destination));
};

const enhanced = (state: LessonState) => {
    const ids = patternNodeIds(fileJson(state, PATTERN));
    return ids.length === 3
        && ids.every((id) => nodeById(state.doc, id) !== undefined)
        // The service and the database, by count: the pattern may give its nodes any node-type.
        && nodes(state.doc).filter((node) => nodeInterfaces(node).length > 0).length >= 2
        && relationships(state.doc).length > 0
        && relationships(state.doc).every(hasDescription)
        && !hasPlaceholder(state.doc)
        && state.validation.ok;
};

const validatedAgainstPattern = (state: LessonState) =>
    ranOk(state, 'validate', { architecture: state.editorFile, pattern: PATTERN });

export const INTERMEDIATE_17: Lesson = {
    id: 'intermediate-17',
    title: 'Introduction to patterns',
    tutorial: { title: 'Introduction to CALM Patterns', url: 'https://calm.finos.org/tutorials/intermediate/17-patterns/' },
    chainsFrom: 'intermediate-10',
    editorFile: GENERATED,
    editableFiles: [GENERATED, PATTERN, BROKEN],
    seedFiles: {
        ...endFiles(INTERMEDIATE_10),
        [PATTERN]: PATTERN_SEED,
        [GENERATED]: GENERATED_SEED,
        [BROKEN]: BROKEN_SEED,
    },
    steps: [
        {
            id: 'write-pattern',
            title: 'Write the pattern',
            body:
                'Open `patterns/web-app-pattern.json` from the File selector. Make it require exactly three nodes ' +
                '(a `webclient`, a `service` and a `database`) and two `connects` relationships between them. ' +
                'Use `prefixItems` with `const` values, and give each node a `const` `unique-id`. ' +
                'Set `minItems` and `maxItems` to the item count, and save your change.',
            hint: { kind: 'file', path: PATTERN, content: PATTERN_FILE },
            check: patternComplete,
        },
        {
            id: 'generate',
            title: 'Generate an architecture',
            body:
                `Run \`${GENERATE}\`. The command writes an architecture with each node and relationship that the ` +
                'pattern requires. Open `architectures/generated-webapp.json` to see the result.',
            hint: { kind: 'commands', commands: [GENERATE] },
            check: (state) => patternComplete(state) && ranOk(state, 'generate', { pattern: PATTERN, output: state.editorFile }),
        },
        {
            id: 'validate-pattern',
            title: 'Validate against the pattern',
            body:
                `Run \`${VALIDATE}\`. The summary shows 0 errors. There is one warning for each \`[[ DESCRIPTION ]]\` ` +
                'placeholder that the generate command wrote. Warnings are not errors.',
            hint: { kind: 'commands', commands: [VALIDATE] },
            check: (state) => patternComplete(state) && validatedAgainstPattern(state),
        },
        {
            id: 'see-it-fail',
            title: 'See a broken architecture fail',
            body:
                '`architectures/broken-webapp.json` is a generated architecture with the `unique-id` of one node changed. ' +
                `Run \`${VALIDATE_BROKEN}\`. This command is meant to fail. The errors show ` +
                '`must be equal to constant` for each `unique-id` and relationship that does not match the pattern.',
            hint: { kind: 'commands', commands: [{ run: VALIDATE_BROKEN, expect: 'failure' }] },
            check: (state) => rejected(state, { architecture: BROKEN, pattern: PATTERN }),
        },
        {
            id: 'enhance',
            title: 'Enhance the generated architecture',
            body:
                'In `architectures/generated-webapp.json`, replace each `[[ DESCRIPTION ]]` placeholder with a real ' +
                'description, and add a `description` to each relationship. Add `interfaces` with a `unique-id`, a `host` and a `port` ' +
                'to the service and the database. Keep each `unique-id`, `node-type` and `name` that the pattern requires, and save your change.',
            hint: { kind: 'file', content: enhancedFile },
            check: enhanced,
        },
        {
            id: 'validate-enhanced',
            title: 'Validate the enhanced architecture',
            body:
                `Run \`${VALIDATE}\` again. The summary shows 0 errors and no placeholder warnings. ` +
                'The pattern checks only what it specifies, so extra descriptions and interfaces do not break it.',
            hint: { kind: 'commands', commands: [VALIDATE] },
            check: (state) => enhanced(state) && validatedAgainstPattern(state),
        },
    ],
    completion: {
        heading: 'Lesson complete',
        message:
            'You wrote a pattern, generated an architecture from it, and validated architectures against it. ' +
            'One pattern creates the shape of a new architecture and checks that an existing architecture keeps that shape.',
        links: [],
    },
};
