import { HOME_DIR, type CalmDocLike, type HintFiles, type Lesson, type LessonState } from '../types';
import {
    fileJson, nodes, patternArrayRefs, ranOk, rejected, relationships, standardExample, standardRequires, urlMappingEntries, urlMappingTargets,
} from '../checks';
import { INTERMEDIATE_18, NODE_STD, RELATIONSHIP_STD } from '../intermediate-18/lesson';
import { endFiles } from '../chain';

const COMPLIANT = `${HOME_DIR}/architectures/compliant-test.json`;
const ECOMMERCE = `${HOME_DIR}/architectures/ecommerce-platform.json`;
const MAPPING = `${HOME_DIR}/url-mapping.json`;
const BASE = `${HOME_DIR}/patterns/company-base-pattern.json`;

// `-a` paths resolve the same from the working directory and from the pattern's folder.
const VALIDATE_ECOMMERCE = 'calm validate -p patterns/company-base-pattern.json -a architectures/ecommerce-platform.json -u url-mapping.json -f pretty';
const VALIDATE_COMPLIANT = 'calm validate -p patterns/company-base-pattern.json -a architectures/compliant-test.json -u url-mapping.json -f pretty';

const MAPPING_SEED = `{}
`;

const BASE_SEED = `{
    "$schema": "https://calm.finos.org/release/1.2/meta/calm.json",
    "$id": "https://example.com/patterns/company-base-pattern.json",
    "title": "Company Base Pattern",
    "type": "object",
    "properties": {}
}
`;

const COMPLIANT_SEED = `{
    "$schema": "https://calm.finos.org/release/1.2/meta/calm.json",
    "nodes": [],
    "relationships": []
}
`;

const BASE_FILE = `{
    "$schema": "https://calm.finos.org/release/1.2/meta/calm.json",
    "$id": "https://example.com/patterns/company-base-pattern.json",
    "title": "Company Base Pattern",
    "description": "Enforces the company Node and Relationship Standards on every node and relationship of an architecture.",
    "type": "object",
    "properties": {
        "nodes": {
            "type": "array",
            "items": {
                "$ref": "https://example.com/standards/company-node-standard.json"
            }
        },
        "relationships": {
            "type": "array",
            "items": {
                "$ref": "https://example.com/standards/company-relationship-standard.json"
            }
        }
    },
    "required": ["nodes", "relationships"]
}
`;

const COMPLIANT_FILE = `{
    "$schema": "https://calm.finos.org/release/1.2/meta/calm.json",
    "nodes": [
        {
            "unique-id": "test-service",
            "node-type": "service",
            "name": "Test Service",
            "description": "A service that follows the company Standards.",
            "costCenter": "CC-1234",
            "owner": "test-team",
            "environment": "development"
        },
        {
            "unique-id": "test-database",
            "node-type": "database",
            "name": "Test Database",
            "description": "A database that follows the company Standards.",
            "costCenter": "CC-1235",
            "owner": "test-team",
            "environment": "development"
        }
    ],
    "relationships": [
        {
            "unique-id": "test-service-to-database",
            "description": "The test service stores its data in the test database.",
            "relationship-type": {
                "connects": {
                    "source": { "node": "test-service" },
                    "destination": { "node": "test-database" }
                }
            },
            "dataClassification": "internal",
            "encrypted": true
        }
    ]
}
`;

const standardId = (state: HintFiles, path: string): string | undefined => {
    const id = fileJson(state, path)?.['$id'];
    return typeof id === 'string' && id.length > 0 ? id : undefined;
};

const relativeToHome = (path: string) => path.slice(HOME_DIR.length + 1);
const json = (value: unknown) => `${JSON.stringify(value, null, 4)}\n`;

// The hints follow the learner's Standards: the `$id`s and required properties the checks read.
const TUTORIAL_NODE_ID = 'https://example.com/standards/company-node-standard.json';
const TUTORIAL_RELATIONSHIP_ID = 'https://example.com/standards/company-relationship-standard.json';
const TUTORIAL_BASE_ID = 'https://example.com/patterns/company-base-pattern.json';

const mappingFile = (state: HintFiles) => json({
    [standardId(state, NODE_STD) ?? TUTORIAL_NODE_ID]: relativeToHome(NODE_STD),
    [standardId(state, RELATIONSHIP_STD) ?? TUTORIAL_RELATIONSHIP_ID]: relativeToHome(RELATIONSHIP_STD),
    [standardId(state, BASE) ?? TUTORIAL_BASE_ID]: relativeToHome(BASE),
});

const baseFile = (state: HintFiles) => {
    const base = JSON.parse(BASE_FILE) as { properties: Record<'nodes' | 'relationships', { items: { $ref: string } }> };
    base.properties.nodes.items.$ref = standardId(state, NODE_STD) ?? TUTORIAL_NODE_ID;
    base.properties.relationships.items.$ref = standardId(state, RELATIONSHIP_STD) ?? TUTORIAL_RELATIONSHIP_ID;
    return json(base);
};

const compliantFile = (state: HintFiles) => {
    const doc = JSON.parse(COMPLIANT_FILE) as { nodes: CalmDocLike[]; relationships: CalmDocLike[] };
    const nodeStd = fileJson(state, NODE_STD);
    const relationshipStd = fileJson(state, RELATIONSHIP_STD);
    return json({
        ...doc,
        nodes: doc.nodes.map((node) => ({ ...node, ...standardExample(nodeStd, 'node', node) })),
        relationships: doc.relationships.map((relationship) => ({ ...relationship, ...standardExample(relationshipStd, 'relationship', relationship) })),
    });
};

/** The standard's `$id`, when the mapping sends it to the standard's own file. */
const mappedStandardId = (state: LessonState, path: string): string | undefined => {
    const id = standardId(state, path);
    return id !== undefined && urlMappingTargets(state, MAPPING)[id] === path ? id : undefined;
};

const mappingComplete = (state: LessonState) => {
    const entries = urlMappingEntries(state, MAPPING);
    return entries.length > 0 && entries.every((entry) => entry.exists)
        && mappedStandardId(state, NODE_STD) !== undefined
        && mappedStandardId(state, RELATIONSHIP_STD) !== undefined;
};

const patternRefsStandards = (state: LessonState) => {
    const pattern = fileJson(state, BASE);
    const nodeId = mappedStandardId(state, NODE_STD);
    const relationshipId = mappedStandardId(state, RELATIONSHIP_STD);
    return nodeId !== undefined && relationshipId !== undefined
        && patternArrayRefs(pattern, 'nodes').includes(nodeId)
        && patternArrayRefs(pattern, 'relationships').includes(relationshipId);
};

const hasEvery = (names: string[]) => (item: Record<string, unknown>) =>
    names.every((name) => Object.prototype.hasOwnProperty.call(item, name));

const compliant = (state: LessonState) => {
    const nodeNames = standardRequires(fileJson(state, NODE_STD), 'node');
    const relationshipNames = standardRequires(fileJson(state, RELATIONSHIP_STD), 'relationship');
    return nodeNames.length > 0 && relationshipNames.length > 0
        && nodes(state.doc).length > 0 && nodes(state.doc).every(hasEvery(nodeNames))
        && relationships(state.doc).length > 0 && relationships(state.doc).every(hasEvery(relationshipNames))
        && state.validation.ok;
};

export const INTERMEDIATE_19: Lesson = {
    id: 'intermediate-19',
    title: 'Enforcing standards with patterns',
    tutorial: { title: 'Enforcing Standards with Patterns', url: 'https://calm.finos.org/tutorials/intermediate/19-enforcing-standards/' },
    chainsFrom: 'intermediate-18',
    editorFile: COMPLIANT,
    editableFiles: [COMPLIANT, MAPPING, BASE, NODE_STD, RELATIONSHIP_STD],
    seedFiles: {
        ...endFiles(INTERMEDIATE_18),
        [MAPPING]: MAPPING_SEED,
        [BASE]: BASE_SEED,
        [COMPLIANT]: COMPLIANT_SEED,
    },
    steps: [
        {
            id: 'url-mapping',
            title: 'Map the Standard URLs to local files',
            body:
                'Your Standards have `$id` URLs that do not resolve yet. Open `url-mapping.json` from the File selector. ' +
                'Map the `$id` of each Standard to its local file, with a path relative to the folder of `url-mapping.json`. ' +
                'Each path must name a file that exists. Save your change.',
            hint: { kind: 'file', path: MAPPING, content: mappingFile },
            check: mappingComplete,
        },
        {
            id: 'base-pattern',
            title: 'Write the company base pattern',
            body:
                'Open `patterns/company-base-pattern.json`. Under `properties`, add `nodes` and `relationships` arrays. ' +
                'Give each one an `items` schema that `$ref`s the `$id` of the matching Standard. ' +
                'Use `items`, not `prefixItems`, so that the Standards apply to every node and relationship. Save your change.',
            hint: { kind: 'file', path: BASE, content: baseFile },
            check: patternRefsStandards,
        },
        {
            id: 'see-it-fail',
            title: 'See the e-commerce architecture fail',
            body:
                `Run \`${VALIDATE_ECOMMERCE}\`. This command is meant to fail. ` +
                'The e-commerce architecture does not have the Standard properties, so the errors show ' +
                '`must have required property` for each node and relationship that does not have them.',
            hint: { kind: 'commands', commands: [{ run: VALIDATE_ECOMMERCE, expect: 'failure' }] },
            check: (state) => rejected(state, { architecture: ECOMMERCE, pattern: BASE, mapping: MAPPING }),
        },
        {
            id: 'compliant',
            title: 'Write a compliant architecture',
            body:
                'In `architectures/compliant-test.json`, add at least one node and one relationship between your nodes. ' +
                'Give each node every property that your Node Standard requires, and give each relationship every property ' +
                'that your Relationship Standard requires. Save your change.',
            hint: { kind: 'file', content: compliantFile },
            check: compliant,
        },
        {
            id: 'validate-compliant',
            title: 'Validate the compliant architecture',
            body:
                `Run \`${VALIDATE_COMPLIANT}\`. The summary shows 0 errors. ` +
                'The base pattern checks only the Standard properties, so it works for any architecture.',
            hint: { kind: 'commands', commands: [VALIDATE_COMPLIANT] },
            check: (state) => compliant(state) && patternRefsStandards(state)
                && ranOk(state, 'validate', { architecture: state.editorFile, pattern: BASE, mapping: MAPPING }),
        },
    ],
    completion: {
        heading: 'Lesson complete',
        message:
            'You mapped your Standard URLs to local files and wrote a base pattern that enforces your Standards. ' +
            'The pattern uses `items`, so it applies to every node and relationship without fixing the structure of the architecture.',
        links: [],
    },
};
