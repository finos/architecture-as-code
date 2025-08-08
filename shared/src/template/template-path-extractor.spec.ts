import { describe, it, expect } from 'vitest';
import {JsonFragment, TemplatePathExtractor } from './template-path-extractor';

const architecture = {
    $schema: 'https://calm.finos.org/workshop/account-system.pattern.json',
    metadata: [{ owner: 'Platform Team' }],
    nodes: [
        {
            'unique-id': 'user-interface',
            name: 'User Interface',
            description: 'Front-end application for user interaction',
            'node-type': 'webclient',
            interfaces: [
                {
                    'unique-id': 'ui-http-endpoint',
                    'definition-url': 'https://calm.finos.org/interface/http-client.json',
                    url: 'https://account.example.com',
                    headers: [
                        { key: 'Accept', value: 'application/json' },
                        { key: 'Authorization', value: 'Bearer token' }
                    ]
                }
            ]
        },
        {
            'unique-id': 'account-system',
            name: 'Account System',
            description: 'System handling account logic and storage',
            'node-type': 'system',
            controls: {
                'platform-hardening': {
                    description: 'Ensure the system applies secure platform configurations',
                    requirements: [
                        {
                            'control-requirement-url':
                                'https://calm.finos.org/release/1.0-rc2/platform/platform-hardening-requirement.json',
                            'os-hardening': true,
                            'network-isolation': true,
                            'audit-logging-enabled': true
                        }
                    ]
                },
                'data-protection': {
                    description: 'Ensure protection of sensitive user account data',
                    requirements: [
                        {
                            'control-requirement-url':
                                'https://calm.finos.org/release/1.0-rc2/prototype/data-protection-requirement.json',
                            'data-at-rest': true,
                            'data-in-transit': true,
                            'key-rotation-period': '90-days',
                            encryption: {
                                algorithm: 'AES',
                                strength: 256
                            }
                        }
                    ]
                }
            },
            interfaces: [
                {
                    'unique-id': 'account-api',
                    'definition-url': 'https://calm.finos.org/interface/http-server.json',
                    host: 'account-system.internal',
                    port: 443
                }
            ],
            details: {
                nodes: [
                    {
                        'unique-id': 'account-service',
                        name: 'Account Service',
                        description: 'Business logic for account operations',
                        'node-type': 'service',
                        interfaces: [
                            {
                                'unique-id': 'account-service-image',
                                'definition-url': 'https://calm.finos.org/interface/container-image.json',
                                image: 'ghcr.io/org/account-service:latest'
                            },
                            {
                                'unique-id': 'account-service-port',
                                'definition-url': 'https://calm.finos.org/interface/container-port.json',
                                port: 8080
                            }
                        ]
                    },
                    {
                        'unique-id': 'account-db',
                        name: 'Account Database',
                        description: 'Persistent store for account data',
                        'node-type': 'database',
                        interfaces: [
                            {
                                'unique-id': 'account-db-image',
                                'definition-url': 'https://calm.finos.org/interface/container-image.json',
                                image: 'ghcr.io/org/postgres:14'
                            },
                            {
                                'unique-id': 'account-db-port',
                                'definition-url': 'https://calm.finos.org/interface/container-port.json',
                                port: 5432
                            }
                        ]
                    }
                ],
                relationships: [
                    {
                        'unique-id': 'service-to-db',
                        description: 'Account Service reads/writes to Account DB',
                        'relationship-type': {
                            connects: {
                                source: { node: 'account-service' },
                                destination: { node: 'account-db' }
                            }
                        }
                    }
                ]
            }
        }
    ],
    relationships: [
        {
            'unique-id': 'ui-to-account-system',
            description: 'UI calls into the Account System',
            'relationship-type': {
                connects: {
                    source: { node: 'user-interface' },
                    destination: { node: 'account-system' }
                }
            },
            controls: {
                'transport-security': {
                    description: 'Ensure TLS 1.2+ encryption between frontend and backend',
                    requirements: [
                        {
                            'control-requirement-url':
                                'https://calm.finos.org/release/1.0-rc2/transport/transport-security-requirement.json',
                            protocol: 'TLS',
                            'min-version': '1.2',
                            'data-in-transit': true
                        }
                    ]
                }
            }
        }
    ]
};

const architectureDocument = { architecture };

/* eslint-disable quotes */
describe('TemplatePathExtractor', () => {

    it('gets all top-level nodes', () => {
        const result = TemplatePathExtractor.convertFromDotNotation(architectureDocument, 'architecture.nodes');
        expect(Array.isArray(result)).toBe(true);
        expect((result as JsonFragment[]).length).toBe(2);
    });

    it('filters nodes by node-type', () => {
        const result = TemplatePathExtractor.convertFromDotNotation(architectureDocument, "architecture.nodes[node-type=='system']");
        expect(Array.isArray(result)).toBe(true);
        const resultArray = result as JsonFragment[];
        expect(resultArray.length).toBe(1);
        expect(resultArray[0]['unique-id']).toBe('account-system');
    });

    it('retrieves nested details.nodes', () => {
        const result = TemplatePathExtractor.convertFromDotNotation(architectureDocument, "architecture.nodes['account-system'].details.nodes");
        expect(Array.isArray(result)).toBe(true);
        expect((result as JsonFragment[]).length).toBe(2);
    });

    it('filters nested nodes by node-type', () => {
        const result = TemplatePathExtractor.convertFromDotNotation(
            architectureDocument,
            "architecture.nodes['account-system'].details.nodes[node-type=='service']"
        );
        expect(Array.isArray(result)).toBe(true);
        const resultArray = result as JsonFragment[];
        expect(resultArray.length).toBe(1);
        expect(resultArray[0]['name']).toBe('Account Service');
    });

    it('retrieves interfaces for the UI node', () => {
        const result = TemplatePathExtractor.convertFromDotNotation(
            architectureDocument,
            "architecture.nodes['user-interface'].interfaces"
        );
        expect(Array.isArray(result)).toBe(true);
        const resultArray = result as JsonFragment[];
        expect(resultArray[0]['url']).toBe('https://account.example.com');
    });

    it('retrieves a nested interface property from the database', () => {
        const result = TemplatePathExtractor.convertFromDotNotation(
            architectureDocument,
            "architecture.nodes['account-system'].details.nodes['account-db'].interfaces[definition-url=='https://calm.finos.org/interface/container-port.json']"
        );
        expect(Array.isArray(result)).toBe(true);
        const resultArray = result as JsonFragment[];
        expect(resultArray[0]['port']).toBe(5432);
    });

    it('retrieves a system control requirement field', () => {
        const result = TemplatePathExtractor.convertFromDotNotation(
            architectureDocument,
            "architecture.nodes['account-system'].controls['data-protection'].requirements[0].key-rotation-period"
        );
        // This is a deep path that should return the actual value, not an array
        expect(result).toBe('90-days');
    });

    it('retrieves a boolean from the controls section', () => {
        const result = TemplatePathExtractor.convertFromDotNotation(
            architectureDocument,
            "architecture.nodes['account-system'].controls['platform-hardening'].requirements[0].os-hardening"
        );
        // This is a deep path that should return the actual value, not an array
        expect(result).toBe(true);
    });

    it('retrieves relationship metadata from filtered relationship', () => {
        const result = TemplatePathExtractor.convertFromDotNotation(
            architectureDocument,
            "architecture.relationships['ui-to-account-system'].controls['transport-security'].requirements[0].protocol"
        );
        // This is a deep path that should return the actual value, not an array
        expect(result).toBe('TLS');
    });

    it('applies sorting to nested nodes', () => {
        const result = TemplatePathExtractor.convertFromDotNotation(
            architectureDocument,
            "architecture.nodes['account-system'].details.nodes",
            { sort: 'name' }
        );
        expect(Array.isArray(result)).toBe(true);
        const resultArray = result as JsonFragment[];
        expect(resultArray[0]['name']).toBe('Account Database');
        expect(resultArray[1]['name']).toBe('Account Service');
    });

    it('applies limit to query results', () => {
        const result = TemplatePathExtractor.convertFromDotNotation(
            architectureDocument,
            "architecture.nodes['account-system'].details.nodes",
            { limit: 1 }
        );
        expect(Array.isArray(result)).toBe(true);
        expect((result as JsonFragment[]).length).toBe(1);
    });

    it('applies extra filter on node name', () => {
        const result = TemplatePathExtractor.convertFromDotNotation(
            architectureDocument,
            "architecture.nodes['account-system'].details.nodes",
            { filter: { name: 'Account Database' } }
        );
        expect(Array.isArray(result)).toBe(true);
        const resultArray = result as JsonFragment[];
        expect(resultArray.length).toBe(1);
        expect(resultArray[0]['unique-id']).toBe('account-db');
    });

    it('retrieves nested control record field', () => {
        const result = TemplatePathExtractor.convertFromDotNotation(
            architectureDocument,
            "architecture.nodes['account-system'].controls['data-protection'].requirements[0].encryption.strength"
        );
        // This is a deep path that should return the actual value, not an array
        expect(result).toBe(256);
    });

    it('retrieves nested array item from interface', () => {
        const result = TemplatePathExtractor.convertFromDotNotation(
            architectureDocument,
            "architecture.nodes['user-interface'].interfaces['ui-http-endpoint'].headers[key=='Authorization'].value"
        );
        // This is a deep path that should return the actual value, not an array
        expect(result).toBe('Bearer token');
    });


});