import { describe, it, expect } from 'vitest';
import { DereferencingVisitor } from './dereference-visitor';
import { CalmCore, Resolvable, ResolvableAndAdaptable} from '@finos/calm-models/model';
import { InMemoryResolver } from '../resolver/calm-reference-resolver';
import {CalmCoreSchema} from '@finos/calm-models/types';
import {CalmCoreCanonicalModel} from '@finos/calm-models/canonical';

// Use the same architecture as in the LoggingVisitor test
const testArch = {
    '$schema': 'https://calm.finos.org/release/1.0-rc2/meta/calm.json',
    'unique-id': 'core-001',
    'name': 'Conference Signup Architecture',
    'description': 'Core architecture for conference signup system.',
    'nodes': [
        {
            'unique-id': 'web-tier',
            'node-type': 'webclient',
            'name': 'Web Tier',
            'description': 'Handles user interactions and HTTP requests',
            'interfaces': [
                {
                    'unique-id': 'web-http',
                    'host': 'web.example.com',
                    'port': 443
                }
            ],
            'details': {
                'detailed-architecture': 'http://example.com/arch-detail'
            }
        },
        {
            'unique-id': 'app-tier',
            'node-type': 'service',
            'name': 'Application Tier',
            'description': 'Processes business logic and API requests',
            'interfaces': [
                {
                    'unique-id': 'app-api',
                    'host': 'app.internal.local',
                    'port': 8080
                }
            ]
        }
    ],
    'relationships': [
        {
            'unique-id': 'web-to-app',
            'description': 'Web tier sends API requests to Application tier',
            'relationship-type': {
                'connects': {
                    'source': {
                        'node': 'web-tier',
                        'interfaces': ['web-http']
                    },
                    'destination': {
                        'node': 'app-tier',
                        'interfaces': ['app-api']
                    }
                }
            }
        }
    ],
    'controls': {
        'user-auth': {
            'description': 'User authentication control',
            'requirements': [
                {
                    'requirement-url': 'https://calm.finos.org/release/1.0-rc2/prototype/user-auth-requirement.json',
                    'config-url': 'https://calm.finos.org/release/1.0-rc2/prototype/user-auth-config.json'
                }
            ]
        }
    }
};

const derefData = {
    'http://example.com/arch-detail': {
        '$schema': 'https://calm.finos.org/release/1.0-rc2/meta/calm.json',
        'unique-id': 'arch-detail-001',
        'name': 'Detailed Architecture',
        'nodes': [
            {
                'unique-id': 'db-tier',
                'node-type': 'database',
                'name': 'Database Tier',
                'description': 'Stores persistent data',
                'interfaces': [
                    {
                        'unique-id': 'db-sql',
                        'host': 'db.internal.local',
                        'port': 5432
                    }
                ]
            }
        ],
        'relationships': [
            {
                'unique-id': 'app-to-db',
                'description': 'App tier queries DB tier',
                'relationship-type': {
                    'connects': {
                        'source': {
                            'node': 'app-tier',
                            'interfaces': ['app-api']
                        },
                        'destination': {
                            'node': 'db-tier',
                            'interfaces': ['db-sql']
                        }
                    }
                },
            }
        ]
    },
    'https://calm.finos.org/release/1.0-rc2/prototype/user-auth-requirement.json': {
        'auth-method': 'OAuth2'
    },
    'https://calm.finos.org/release/1.0-rc2/prototype/user-auth-config.json': {
        'token-endpoint': 'https://auth.example.com/token'
    }
};

describe('DereferencingVisitor', () => {
    it('should dereference all Resolvable fields in CalmCore and produce the correct canonical model', async () => {
        const resolver = new InMemoryResolver(derefData);
        const json = JSON.stringify(testArch, null, 2);
        const architecture: CalmCoreSchema = JSON.parse(json);
        const core = CalmCore.fromSchema(architecture);
        const visitor = new DereferencingVisitor(resolver);

        // Before dereferencing, Resolvables should not be resolved
        const detailsResolvable = core.nodes[0].details?.detailedArchitecture;
        expect(detailsResolvable).toBeInstanceOf(ResolvableAndAdaptable);
        expect(detailsResolvable?.isResolved).toBe(false);

        // Run the visitor
        await visitor.visit(core);

        // After dereferencing, Resolvables should be resolved
        expect(detailsResolvable?.isResolved).toBe(true);
        // Create a CalmCore model from derefData for canonical comparison
        const expectedCalmCore = CalmCore.fromSchema(derefData['http://example.com/arch-detail']);
        expect(detailsResolvable?.value).toEqual(expectedCalmCore);
        // Check control requirement and configUrl
        const controlReq = core.controls?.data['user-auth'].requirements[0].requirement;
        const configUrl = core.controls?.data['user-auth'].requirements[0].configUrl;
        expect(controlReq).toBeInstanceOf(Resolvable);
        expect(configUrl).toBeInstanceOf(Resolvable);
        expect(controlReq?.isResolved).toBe(true);
        expect(configUrl?.isResolved).toBe(true);
        expect(controlReq?.value).toEqual(derefData['https://calm.finos.org/release/1.0-rc2/prototype/user-auth-requirement.json']);
        expect(configUrl?.value).toEqual(derefData['https://calm.finos.org/release/1.0-rc2/prototype/user-auth-config.json']);

        // Now test toCanonicalSchema
        const canonical: CalmCoreCanonicalModel = core.toCanonicalSchema();
        expect(canonical.nodes.length).toBe(2);
        expect(canonical.nodes[0]['unique-id']).toBe('web-tier');
        expect(canonical.nodes[0].details.nodes).toEqual([  {
            'unique-id': 'db-tier',
            'node-type': 'database',
            'name': 'Database Tier',
            'description': 'Stores persistent data',
            'interfaces': [
                {
                    'unique-id': 'db-sql',
                    'host': 'db.internal.local',
                    'port': 5432
                }
            ],
            'controls': undefined,
            'metadata': undefined,
            'details': undefined
        }]);
        expect(canonical.controls['user-auth'].requirements[0]).toEqual({
            'requirement-url': 'https://calm.finos.org/release/1.0-rc2/prototype/user-auth-requirement.json',
            'token-endpoint': 'https://auth.example.com/token',
        });

    });

});
