import { RulesetDefinition } from '@stoplight/spectral-core';
import { pattern, truthy } from '@stoplight/spectral-functions';
import { numericalPlaceHolder } from './functions/helper-functions';
import nodeIdExists from './functions/pattern/node-id-exists';
import idsAreUnique from './functions/pattern/ids-are-unique';
import nodeHasRelationship from './functions/pattern/node-has-relationship';
import { interfaceIdExists } from './functions/pattern/interface-id-exists';


const patternRules: RulesetDefinition = {
    rules: {
        'pattern-has-nodes-relationships': {
            description: 'Has top level nodes and relationships',
            message: 'Should have nodes and relationships as top level properties on the CALM document',
            severity: 'error',
            given: '$.properties',
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
        'pattern-has-no-empty-properties': {
            description: 'Must not contain string properties set to the empty string or numerical properties set to zero',
            message: 'All properties must be set to a nonempty, nonzero value.',
            severity: 'error',
            given: '$..*',
            then: {
                function: truthy,
            },
        },
        'pattern-has-no-placeholder-properties-numerical': {
            description: 'Should not contain numerical placeholder properties set to -1',
            message: 'Numerical placeholder (-1) detected in instantiated pattern.',
            severity: 'warn',
            given: '$..*',
            then: {
                function: numericalPlaceHolder,
            },
        },
        'pattern-has-no-placeholder-properties-string': {
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
        'connects-relationship-references-existing-nodes-in-pattern': {
            description: 'Connect relationships with const properties must reference existing nodes',
            severity: 'error',
            message: '{{error}}',
            given: '$..connects.source.node',
            then: {
                function: nodeIdExists,
            },
        },
        'group-relationship-references-existing-nodes-in-pattern': {
            description: 'All nodes referenced by a grouping relationship must reference existing nodes',
            severity: 'error',
            message: '{{error}}',
            given: '$..relationship-type..nodes[*]',
            then: {
                function: nodeIdExists,
            },
        },
        'avoid-boolean-properties': {
            description: 'Boolean property detected. Booleans should ideally be avoided as they are closed for extension; have you considered using an enum instead?',
            severity: 'warn',
            message: 'Boolean property detected. Booleans should ideally be avoided as they are closed for extension; have you considered using an enum instead?',
            given: '$..type',
            then: {
                function: pattern,
                functionOptions: {
                    notMatch: /boolean/,
                },
            },
        },
        'relationship-references-existing-nodes-in-pattern': {
            description: 'Relationships with const properties must reference existing nodes',
            severity: 'error',
            message: '{{error}}',
            given: '$..relationship-type.*.*',
            then: [
                {
                    function: nodeIdExists,
                    field: 'actor',
                },
                {
                    function: nodeIdExists,
                    field: 'container',
                },
            ],
        },
        'referenced-interfaces-defined-in-pattern': {
            description: 'Referenced interfaces must be defined',
            severity: 'error',
            message: '{{error}}',
            given: '$..relationship-type.const.connects.*.interfaces[*]',
            then: {
                function: interfaceIdExists,
            },
        },
        'pattern-nodes-must-be-referenced': {
            description: 'Nodes must be referenced by at least one relationship',
            severity: 'warn',
            message: '{{error}}',
            given: '$.properties.nodes.prefixItems[*].properties.unique-id.const',
            then: {
                function: nodeHasRelationship,
            },
        },
        'unique-ids-must-be-unique-in-pattern': {
            description: 'Unique IDs cannot be reused.',
            severity: 'error',
            message: '{{error}}',
            given: '$',
            then: {
                function: idsAreUnique,
            },
        },

    }
};

export default patternRules;