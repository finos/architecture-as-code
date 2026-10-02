import { HOME_DIR, type CalmDocLike, type HintFiles, type Lesson, type LessonState } from '../types';
import {
    everyHas, fileJson, nodeById, nodes, prefixItemConsts, ranOk, relationships, standardRequires, withStandard,
} from '../checks';
import { INTERMEDIATE_19 } from '../intermediate-19/lesson';
import { NODE_STD, RELATIONSHIP_STD } from '../intermediate-18/lesson';
import { endFiles } from '../chain';

const GENERATED = `${HOME_DIR}/architectures/generated-webapp.json`;
const WEB_APP = `${HOME_DIR}/patterns/web-app-pattern.json`;
const BASE = `${HOME_DIR}/patterns/company-base-pattern.json`;
const MAPPING = `${HOME_DIR}/url-mapping.json`;

// `-a` paths resolve the same from the working directory and from the pattern's folder.
const VALIDATE_WEB_APP = 'calm validate -p patterns/web-app-pattern.json -a architectures/generated-webapp.json -f pretty';
const VALIDATE_STANDARDS = 'calm validate -p patterns/company-base-pattern.json -a architectures/generated-webapp.json -u url-mapping.json -f pretty';

const NODES_FILE = `{
    "$schema": "https://example.com/patterns/web-app-pattern.json",
    "nodes": [
        {
            "unique-id": "web-frontend",
            "node-type": "webclient",
            "name": "Web Frontend",
            "description": "Browser application that customers use to reach the service.",
            "costCenter": "CC-1001",
            "owner": "frontend-team",
            "environment": "production"
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
            ],
            "costCenter": "CC-2001",
            "owner": "backend-team",
            "environment": "production"
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
            ],
            "costCenter": "CC-3001",
            "owner": "data-team",
            "environment": "production"
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

const RELATIONSHIPS_FILE = `{
    "$schema": "https://example.com/patterns/web-app-pattern.json",
    "nodes": [
        {
            "unique-id": "web-frontend",
            "node-type": "webclient",
            "name": "Web Frontend",
            "description": "Browser application that customers use to reach the service.",
            "costCenter": "CC-1001",
            "owner": "frontend-team",
            "environment": "production"
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
            ],
            "costCenter": "CC-2001",
            "owner": "backend-team",
            "environment": "production"
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
            ],
            "costCenter": "CC-3001",
            "owner": "data-team",
            "environment": "production"
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
            },
            "dataClassification": "internal",
            "encrypted": true
        },
        {
            "unique-id": "api-to-database",
            "description": "The API reads and writes application data.",
            "relationship-type": {
                "connects": {
                    "source": { "node": "api-service" },
                    "destination": { "node": "app-database" }
                }
            },
            "dataClassification": "confidential",
            "encrypted": true
        }
    ]
}
`;

// The steps say to keep what the web application pattern fixes: each node's unique-id and node-type,
// and each relationship's unique-id.
// The end files of lesson 19: the Standards the tutorial values in the hints are for.
const TUTORIAL = { files: endFiles(INTERMEDIATE_19) };

// The file hints fill in the properties that the learner's Standards require, for the items each step is about.
const withStandards = (file: string, relationshipsToo: boolean) => (state: HintFiles) => {
    const doc = JSON.parse(file) as { nodes: CalmDocLike[]; relationships: CalmDocLike[] };
    const nodeStd = fileJson(state, NODE_STD);
    const relationshipStd = fileJson(state, RELATIONSHIP_STD);
    return `${JSON.stringify({
        ...doc,
        nodes: doc.nodes.map((node) => withStandard(node, 'node', nodeStd, fileJson(TUTORIAL, NODE_STD))),
        relationships: relationshipsToo
            ? doc.relationships.map((relationship) => withStandard(relationship, 'relationship', relationshipStd, fileJson(TUTORIAL, RELATIONSHIP_STD)))
            : doc.relationships,
    }, null, 4)}\n`;
};

const keepsWebAppShape = (state: LessonState) => {
    const pattern = fileJson(state, WEB_APP);
    const ids = prefixItemConsts(pattern, 'nodes', 'unique-id');
    const types = prefixItemConsts(pattern, 'nodes', 'node-type');
    const relationshipIds = new Set(relationships(state.doc).map((relationship) => relationship['unique-id']));
    return ids.length > 0
        && ids.every((id, index) => {
            const node = typeof id === 'string' ? nodeById(state.doc, id) : undefined;
            return node !== undefined && (types[index] === undefined || node['node-type'] === types[index]);
        })
        && prefixItemConsts(pattern, 'relationships', 'unique-id').every((id) => relationshipIds.has(id));
};

const nodesCompliant = (state: LessonState) =>
    everyHas(nodes(state.doc), standardRequires(fileJson(state, NODE_STD), 'node')) && keepsWebAppShape(state) && state.validation.ok;

const relationshipsCompliant = (state: LessonState) =>
    everyHas(relationships(state.doc), standardRequires(fileJson(state, RELATIONSHIP_STD), 'relationship')) && keepsWebAppShape(state)
    && state.validation.ok;

const validatedStandards = (state: LessonState) =>
    nodesCompliant(state) && relationshipsCompliant(state)
    && ranOk(state, 'validate', { architecture: state.editorFile, pattern: BASE, mapping: MAPPING });

export const INTERMEDIATE_20: Lesson = {
    id: 'intermediate-20',
    title: 'Multi-pattern validation',
    tutorial: { title: 'Multi-Pattern Validation', url: 'https://calm.finos.org/tutorials/intermediate/20-multi-pattern-validation/' },
    chainsFrom: 'intermediate-19',
    editorFile: GENERATED,
    editableFiles: [GENERATED, NODE_STD, RELATIONSHIP_STD],
    seedFiles: TUTORIAL.files,
    steps: [
        {
            id: 'node-standards',
            title: 'Add the Standard properties to the nodes',
            body:
                'The editor shows `architectures/generated-webapp.json` from the patterns lesson. ' +
                'Give each node every property that your Node Standard requires, for example `costCenter` and `owner`. ' +
                'Keep each `unique-id`, `node-type` and `name` that the web application pattern requires. Save your change.',
            hint: { kind: 'file', content: withStandards(NODES_FILE, false) },
            check: nodesCompliant,
        },
        {
            id: 'relationship-standards',
            title: 'Add the Standard properties to the relationships',
            body:
                'Give each relationship every property that your Relationship Standard requires, ' +
                'for example `dataClassification` and `encrypted`. Keep each `unique-id` and `relationship-type`. Save your change.',
            hint: { kind: 'file', content: withStandards(RELATIONSHIPS_FILE, true) },
            check: relationshipsCompliant,
        },
        {
            id: 'validate-standards',
            title: 'Validate against the standards pattern',
            body:
                `Run \`${VALIDATE_STANDARDS}\`. The summary shows 0 errors. ` +
                'The base pattern checks the Standard properties on each node and relationship.',
            hint: { kind: 'commands', commands: [VALIDATE_STANDARDS] },
            check: validatedStandards,
        },
        {
            id: 'validate-both',
            title: 'Validate against both patterns',
            body:
                `Run \`${VALIDATE_WEB_APP}\` for the structure, and \`${VALIDATE_STANDARDS}\` for the Standards. ` +
                'Both summaries show 0 errors. The step needs both runs after your last save.',
            hint: { kind: 'commands', commands: [VALIDATE_WEB_APP, VALIDATE_STANDARDS] },
            check: (state) => validatedStandards(state) && ranOk(state, 'validate', { architecture: state.editorFile, pattern: WEB_APP }),
        },
    ],
    completion: {
        heading: 'Intermediate lab track complete',
        message:
            'You validated one architecture against a structural pattern and a standards pattern. ' +
            'The structural pattern checks the shape of one architecture, and the base pattern applies your Standards to every architecture. ' +
            'This completes the intermediate lessons in the lab. ' +
            'Tutorials 11 to 16 (docify, widgets, templates and AI advisors) do not have a lab lesson yet.',
        links: [],
    },
};
