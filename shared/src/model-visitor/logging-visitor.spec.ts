import { describe, it, expect, vi } from 'vitest';
import { LoggingVisitor } from './logging-visitor';
import { CalmCore } from '../model/core';
import { CalmCoreSchema } from '../types/core-types';

describe('LoggingVisitor', () => {

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
                },
                'protocol': 'HTTPS'
            }
        ],
        'controls': {
            'auth-control': {
                'description': 'Authentication control',
                'requirements': [
                    {
                        'requirement-url': 'https://calm.finos.org/release/1.0-rc2/prototype/authentication-control-requirement.json',
                        'config-url': 'https://calm.finos.org/release/1.0-rc2/prototype/authentication-control-config.json'
                    }
                ]
            }
        }
    };


    it('should log all traversed fields and Resolvables for CalmCore', async () => {
        const logger = {
            info: vi.fn(),
            debug: vi.fn(),
            error: vi.fn()
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (LoggingVisitor as any).logger = logger;
        const json = JSON.stringify(testArch, null, 2);
        const architecture: CalmCoreSchema = JSON.parse(json);
        const core = CalmCore.fromSchema(architecture);
        const visitor = new LoggingVisitor(logger);
        await visitor.visit(core);

        const logLines = logger.info.mock.calls.map(args => args[0]);

        const expectedLogLines = [
            '[Object] originalJson',
            '[Primitive] originalJson.$schema = https://calm.finos.org/release/1.0-rc2/meta/calm.json',
            '[Primitive] originalJson.unique-id = core-001',
            '[Primitive] originalJson.name = Conference Signup Architecture',
            '[Primitive] originalJson.description = Core architecture for conference signup system.',
            '[Array] originalJson.nodes',
            '[Primitive] originalJson.nodes.[0].unique-id = web-tier',
            '[Primitive] originalJson.nodes.[0].node-type = webclient',
            '[Primitive] originalJson.nodes.[0].name = Web Tier',
            '[Primitive] originalJson.nodes.[0].description = Handles user interactions and HTTP requests',
            '[Array] originalJson.nodes.[0].interfaces',
            '[Primitive] originalJson.nodes.[0].interfaces.[0].unique-id = web-http',
            '[Primitive] originalJson.nodes.[0].interfaces.[0].host = web.example.com',
            '[Primitive] originalJson.nodes.[0].interfaces.[0].port = 443',
            '[Object] originalJson.nodes.[0].details',
            '[Primitive] originalJson.nodes.[0].details.detailed-architecture = http://example.com/arch-detail',
            '[Primitive] originalJson.nodes.[1].unique-id = app-tier',
            '[Primitive] originalJson.nodes.[1].node-type = service',
            '[Primitive] originalJson.nodes.[1].name = Application Tier',
            '[Primitive] originalJson.nodes.[1].description = Processes business logic and API requests',
            '[Array] originalJson.nodes.[1].interfaces',
            '[Primitive] originalJson.nodes.[1].interfaces.[0].unique-id = app-api',
            '[Primitive] originalJson.nodes.[1].interfaces.[0].host = app.internal.local',
            '[Primitive] originalJson.nodes.[1].interfaces.[0].port = 8080',
            '[Array] originalJson.relationships',
            '[Primitive] originalJson.relationships.[0].unique-id = web-to-app',
            '[Primitive] originalJson.relationships.[0].description = Web tier sends API requests to Application tier',
            '[Object] originalJson.relationships.[0].relationship-type',
            '[Object] originalJson.relationships.[0].relationship-type.connects',
            '[Object] originalJson.relationships.[0].relationship-type.connects.source',
            '[Primitive] originalJson.relationships.[0].relationship-type.connects.source.node = web-tier',
            '[Array] originalJson.relationships.[0].relationship-type.connects.source.interfaces',
            '[Object] originalJson.relationships.[0].relationship-type.connects.destination',
            '[Primitive] originalJson.relationships.[0].relationship-type.connects.destination.node = app-tier',
            '[Array] originalJson.relationships.[0].relationship-type.connects.destination.interfaces',
            '[Primitive] originalJson.relationships.[0].protocol = HTTPS',
            '[Object] originalJson.controls',
            '[Object] originalJson.controls.auth-control',
            '[Primitive] originalJson.controls.auth-control.description = Authentication control',
            '[Array] originalJson.controls.auth-control.requirements',
            '[Primitive] originalJson.controls.auth-control.requirements.[0].requirement-url = https://calm.finos.org/release/1.0-rc2/prototype/authentication-control-requirement.json',
            '[Primitive] originalJson.controls.auth-control.requirements.[0].config-url = https://calm.finos.org/release/1.0-rc2/prototype/authentication-control-config.json',
            '[Array] nodes',
            '[Object] nodes.[0].originalJson',
            '[Primitive] nodes.[0].originalJson.unique-id = web-tier',
            '[Primitive] nodes.[0].originalJson.node-type = webclient',
            '[Primitive] nodes.[0].originalJson.name = Web Tier',
            '[Primitive] nodes.[0].originalJson.description = Handles user interactions and HTTP requests',
            '[Array] nodes.[0].originalJson.interfaces',
            '[Primitive] nodes.[0].originalJson.interfaces.[0].unique-id = web-http',
            '[Primitive] nodes.[0].originalJson.interfaces.[0].host = web.example.com',
            '[Primitive] nodes.[0].originalJson.interfaces.[0].port = 443',
            '[Object] nodes.[0].originalJson.details',
            '[Primitive] nodes.[0].originalJson.details.detailed-architecture = http://example.com/arch-detail',
            '[Primitive] nodes.[0].uniqueId = web-tier',
            '[Primitive] nodes.[0].nodeType = webclient',
            '[Primitive] nodes.[0].name = Web Tier',
            '[Primitive] nodes.[0].description = Handles user interactions and HTTP requests',
            '[Object] nodes.[0].details',
            '[Object] nodes.[0].details.originalJson',
            '[Primitive] nodes.[0].details.originalJson.detailed-architecture = http://example.com/arch-detail',
            '[Primitive] nodes.[0].details.requiredPattern = undefined',
            '[ResolvableAndAdaptable] nodes.[0].details.detailedArchitecture = http://example.com/arch-detail',
            '[Array] nodes.[0].interfaces',
            '[Primitive] nodes.[0].interfaces.[0].uniqueId = web-http',
            '[Object] nodes.[0].interfaces.[0].originalJson',
            '[Primitive] nodes.[0].interfaces.[0].originalJson.unique-id = web-http',
            '[Primitive] nodes.[0].interfaces.[0].originalJson.host = web.example.com',
            '[Primitive] nodes.[0].interfaces.[0].originalJson.port = 443',
            '[Object] nodes.[0].interfaces.[0].additionalProperties',
            '[Primitive] nodes.[0].interfaces.[0].additionalProperties.host = web.example.com',
            '[Primitive] nodes.[0].interfaces.[0].additionalProperties.port = 443',
            '[Primitive] nodes.[0].controls = undefined',
            '[Primitive] nodes.[0].metadata = undefined',
            '[Primitive] nodes.[0].additionalProperties = undefined',
            '[Object] nodes.[1].originalJson',
            '[Primitive] nodes.[1].originalJson.unique-id = app-tier',
            '[Primitive] nodes.[1].originalJson.node-type = service',
            '[Primitive] nodes.[1].originalJson.name = Application Tier',
            '[Primitive] nodes.[1].originalJson.description = Processes business logic and API requests',
            '[Array] nodes.[1].originalJson.interfaces',
            '[Primitive] nodes.[1].originalJson.interfaces.[0].unique-id = app-api',
            '[Primitive] nodes.[1].originalJson.interfaces.[0].host = app.internal.local',
            '[Primitive] nodes.[1].originalJson.interfaces.[0].port = 8080',
            '[Primitive] nodes.[1].uniqueId = app-tier',
            '[Primitive] nodes.[1].nodeType = service',
            '[Primitive] nodes.[1].name = Application Tier',
            '[Primitive] nodes.[1].description = Processes business logic and API requests',
            '[Primitive] nodes.[1].details = undefined',
            '[Array] nodes.[1].interfaces',
            '[Primitive] nodes.[1].interfaces.[0].uniqueId = app-api',
            '[Object] nodes.[1].interfaces.[0].originalJson',
            '[Primitive] nodes.[1].interfaces.[0].originalJson.unique-id = app-api',
            '[Primitive] nodes.[1].interfaces.[0].originalJson.host = app.internal.local',
            '[Primitive] nodes.[1].interfaces.[0].originalJson.port = 8080',
            '[Object] nodes.[1].interfaces.[0].additionalProperties',
            '[Primitive] nodes.[1].interfaces.[0].additionalProperties.host = app.internal.local',
            '[Primitive] nodes.[1].interfaces.[0].additionalProperties.port = 8080',
            '[Primitive] nodes.[1].controls = undefined',
            '[Primitive] nodes.[1].metadata = undefined',
            '[Primitive] nodes.[1].additionalProperties = undefined',
            '[Array] relationships',
            '[Object] relationships.[0].originalJson',
            '[Primitive] relationships.[0].originalJson.unique-id = web-to-app',
            '[Primitive] relationships.[0].originalJson.description = Web tier sends API requests to Application tier',
            '[Object] relationships.[0].originalJson.relationship-type',
            '[Object] relationships.[0].originalJson.relationship-type.connects',
            '[Object] relationships.[0].originalJson.relationship-type.connects.source',
            '[Primitive] relationships.[0].originalJson.relationship-type.connects.source.node = web-tier',
            '[Array] relationships.[0].originalJson.relationship-type.connects.source.interfaces',
            '[Object] relationships.[0].originalJson.relationship-type.connects.destination',
            '[Primitive] relationships.[0].originalJson.relationship-type.connects.destination.node = app-tier',
            '[Array] relationships.[0].originalJson.relationship-type.connects.destination.interfaces',
            '[Primitive] relationships.[0].originalJson.protocol = HTTPS',
            '[Primitive] relationships.[0].uniqueId = web-to-app',
            '[Object] relationships.[0].relationshipType',
            '[Object] relationships.[0].relationshipType.originalJson',
            '[Object] relationships.[0].relationshipType.originalJson.source',
            '[Primitive] relationships.[0].relationshipType.originalJson.source.node = web-tier',
            '[Array] relationships.[0].relationshipType.originalJson.source.interfaces',
            '[Object] relationships.[0].relationshipType.originalJson.destination',
            '[Primitive] relationships.[0].relationshipType.originalJson.destination.node = app-tier',
            '[Array] relationships.[0].relationshipType.originalJson.destination.interfaces',
            '[Object] relationships.[0].relationshipType.source',
            '[Object] relationships.[0].relationshipType.source.originalJson',
            '[Primitive] relationships.[0].relationshipType.source.originalJson.node = web-tier',
            '[Array] relationships.[0].relationshipType.source.originalJson.interfaces',
            '[Primitive] relationships.[0].relationshipType.source.node = web-tier',
            '[Array] relationships.[0].relationshipType.source.interfaces',
            '[Object] relationships.[0].relationshipType.destination',
            '[Object] relationships.[0].relationshipType.destination.originalJson',
            '[Primitive] relationships.[0].relationshipType.destination.originalJson.node = app-tier',
            '[Array] relationships.[0].relationshipType.destination.originalJson.interfaces',
            '[Primitive] relationships.[0].relationshipType.destination.node = app-tier',
            '[Array] relationships.[0].relationshipType.destination.interfaces',
            '[Primitive] relationships.[0].metadata = undefined',
            '[Primitive] relationships.[0].controls = undefined',
            '[Object] relationships.[0].additionalProperties',
            '[Primitive] relationships.[0].description = Web tier sends API requests to Application tier',
            '[Primitive] relationships.[0].protocol = HTTPS',
            '[Object] controls',
            '[Object] controls.originalJson',
            '[Object] controls.originalJson.auth-control',
            '[Primitive] controls.originalJson.auth-control.description = Authentication control',
            '[Array] controls.originalJson.auth-control.requirements',
            '[Primitive] controls.originalJson.auth-control.requirements.[0].requirement-url = https://calm.finos.org/release/1.0-rc2/prototype/authentication-control-requirement.json',
            '[Primitive] controls.originalJson.auth-control.requirements.[0].config-url = https://calm.finos.org/release/1.0-rc2/prototype/authentication-control-config.json',
            '[Object] controls.data',
            '[Object] controls.data.auth-control',
            '[Object] controls.data.auth-control.originalJson',
            '[Primitive] controls.data.auth-control.originalJson.description = Authentication control',
            '[Array] controls.data.auth-control.originalJson.requirements',
            '[Primitive] controls.data.auth-control.originalJson.requirements.[0].requirement-url = https://calm.finos.org/release/1.0-rc2/prototype/authentication-control-requirement.json',
            '[Primitive] controls.data.auth-control.originalJson.requirements.[0].config-url = https://calm.finos.org/release/1.0-rc2/prototype/authentication-control-config.json',
            '[Primitive] controls.data.auth-control.description = Authentication control',
            '[Array] controls.data.auth-control.requirements',
            '[Object] controls.data.auth-control.requirements.[0].originalJson',
            '[Primitive] controls.data.auth-control.requirements.[0].originalJson.requirement-url = https://calm.finos.org/release/1.0-rc2/prototype/authentication-control-requirement.json',
            '[Primitive] controls.data.auth-control.requirements.[0].originalJson.config-url = https://calm.finos.org/release/1.0-rc2/prototype/authentication-control-config.json',
            '[Resolvable] controls.data.auth-control.requirements.[0].requirement = https://calm.finos.org/release/1.0-rc2/prototype/authentication-control-requirement.json',
            '[Resolvable] controls.data.auth-control.requirements.[0].configUrl = https://calm.finos.org/release/1.0-rc2/prototype/authentication-control-config.json',
            '[Primitive] controls.data.auth-control.requirements.[0].config = undefined',
            '[Primitive] flows = undefined',
            '[Primitive] metadata = undefined',
            '[Primitive] adrs = undefined',
        ];
        for (const expected of expectedLogLines) {
            expect(logLines).toContain(expected);
        }
    });
});
