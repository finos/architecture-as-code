import { RulesetDefinition } from '@stoplight/spectral-core';
import { falsy, pattern, truthy, length, xor } from '@stoplight/spectral-functions';
import { numericalPlaceHolder } from './functions/helper-functions';
import nodeIdExists from './functions/pattern/node-id-exists';
import idsAreUnique from './functions/pattern/ids-are-unique';
import nodeHasRelationship from './functions/pattern/node-has-relationship';
import { interfaceIdExists } from './functions/pattern/interface-id-exists';
import { interfaceIdExistsOnNode } from './functions/pattern/interface-id-exists-on-node';
import { isDefinedInOneOfOrAnyOf } from './functions/pattern/is-defined-in-oneof-or-anyof';


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
            message: 'Numerical placeholder (-1) detected in architecture.',
            severity: 'warn',
            given: '$..*',
            then: {
                function: numericalPlaceHolder,
            },
        },
        'pattern-has-no-placeholder-properties-string': {
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
        'group-relationship-with-const-nodes-references-existing-nodes-in-pattern': {
            description: 'All nodes referenced by a grouping relationship must reference existing nodes',
            severity: 'error',
            message: '{{error}}',
            given: '$..relationship-type..nodes.const[*]',
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
        'referenced-interfaces-defined-on-correct-node-in-pattern': {
            description: 'Connects relationships must reference interfaces that exist on the correct nodes',
            severity: 'error',
            message: '{{error}}',
            given: '$..relationship-type.const.connects.*',
            then: {
                function: interfaceIdExistsOnNode
            },
        },
        'pattern-nodes-must-be-referenced': {
            description: 'Nodes must be referenced by at least one relationship',
            severity: 'warn',
            message: '{{error}}',
            given: [
                '$.properties.nodes.prefixItems[*].properties.unique-id.const',
                '$.properties.nodes.items.oneOf[*].properties.unique-id.const',
                '$.properties.nodes.items.anyOf[*].properties.unique-id.const',
            ],
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
        'nodes-referenced-in-pattern-decision-must-be-in-oneof-or-anyof-block': {
            description: 'Nodes referenced in pattern decision must be in oneOf or anyOf block',
            severity: 'error',
            message: '{{error}}',
            given: '$..relationship-type.properties.options.prefixItems[*]..nodes.const[*]',
            then: {
                function: isDefinedInOneOfOrAnyOf,
                functionOptions: {
                    calmType: 'nodes'
                }
            },
        },
        'relationships-referenced-in-pattern-decision-must-be-in-oneof-or-anyof-block': {
            description: 'Relationships referenced in pattern decision must be in oneOf or anyOf block',
            severity: 'error',
            message: '{{error}}',
            given: '$..relationship-type.properties.options.prefixItems[*]..relationships.const[*]',
            then: {
                function: isDefinedInOneOfOrAnyOf,
                functionOptions: {
                    calmType: 'relationships'
                }
            },
        },
        'pattern-option-relationship-must-only-have-oneof-or-anyof-items': {
            description: 'Options relationships must only contain oneOf or anyOf items',
            severity: 'error',
            message: '{{error}}',
            given: '$..relationship-type.properties.options.prefixItems[*]',
            then: {
                function: xor,
                functionOptions: {
                    properties: [
                        'oneOf',
                        'anyOf',
                    ]
                },
            },
        },
        'pattern-option-relationship-must-have-max-one-item': {
            description: 'Options relationships must have max one item',
            severity: 'error',
            message: '{{error}}',
            given: '$..relationship-type.properties.options.prefixItems',
            then: {
                function: length,
                functionOptions: {
                    max: 1
                },
            },
        },
        'pattern-option-relationship-must-be-in-prefix-items': {
            // A decision holder (a relationship carrying `relationship-type.options`) states a
            // decision the architect must actively make - even when the answer is "add none".
            // Declaring it in an `items` catalog is valid JSON Schema but makes the *decision*
            // itself optional, so `calm generate` never offers it and the pattern no longer
            // requires the resulting architecture to contain it. Candidates belong in the
            // catalog; the decision that selects them belongs in `prefixItems`.
            description: 'Options relationships must be declared in relationships.prefixItems, not in an items catalog',
            severity: 'error',
            message: 'A relationship declaring "relationship-type.options" must be in "properties.relationships.prefixItems". Declaring a decision inside an "items" catalog makes the decision itself optional - move the options relationship into prefixItems and leave only its candidates in the catalog.',
            given: [
                '$..relationships.items.oneOf[*].properties.relationship-type.properties.options',
                '$..relationships.items.anyOf[*].properties.relationship-type.properties.options',
            ],
            then: {
                function: falsy,
            },
        }
    }
};

export default patternRules;