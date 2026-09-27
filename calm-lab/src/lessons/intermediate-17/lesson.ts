import { HOME_DIR, type Lesson, type LessonState } from '../types';
import {
    fileJson, hasDescription, hasPlaceholder, nodeById, nodeInterfaces, nodes, patternNodeIds, patternRequires, ranOk, rejected, relationships,
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

const ENHANCED_FILE = `{
    "$schema": "https://example.com/patterns/web-app-pattern.json",
    "nodes": [
        {
            "unique-id": "web-frontend",
            "node-type": "webclient",
            "name": "Web Frontend",
            "description": "Browser application that customers use to reach the service."
        },
        {
            "unique-id": "api-service",
            "node-type": "service",
            "name": "API Service",
            "description": "REST API that holds the business logic of the web application.",
            "interfaces": [
                {
                    "unique-id": "api-service-https",
                    "host": "api.example.com",
                    "port": 443
                }
            ]
        },
        {
            "unique-id": "app-database",
            "node-type": "database",
            "name": "Application Database",
            "description": "PostgreSQL database that stores the application data.",
            "interfaces": [
                {
                    "unique-id": "app-database-postgres",
                    "host": "db.example.com",
                    "port": 5432
                }
            ]
        }
    ],
    "relationships": [
        {
            "unique-id": "frontend-to-api",
            "description": "The web frontend calls the API over HTTPS.",
            "relationship-type": {
                "connects": {
                    "source": { "node": "web-frontend" },
                    "destination": { "node": "api-service" }
                }
            }
        },
        {
            "unique-id": "api-to-database",
            "description": "The API reads and writes application data.",
            "relationship-type": {
                "connects": {
                    "source": { "node": "api-service" },
                    "destination": { "node": "app-database" }
                }
            }
        }
    ]
}
`;

const patternComplete = (state: LessonState) => {
    const required = patternRequires(fileJson(state, PATTERN));
    return required.nodes >= 3 && required.relationships >= 2;
};

const enhanced = (state: LessonState) => {
    const ids = patternNodeIds(fileJson(state, PATTERN));
    return ids.length >= 3
        && ids.every((id) => nodeById(state.doc, id) !== undefined)
        && nodes(state.doc).some((node) => nodeInterfaces(node).length > 0)
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
    summary: 'Write a pattern, generate an architecture from it, and validate architectures against it.',
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
                'Use `prefixItems` with `const` values, set `minItems` and `maxItems` to the item count, and save your change.',
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
            check: (state) => ranOk(state, 'generate', { pattern: PATTERN, output: state.editorFile }),
        },
        {
            id: 'validate-pattern',
            title: 'Validate against the pattern',
            body:
                `Run \`${VALIDATE}\`. The summary shows 0 errors. There is one warning for each \`[[ DESCRIPTION ]]\` ` +
                'placeholder that the generate command wrote. Warnings are not errors.',
            hint: { kind: 'commands', commands: [VALIDATE] },
            check: validatedAgainstPattern,
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
                'description, and add a `description` to each relationship. Add `interfaces` with a `host` and a `port` ' +
                'to the service and the database. Keep each `unique-id`, `node-type` and `name` that the pattern requires, and save your change.',
            hint: { kind: 'file', content: ENHANCED_FILE },
            check: enhanced,
        },
        {
            id: 'validate-enhanced',
            title: 'Validate the enhanced architecture',
            body:
                `Run \`${VALIDATE}\` again. The summary shows 0 errors and 0 warnings. ` +
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
