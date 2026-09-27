import { HOME_DIR, type Lesson } from '../types';
import { fileJson, standardRequires } from '../checks';
import { INTERMEDIATE_17 } from '../intermediate-17/lesson';
import { endFiles } from '../chain';

const NODE_STD = `${HOME_DIR}/standards/company-node-standard.json`;
const RELATIONSHIP_STD = `${HOME_DIR}/standards/company-relationship-standard.json`;

const NODE_STD_SEED = `{
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://example.com/standards/company-node-standard.json",
    "title": "Company Node Standard"
}
`;

const RELATIONSHIP_STD_SEED = `{
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://example.com/standards/company-relationship-standard.json",
    "title": "Company Relationship Standard"
}
`;

const NODE_STD_FILE = `{
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://example.com/standards/company-node-standard.json",
    "title": "Company Node Standard",
    "allOf": [
        { "$ref": "https://calm.finos.org/release/1.2/meta/core.json#/defs/node" },
        {
            "type": "object",
            "properties": {
                "costCenter": {
                    "type": "string",
                    "pattern": "^CC-[0-9]{4}$",
                    "description": "Cost center code, for example CC-1234."
                },
                "owner": {
                    "type": "string",
                    "description": "The team or individual responsible for this node."
                },
                "environment": {
                    "type": "string",
                    "enum": ["development", "staging", "production"],
                    "description": "Where this node is deployed."
                }
            },
            "required": ["costCenter", "owner"]
        }
    ]
}
`;

const RELATIONSHIP_STD_FILE = `{
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://example.com/standards/company-relationship-standard.json",
    "title": "Company Relationship Standard",
    "allOf": [
        { "$ref": "https://calm.finos.org/release/1.2/meta/core.json#/defs/relationship" },
        {
            "type": "object",
            "properties": {
                "dataClassification": {
                    "type": "string",
                    "enum": ["public", "internal", "confidential", "restricted"],
                    "description": "The sensitivity of the data this relationship carries."
                },
                "encrypted": {
                    "type": "boolean",
                    "description": "Whether the connection is encrypted."
                }
            },
            "required": ["dataClassification", "encrypted"]
        }
    ]
}
`;

export const INTERMEDIATE_18: Lesson = {
    id: 'intermediate-18',
    title: 'Organizational standards',
    summary: 'Write Node and Relationship Standards that extend CALM\'s core schema with required properties.',
    chainsFrom: 'intermediate-17',
    editorFile: INTERMEDIATE_17.editorFile,
    editableFiles: [...INTERMEDIATE_17.editableFiles!, NODE_STD, RELATIONSHIP_STD],
    seedFiles: {
        ...endFiles(INTERMEDIATE_17),
        [NODE_STD]: NODE_STD_SEED,
        [RELATIONSHIP_STD]: RELATIONSHIP_STD_SEED,
    },
    steps: [
        {
            id: 'node-standard',
            title: 'Write a Node Standard',
            body:
                'Open `standards/company-node-standard.json` from the File selector. Add an `allOf` array with a `$ref` ' +
                'to the CALM core node definition, and an object that requires at least one property, such as `costCenter` ' +
                'or `owner`. This Standard does not check any architecture by itself. Save your change.',
            hint: { kind: 'file', path: NODE_STD, content: NODE_STD_FILE },
            check: (state) => standardRequires(fileJson(state, NODE_STD), 'node').length >= 1,
        },
        {
            id: 'relationship-standard',
            title: 'Write a Relationship Standard',
            body:
                'Open `standards/company-relationship-standard.json` from the File selector. Add an `allOf` array with a `$ref` ' +
                'to the CALM core relationship definition, and an object that requires at least one property, such as ' +
                '`dataClassification` or `encrypted`. A Pattern that references this Standard enforces it; the next lesson writes one. Save your change.',
            hint: { kind: 'file', path: RELATIONSHIP_STD, content: RELATIONSHIP_STD_FILE },
            check: (state) => standardRequires(fileJson(state, RELATIONSHIP_STD), 'relationship').length >= 1,
        },
    ],
    completion: {
        heading: 'Lesson complete',
        message:
            'You wrote a Node Standard and a Relationship Standard using `allOf` to extend CALM\'s core schema with your ' +
            'organization\'s required properties. A Standard defines requirements but does not enforce them; a Pattern that ' +
            'references it does.',
        links: [],
    },
};
