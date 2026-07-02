import request from 'supertest';
import * as fs from 'fs';

import express, { Application } from 'express';
import { ValidationRouter, findDisallowedPatternRef } from './validation-route';
import path from 'path';
import { FileSystemDocumentLoader, SchemaDirectory, validate } from '@finos/calm-shared';
import { vi } from 'vitest';

vi.mock('@finos/calm-shared', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@finos/calm-shared')>();
    return {
        ...actual,
        validate: vi.fn(actual.validate),
    };
});

const schemaDirectoryPath: string = __dirname + '/../../../../calm/release';
const apiGatewayPatternPath: string =
    __dirname + '/../../../test_fixtures/api-gateway';

function createValidationApp() {
    const app = express();
    app.use(express.json());

    const router: express.Router = express.Router();
    new ValidationRouter(
        router,
        new SchemaDirectory(
            new FileSystemDocumentLoader(
                [schemaDirectoryPath, apiGatewayPatternPath],
                false
            )
        )
    );
    app.use('/calm/validate', router);
    return app;
}

describe('ValidationRouter', () => {
    let app: Application;
    
    beforeEach(() => {
        app = createValidationApp();
    });

    test('should return 400 when $schema is not specified', async () => {
        const expectedFilePath = path.join(
            __dirname,
            '../../../test_fixtures/validation_route/invalid_api_gateway_instantiation_missing_schema_key.json'
        );
        const invalidArchitectureMissingSchema = JSON.parse(
            fs.readFileSync(expectedFilePath, 'utf-8')
        );
        const response = await request(app)
            .post('/calm/validate')
            .send(invalidArchitectureMissingSchema);

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            error: 'The "$schema" field is missing from the request body',
        });
    });

    test('should return 400 when architecture JSON is invalid', async () => {
        const requestBody = {
            architecture: 'not valid json {'
        };

        const response = await request(app)
            .post('/calm/validate')
            .send(requestBody);

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            error: 'Invalid JSON format for architecture'
        });
    });

    test.each([
        'null',
        '42',
        '[]',
    ])('should return 400 when the parsed architecture is not an object (%s)', async (architecture) => {
        const response = await request(app)
            .post('/calm/validate')
            .send({ architecture });
            
        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            error: 'The architecture must be a JSON object'
        });
    });

    test('should return 400 when the $schema specified in the instantiation is not found', async () => {
        const expectedFilePath = path.join(
            __dirname,
            '../../../test_fixtures/validation_route/invalid_api_gateway_instantiation_schema_points_to_missing_schema.json'
        );
        const invalidArchitectureMissingSchema = JSON.parse(
            fs.readFileSync(expectedFilePath, 'utf-8')
        );
        const response = await request(app)
            .post('/calm/validate')
            .send(invalidArchitectureMissingSchema);

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            error: 'The "$schema" field referenced is not available to the server',
        });
    });

    test.each([
        'etc/passwd.json',
        'file:///etc/passwd.json',
        '../../etc/passwd.json',
        'C:\\secret.json',
    ])('should return 400 when the architecture $schema is a local file path (%s)', async (schema) => {
        const response = await request(app)
            .post('/calm/validate')
            .send({ architecture: JSON.stringify({ $schema: schema }) });
            
        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            error: 'The "$schema" field must be an absolute http(s) URL'
        });
    });

    test('should return 500 when schema load throws an error', async () => {
        app = express();
        app.use(express.json());

        const router: express.Router = express.Router();
        const mockSchemaDirectory = {
            loadSchemas: vi.fn().mockRejectedValueOnce(new Error('Load error')),
            getSchema: vi.fn()
        } as unknown as SchemaDirectory;

        new ValidationRouter(router, mockSchemaDirectory);
        app.use('/calm/validate', router);

        const requestBody = {
            architecture: JSON.stringify({ $schema: 'https://example.com/schema' })
        };

        const response = await request(app)
            .post('/calm/validate')
            .send(requestBody);

        expect(response.status).toBe(500);
        expect(response.body).toEqual({
            error: 'Failed to load schemas'
        });
    });

    test('should return 500 when getSchema throws an error', async () => {
        app = express();
        app.use(express.json());

        const router: express.Router = express.Router();
        const mockSchemaDirectory = {
            loadSchemas: vi.fn().mockResolvedValueOnce(undefined),
            getSchema: vi.fn().mockRejectedValueOnce(new Error('Schema retrieval error'))
        } as unknown as SchemaDirectory;

        new ValidationRouter(router, mockSchemaDirectory);
        app.use('/calm/validate', router);

        const requestBody = {
            architecture: JSON.stringify({ $schema: 'https://example.com/schema' })
        };

        const response = await request(app)
            .post('/calm/validate')
            .send(requestBody);

        expect(response.status).toBe(500);
        expect(response.body.error).toContain('Failed to load schema');
    });

    test('should return 400 when the architecture relationships field is not an array', async () => {
        
        const response = await request(app)
            .post('/calm/validate')
            .send({
                architecture: JSON.stringify({ $schema: 'https://example.com/schema', relationships: 'not-an-array' })
            });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            error: 'The "relationships" field in the architecture must be an array'
        });
    });

    test('should return 500 when validation when validation throws an unexpected error', async () => {
        vi.mocked(validate).mockRejectedValueOnce(new Error('unexpected validation failure'));

        const router: express.Router = express.Router();
        const mockSchemaDirectory = {
            loadSchemas: vi.fn().mockResolvedValueOnce(undefined),
            getSchema: vi.fn().mockResolvedValue({ type: 'object' })
        } as unknown as SchemaDirectory;
        const localApp = express();
        localApp.use(express.json());
        new ValidationRouter(router, mockSchemaDirectory);
        localApp.use('/calm/validate', router);

        const response = await request(localApp)
            .post('/calm/validate')
            .send({ architecture: JSON.stringify({ $schema: 'https://example.com/schema'}) });

        expect(response.status).toBe(500);
        expect(response.body.error).toContain('Failed to validate architecture');
    });

    test('should return 201 when the schema is valid', async () => {
        const expectedFilePath = path.join(
            __dirname,
            '../../../test_fixtures/validation_route/valid_instantiation.json'
        );
        const validArchitecture = JSON.parse(
            fs.readFileSync(expectedFilePath, 'utf-8')
        );
        const response = await request(app)
            .post('/calm/validate')
            .send(validArchitecture);

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('jsonSchemaValidationOutputs');
        expect(response.body).toHaveProperty('spectralSchemaValidationOutputs');
        expect(response.body).toHaveProperty('hasErrors');
        expect(response.body).toHaveProperty('hasWarnings');
        expect(response.body.hasErrors).toBe(false);
        expect(response.body.hasWarnings).toBe(false);
    });
});

describe('ValidationRouter - /with-pattern', () => {
    let app: Application;
    
    beforeEach(() => {
        app = createValidationApp();
    });

    test('should return 400 when architecture JSON is invalid', async () => {
        const response = await request(app)
            .post('/calm/validate/with-pattern')
            .send({ architecture: 'not valid json {' });
            
        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            error: 'Invalid JSON format for architecture'
        });
    });

    test('should return 400 when $schema is missing from the architecture', async () => {
        const response = await request(app)
            .post('/calm/validate/with-pattern')
            .send({ architecture: '{}' , pattern: '{}' });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            error: 'The "$schema" field is missing from the request body'
        });
    });

    test('should return 400 when pattern JSON is invalid', async () => {
        const response = await request(app)
            .post('/calm/validate/with-pattern')
            .send({ architecture: JSON.stringify({ $schema: 'https://example.com/schema'}), pattern: 'not valid json {' });
            
        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            error: 'Invalid JSON format for pattern'
        });
    });

    test('should return 400 when $id is missing from the pattern', async () => {
        const response = await request(app)
            .post('/calm/validate/with-pattern')
            .send({ architecture: JSON.stringify({ $schema: 'https://example.com/schema'}), pattern: '{}' });
            
        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            error: 'The "$id" field is missing from the provided pattern'
        });
    });
    
    test('should return 400 when $schema in architecture does not match $id in pattern', async () => {
        const response = await request(app)
            .post('/calm/validate/with-pattern')
            .send({ architecture: JSON.stringify({ $schema: 'https://example.com/schema'}), pattern: JSON.stringify({ $id: 'https://example.com/different-schema' }) });
            
        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            error: 'The "$schema" field (https://example.com/schema) in the architecture does not match the "$id" field (https://example.com/different-schema) in the pattern'
        });
    });


    test('should return 500 when schema load throws an error', async () => {
        app = express();
        app.use(express.json());

        const router: express.Router = express.Router();
        const mockSchemaDirectory = {
            loadSchemas: vi.fn().mockRejectedValueOnce(new Error('Load error')),
            getSchema: vi.fn()
        } as unknown as SchemaDirectory;
        
        new ValidationRouter(router, mockSchemaDirectory);
        app.use('/calm/validate', router);

        const response = await request(app)
            .post('/calm/validate/with-pattern')
            .send({ architecture: JSON.stringify({ $schema: 'https://example.com/schema'}), pattern: JSON.stringify({ $id: 'https://example.com/schema' }) });
            
        expect(response.status).toBe(500);
        expect(response.body).toEqual({
            error: 'Failed to load schemas'
        });
    });

    test('should return 400 when the architecture relationships field is not an array', async () => {
        const response = await request(app)
            .post('/calm/validate/with-pattern')
            .send({ architecture: JSON.stringify({ $schema: 'https://example.com/schema', relationships: 'not-an-array' }), pattern: JSON.stringify({ $id: 'https://example.com/schema', type: 'object' }) });
            
        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            error: 'The "relationships" field in the architecture must be an array'
        });
    });

    test('should return 500 when validation against pattern throws an unexpected error', async () => {
        vi.mocked(validate).mockRejectedValueOnce(new Error('unexpected validation failure'));

        const router: express.Router = express.Router();
        const mockSchemaDirectory = {
            loadSchemas: vi.fn().mockResolvedValue(undefined),
            getSchema: vi.fn()
        } as unknown as SchemaDirectory;
        const localApp = express();
        localApp.use(express.json());
        new ValidationRouter(router, mockSchemaDirectory);
        localApp.use('/calm/validate', router);

        const response = await request(localApp)
            .post('/calm/validate/with-pattern')
            .send({ architecture: JSON.stringify({ $schema: 'https://example.com/schema' }), pattern: JSON.stringify({ $id: 'https://example.com/schema', type: 'object' }) });
            
        expect(response.status).toBe(500);
        expect(response.body).toEqual({
            error: 'Failed to validate architecture against pattern'
        });
    });
    
    test('should return 201 when the architecture and pattern are valid', async () => {
        const fixturePath = path.join(
            __dirname,
            '../../../test_fixtures/validation_route/valid_instantiation_with_pattern.json'
        );
        const requestBody = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));

        const response = await request(app)
            .post('/calm/validate/with-pattern')
            .send(requestBody);
            
        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('jsonSchemaValidationOutputs');
        expect(response.body).toHaveProperty('spectralSchemaValidationOutputs');
        expect(response.body).toHaveProperty('hasErrors');
        expect(response.body).toHaveProperty('hasWarnings');
        expect(response.body.hasErrors).toBe(false);
        expect(response.body.hasWarnings).toBe(false);
    });

    test('should return 201 with errors when architecture does not conform to the provided pattern', async () => {
        const architecture = JSON.stringify({ '$schema': 'example schema', nodes :[], relationships: [] });
        const pattern = JSON.stringify({
            $id: 'example schema',
            type: 'object',
            properties: { nodes: { type: 'array', minItems: 99} },
            required: ['nodes']
        });

        const response = await request(app)
            .post('/calm/validate/with-pattern')
            .send({ architecture, pattern });
            
        expect(response.status).toBe(201);
        expect(response.body.hasErrors).toBe(true);
    });

    test('should return 400 when the parsed architecture is not an object', async () => {
        const response = await request(app)
            .post('/calm/validate/with-pattern')
            .send({ architecture: 'null', pattern: JSON.stringify({ $id: 'https://example.com/schema'}) });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            error: 'The architecture must be a JSON object'
        });
    });

    test('should return 400 when the parsed pattern is not an object', async () => {
        const response = await request(app)
            .post('/calm/validate/with-pattern')
            .send({ architecture: JSON.stringify({ $schema: 'https://example.com/schema'}), pattern: '42' });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            error: 'The pattern must be a JSON object'
        });
    });

    test.each([
        '/etc/passwd.json',
        'C:\\secret.json',
        'file:///etc/passwd.json',
        '../../etc/passwd.json'
    ])('should return 400 when the pattern contains a $ref to a local/non-permitted location (%s)', async (ref) => {
        const schemaId = 'https://example.com/schema';
        const architecture = JSON.stringify({ $schema: schemaId });
        const pattern = JSON.stringify({
            $id: schemaId,
            type: 'object',
            properties: { malicious: { $ref: ref } }
        });

        const response = await request(app)
            .post('/calm/validate/with-pattern')
            .send({ architecture, pattern });
            
        expect(response.status).toBe(400);
        expect(response.body.error).toContain('non-permitted location');
        expect(response.body.error).toContain(ref);
    }); 

});

describe('findDisallowedPatternRef (pattern $ref guard)', () => {
    const patternWith = (ref: string) => ({ type: 'object', properties: { x: { $ref: ref } } });
    
    test.each([
        '#/defs/node',
        '#',
        '#/$defs/node',
        'https://calm.finos.org/release/1.2/meta/core.json#defs/node',
        'http://example.com/schema.json',
    ])('allows %s (local fragment or http(s) URL)', (ref) => {
        expect(findDisallowedPatternRef(patternWith(ref))).toBeUndefined();
    });
    
    test.each([
        '/etc/passwd.json',
        'file:///etc/passwd.json',
        '../../etc/passwd.json',
        'relative/path.json',
        'C:\\secret.json',
        'calm://namespace/thing',
    ])('flags %s (local / non-permitted location)', (ref) => {
        expect(findDisallowedPatternRef(patternWith(ref))).toBe(ref);
    });

    test('returns undefined when there are no $refs', () => {
        expect(findDisallowedPatternRef({ type: 'object', properties: { x: { type: 'string' } } })).toBeUndefined();
    });

    test('finds a disallowed $ref nested inside arrays and objects', () => {
        const pattern = { allOf: [{ properties: { y: { prefixItems: [{ $ref: '/etc/x.json' }] } } }] };
        expect(findDisallowedPatternRef(pattern)).toBe('/etc/x.json');
    });

});
