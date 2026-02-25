import { RulesetDefinition } from '@stoplight/spectral-core';
import { pattern, truthy } from '@stoplight/spectral-functions';
import { numericalPlaceHolder } from './functions/helper-functions';
import { idsAreUnique } from './functions/architecture/ids-are-unique';
import { nodeIdExists } from './functions/architecture/node-id-exists';
import { interfaceIdExists } from './functions/architecture/interface-id-exists';
import { nodeHasRelationship } from './functions/architecture/node-has-relationship';
import { interfaceIdExistsOnNode } from './functions/architecture/interface-id-exists-on-node';
import { relationshipIdExists } from './functions/architecture/relationship-id-exists';
import { sequenceNumbersAreUnique } from './functions/architecture/sequence-numbers-are-unique';

const architectureRules: RulesetDefinition = {
    rules: {

        'architecture-has-nodes-relationships': {
            description: 'Has top level nodes and relationships',
            message: 'Should have nodes and relationships as top level properties on the CALM document',
            severity: 'error',
            given: '$',
            then: [
                {
                    field: 'nodes',
                    function: truthy,
                },
                {
                    field: 'relationships',
                    function: truthy,
                },
            ],
        },

        'architecture-has-no-empty-string-properties': {
            description: 'Must not contain string properties set to the empty string',
            message: 'All properties must be set to a nonempty value.',
            severity: 'error',
            given: '$..*@string()',
            then: {
                function: truthy,
            },
        },

        'architecture-has-no-placeholder-properties-numerical': {
            description: 'Should not contain numerical placeholder properties set to -1',
            message: 'Numerical placeholder (-1) detected in architecture.',
            severity: 'warn',
            given: '$..*',
            then: {
                function: numericalPlaceHolder,
            },
        },

        'architecture-has-no-placeholder-properties-string': {
            description: 'Should not contain placeholder values with pattern [[ PLACEHOLDER_NAME ]]',
            message: 'String placeholder detected in architecture.',
            severity: 'warn',
            given: '$..*',
            then: {
                function: pattern,
                functionOptions: {
                    notMatch: '^\\[\\[\\s*[A-Z_]+\\s*\\]\\]$',
                },
            },
        },

        'architecture-has-no-placeholder-properties-boolean': {
            description: 'Should not contain placeholder values with pattern [[ BOOLEAN_[property name] ]]',
            message: 'Boolean placeholder detected in architecture.',
            severity: 'warn',
            given: '$..*',
            then: {
                function: pattern,
                functionOptions: {
                    notMatch: '^\\[\\[\\s*BOOLEAN_[A-Z_]+\\s*\\]\\]$',
                },
            },
        },

        'relationship-references-existing-nodes-in-architecture': {
            description: 'Relationships must reference existing nodes',
            severity: 'error',
            message: '{{error}}',
            given: '$.relationships[*].relationship-type.*',
            then: [
                {
                    field: 'actor',
                    function: nodeIdExists,
                },
                {
                    field: 'container',
                    function: nodeIdExists,
                },
            ],
        },

        'connects-relationship-references-existing-nodes-in-architecture': {
            description: 'Connects relationships must reference existing nodes',
            severity: 'error',
            message: '{{error}}',
            given: '$.relationships[*].relationship-type.connects.*',
            then: {
                field: 'node',
                function: nodeIdExists
            },
        },

        'referenced-interfaces-defined-in-architecture': {
            description: 'Referenced interfaces must be defined',
            severity: 'error',
            message: '{{error}}',
            given: '$.relationships[*].relationship-type.connects.*.interfaces[*]',
            then: {
                function: interfaceIdExists
            },
        },
        
        'referenced-interfaces-defined-on-correct-node-in-architecture': {
            description: 'Connects relationships must reference interfaces that exist on the correct nodes',
            severity: 'error',
            message: '{{error}}',
            given: '$.relationships[*].relationship-type.connects.*',
            then: {
                function: interfaceIdExistsOnNode
            },
        },

        'composition-relationships-reference-existing-nodes-in-architecture': {
            description: 'All nodes in a composition relationship must reference existing nodes',
            severity: 'error',
            message: '{{error}}',
            given: '$.relationships[*].relationship-type.*.nodes[*]',
            then: {
                function: nodeIdExists
            },
        },

        'architecture-nodes-must-be-referenced': {
            description: 'Nodes must be referenced by at least one relationship.',
            severity: 'warn',
            message: '{{error}}',
            given: '$.nodes[*].unique-id',
            then: {
                function: nodeHasRelationship
            },
        },

        'unique-ids-must-be-unique-in-architecture': {
            description: 'Unique IDs cannot be reused.',
            severity: 'error',
            message: '{{error}}',
            given: '$',
            then: {
                function: idsAreUnique
            },
        },

        'flow-transitions-references-existing-relationship-in-architecture': {
            description: 'Flow transitions must reference existing relationships',
            severity: 'error',
            message: '{{error}}',
            given: '$.flows[*].transitions[*]',
            then: {
                field: 'relationship-unique-id',
                function: relationshipIdExists
            }
        },

        'flow-transitions-have-unique-sequence-numbers': {
            description: 'Flows must have unique sequence numbers',
            severity: 'error',
            message: '{{error}}',
            given: '$.flows[*].transitions',
            then: {
                function: sequenceNumbersAreUnique
            }
        }
    }
};

export default architectureRules;