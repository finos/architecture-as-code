import request from 'supertest';
import * as fs from 'fs';

import express, { Application } from 'express';
import { ValidationRouter } from './validation-route';
import path from 'path';
import { SchemaDirectory } from '@finos/calm-shared';
import { FileSystemDocumentLoader } from '@finos/calm-shared/dist/document-loader/file-system-document-loader';
import { vi } from 'vitest';

const schemaDirectoryPath: string = __dirname + '/../../../../calm/release';
const apiGatewayPatternPath: string =
    __dirname + '/../../../test_fixtures/api-gateway';

describe('ValidationRouter', () => {
    let app: Application;

    beforeEach(() => {
        app = express();
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
    });
});
