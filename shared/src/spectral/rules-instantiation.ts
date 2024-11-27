import { RulesetDefinition } from '@stoplight/spectral-core';
import { pattern, truthy } from '@stoplight/spectral-functions';
import { numericalPlaceHolder } from './functions/helper-functions';
import { idsAreUnique } from './functions/instantiation/ids-are-unique';
import { nodeIdExists } from './functions/instantiation/node-id-exists';
import { interfaceIdExists } from './functions/instantiation/interface-id-exists';
import { nodeHasRelationship } from './functions/instantiation/node-has-relationship';

const instantiationRules: RulesetDefinition = {
    rules: {

        'instantiation-has-nodes-relationships': {
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

        'instantiation-has-no-empty-properties': {
            description: 'Must not contain string properties set to the empty string or numerical properties set to zero',
            message: 'All properties must be set to a nonempty, nonzero value.',
            severity: 'error',
            given: '$..*',
            then: {
                function: truthy,
            },
        },

        'instantiation-has-no-placeholder-properties-numerical': {
            description: 'Should not contain numerical placeholder properties set to -1',
            message: 'Numerical placeholder (-1) detected in instantiated pattern.',
            severity: 'warn',
            given: '$..*',
            then: {
                function: numericalPlaceHolder,
            },
        },

        'instantiation-has-no-placeholder-properties-string': {
            description: 'Should not contain placeholder values with pattern {{ PLACEHOLDER_NAME }}',
            message: 'String placeholder detected in instantiated pattern.',
            severity: 'warn',
            given: '$..*',
            then: {
                function: pattern,
                functionOptions: {
                    notMatch: '^{{\\s*[A-Z_]+\\s*}}$',
                },
            },
        },

        'instantiation-has-no-placeholder-properties-boolean': {
            description: 'Should not contain placeholder values with pattern {{ BOOLEAN_[property name] }}',
            message: 'Boolean placeholder detected in instantiated pattern.',
            severity: 'warn',
            given: '$..*',
            then: {
                function: pattern,
                functionOptions: {
                    notMatch: '^{{\\s*BOOLEAN_[A-Z_]+\\s*}}$',
                },
            },
        },

        'relationship-references-existing-nodes-in-instantiation': {
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

        'connects-relationship-references-existing-nodes-in-instantiation': {
            description: 'Connects relationships must reference existing nodes',
            severity: 'error',
            message: '{{error}}',
            given: '$.relationships[*].relationship-type.connects.*',
            then: {
                field: 'node',
                function: nodeIdExists
            },
        },

        'referenced-interfaces-defined-in-instantiation': {
            description: 'Referenced interfaces must be defined ',
            severity: 'error',
            message: '{{error}}',
            given: '$.relationships[*].relationship-type.connects.*.interfaces[*]',
            then: {
                function: interfaceIdExists
            },
        },

        'composition-relationships-reference-existing-nodes-in-instantiation': {
            description: 'All nodes in a composition relationship must reference existing nodes',
            severity: 'error',
            message: '{{error}}',
            given: '$.relationships[*].relationship-type.*.nodes[*]',
            then: {
                function: nodeIdExists
            },
        },

        'instantiation-nodes-must-be-referenced': {
            description: 'Nodes must be referenced by at least one relationship.',
            severity: 'warn',
            message: '{{error}}',
            given: '$.nodes[*].unique-id',
            then: {
                function: nodeHasRelationship
            },
        },

        'unique-ids-must-be-unique-in-instantiation': {
            description: 'Unique IDs cannot be reused.',
            severity: 'error',
            message: '{{error}}',
            given: '$',
            then: {
                function: idsAreUnique
            },
        }
    }
};

export default instantiationRules;