/**
 * Real control fixtures loaded from ap187183-fae-calm-assets repository.
 * These serve as regression tests to ensure real-world controls work correctly.
 * Used by ControlsList.test.tsx to validate against actual control structures.
 */

import type { ControlEntry } from '../control-metadata';
import type { RequirementPropertyDef } from '../../../extension/services/requirement-parser';

/**
 * Database Technology Control (Enum with string values)
 * Real fixture from: ap187183-fae-calm-assets/controls/database/database-technology.requirement.json
 * Tests: enum dropdown rendering with multiple options
 */
export const databaseTechnologyControl: ControlEntry = {
    description: 'Database engine or managed database service',
    requirements: [
        {
            'requirement-url': 'database:controls:database-technology',
            config: { value: 'AWS Aurora PostgreSQL' },
        },
    ],
    metadata: {
        validation: {
            identity: {
                controlId: 'database-technology',
                name: 'Database Technology',
                description: 'Database engine or managed database service',
            },
            properties: {
                value: {
                    type: 'enum',
                    allowedValues: [
                        'AWS Aurora PostgreSQL',
                        'AWS RDS PostgreSQL',
                        'Oracle',
                        'YugabyteDB',
                        'CockroachDB',
                        'Amazon DynamoDB',
                        'Snowflake',
                        'Other',
                    ],
                    required: true,
                    description: 'Select a database technology',
                } as RequirementPropertyDef,
            },
        },
    },
};

/**
 * Gateway Type Control (allowedValues without explicit type)
 * Real fixture from: ap187183-fae-calm-assets/test.calm.json
 * Tests: parser support for CALM controls that use allowedValues metadata
 */
export const gatewayTypeControl: ControlEntry = {
    description: 'Gateway Type',
    requirements: [
        {
            'requirement-url': 'api:controls:gateway-type',
            config: { value: 'Edge' },
        },
    ],
    metadata: {
        validation: {
            identity: {
                controlId: 'gateway-type',
                name: 'Gateway Type',
                description: 'Defines the gateway type for this platform.',
            },
            properties: {
                value: {
                    allowedValues: ['Edge', 'Internal'],
                    required: true,
                    description: 'Select the appropriate gateway type for this platform',
                } as RequirementPropertyDef,
            },
        },
    },
};

/**
 * Access Token TTL Control (Integer with min/max)
 * Real fixture from: ap187183-fae-calm-assets/controls/security/access-token-ttl-minutes.requirement.json
 * Tests: integer input rendering with constraints
 */
export const accessTokenTtlControl: ControlEntry = {
    description: 'Lifetime of issued access tokens in minutes.',
    requirements: [
        {
            'requirement-url': 'security:controls:access-token-ttl-minutes',
            config: { value: '60' },
        },
    ],
    metadata: {
        validation: {
            identity: {
                controlId: 'access-token-ttl-minutes',
                name: 'Access Token TTL (Minutes)',
                description: 'Lifetime of issued access tokens in minutes.',
            },
            properties: {
                value: {
                    type: 'integer',
                    required: true,
                    description: 'Access token time-to-live in minutes',
                } as RequirementPropertyDef,
            },
        },
    },
};

/**
 * Unconfigured Database Technology Control
 * Same as databaseTechnologyControl but with no value set.
 * Tests: required enum fields that haven't been filled in yet
 */
export const databaseTechnologyUnconfigured: ControlEntry = {
    description: 'Database engine or managed database service',
    requirements: [
        {
            'requirement-url': 'database:controls:database-technology',
            config: {},
        },
    ],
    metadata: {
        validation: {
            identity: {
                controlId: 'database-technology',
                name: 'Database Technology',
                description: 'Database engine or managed database service',
            },
            properties: {
                value: {
                    type: 'enum',
                    allowedValues: [
                        'AWS Aurora PostgreSQL',
                        'AWS RDS PostgreSQL',
                        'Oracle',
                        'YugabyteDB',
                        'CockroachDB',
                        'Amazon DynamoDB',
                        'Snowflake',
                        'Other',
                    ],
                    required: true,
                    description: 'Select a database technology',
                } as RequirementPropertyDef,
            },
        },
    },
};

/**
 * Authentication Pattern Control (Enum)
 * Real fixture from: ap187183-fae-calm-assets/controls/security/authentication-pattern.requirement.json
 * Tests: enum with security-relevant options
 */
export const authenticationPatternControl: ControlEntry = {
    description: 'Authentication pattern implemented for this system',
    requirements: [
        {
            'requirement-url': 'security:controls:authentication-pattern',
            config: { value: 'OIDC' },
        },
    ],
    metadata: {
        validation: {
            identity: {
                controlId: 'authentication-pattern',
                name: 'Authentication Pattern',
                description: 'Authentication pattern implemented for this system',
            },
            properties: {
                value: {
                    type: 'enum',
                    allowedValues: ['SAML', 'OIDC', 'Custom', 'Kerberos', 'Basic Auth'],
                    required: true,
                    description: 'Select authentication pattern',
                } as RequirementPropertyDef,
            },
        },
    },
};

/**
 * Legacy Single-Value Control (with allowed-values metadata)
 * Simulates older control format that may still be in use
 * Tests: backward compatibility with legacy control shape
 */
export const legacyEncryptionControl: ControlEntry = {
    description: 'Legacy encryption control',
    requirements: [
        {
            'requirement-url': 'security/legacy-encryption.requirement.json',
            config: { value: 'AES-256' },
        },
    ],
    metadata: {
        validation: {
            'allowed-values': ['AES-128', 'AES-256', 'AES-192'],
        },
    },
};

/**
 * Pinned Config Control (config-url locks the value)
 * Tests: readonly behavior when config is pinned to external URL
 */
export const pinnedDatabaseControl: ControlEntry = {
    description: 'Database technology (pinned configuration)',
    requirements: [
        {
            'requirement-url': 'database:controls:database-technology',
            'config-url': 'configs/prod-database-config.json',
            config: { value: 'AWS Aurora PostgreSQL' },
        },
    ],
    metadata: {
        validation: {
            identity: {
                controlId: 'database-technology',
                name: 'Database Technology',
                description: 'Database engine or managed database service',
            },
            properties: {
                value: {
                    type: 'enum',
                    allowedValues: [
                        'AWS Aurora PostgreSQL',
                        'AWS RDS PostgreSQL',
                        'Oracle',
                    ],
                    required: true,
                } as RequirementPropertyDef,
            },
        },
    },
};

/**
 * Enum Control with Missing allowedValues (data integrity issue)
 * Tests: graceful handling when schema is incomplete
 */
export const brokenEnumControl: ControlEntry = {
    description: 'Enum control with missing allowed values',
    requirements: [
        {
            'requirement-url': 'security:controls:broken-enum',
            config: { value: 'SomeValue' },
        },
    ],
    metadata: {
        validation: {
            identity: {
                controlId: 'broken-enum',
                name: 'Broken Enum',
                description: 'This enum is missing allowedValues',
            },
            properties: {
                value: {
                    type: 'enum',
                    // Missing: allowedValues array - this is the data issue
                    required: true,
                } as RequirementPropertyDef,
            },
        },
    },
};

/**
 * Hub-sourced Control with CURIE Reference
 * Tests: controls loaded from CalmHub with namespace:type:id@sha format
 */
export const hubSourcedControl: ControlEntry = {
    description: 'Control sourced from CalmHub',
    requirements: [
        {
            'requirement-url': 'fae-calm:controls:database-technology@abc123def456',
            config: { value: 'PostgreSQL' },
        },
    ],
    metadata: {
        validation: {
            identity: {
                controlId: 'database-technology',
                name: 'Database Technology (Hub)',
                description: 'Database engine from CalmHub',
            },
            properties: {
                value: {
                    type: 'enum',
                    allowedValues: ['PostgreSQL', 'MySQL', 'Oracle'],
                    required: true,
                } as RequirementPropertyDef,
            },
        },
    },
};

/**
 * String Control with Pattern Validation
 * Tests: regex pattern hint display and validation
 */
export const patternControl: ControlEntry = {
    description: 'Health check endpoint path',
    requirements: [
        {
            'requirement-url': 'api:controls:health-path',
            config: { value: '/health' },
        },
    ],
    metadata: {
        validation: {
            identity: {
                controlId: 'health-path',
                name: 'Health Path',
                description: 'URL path for health check endpoint',
            },
            properties: {
                value: {
                    type: 'string',
                    pattern: '^/[a-z]+$',
                    required: true,
                    description: 'Must start with / and contain only lowercase letters',
                } as RequirementPropertyDef,
            },
        },
    },
};

/**
 * Boolean Control (Three-state)
 * Tests: true/false selection with unset option
 */
export const encryptionEnabledControl: ControlEntry = {
    description: 'Whether encryption is enabled',
    requirements: [
        {
            'requirement-url': 'security:controls:encryption-enabled',
            config: { value: 'true' },
        },
    ],
    metadata: {
        validation: {
            identity: {
                controlId: 'encryption-enabled',
                name: 'Encryption Enabled',
                description: 'Is encryption enabled for this resource',
            },
            properties: {
                value: {
                    type: 'boolean',
                    required: true,
                    description: 'Enable or disable encryption',
                } as RequirementPropertyDef,
            },
        },
    },
};

/**
 * Number (Decimal) Control
 * Tests: floating-point number input
 */
export const timeoutControl: ControlEntry = {
    description: 'Connection timeout in seconds',
    requirements: [
        {
            'requirement-url': 'network:controls:connection-timeout',
            config: { value: '30.5' },
        },
    ],
    metadata: {
        validation: {
            identity: {
                controlId: 'connection-timeout',
                name: 'Connection Timeout',
                description: 'How long to wait for a connection before timing out',
            },
            properties: {
                value: {
                    type: 'number',
                    required: false,
                    description: 'Timeout in seconds (supports decimals)',
                } as RequirementPropertyDef,
            },
        },
    },
};
