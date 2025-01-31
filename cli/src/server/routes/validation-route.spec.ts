import request from 'supertest';
import * as fs from 'fs';

import express, { Application } from 'express';
import { ValidationRouter } from './validation-route';
import path from 'path';

const schemaDirectory : string = __dirname + '/../../../../calm';

describe('ValidationRouter', () => {
    let app: Application;

    beforeEach(() => {
        app = express();
        app.use(express.json());

        const router: express.Router = express.Router();
        new ValidationRouter(router, schemaDirectory);
        app.use('/calm/validate', router);
    });

    test('should return 400 when $schema is not specified', async () => {
        const expectedFilePath = path.join(__dirname, '../../../test_fixtures/validation_route/invalid_api_gateway_instantiation_missing_schema_key.json');
        const invalidArchitectureMissingSchema = JSON.parse(
            fs.readFileSync(expectedFilePath, 'utf-8')
        );
        const response = await request(app)
            .post('/calm/validate')
            .send(invalidArchitectureMissingSchema);

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: 'The "$schema" field is missing from the request body' });
    });

    test('should return 400 when the $schema specified in the instantiation is not found', async () => {
        const expectedFilePath = path.join(__dirname, '../../../test_fixtures/validation_route/invalid_api_gateway_instantiation_schema_points_to_missing_schema.json');
        const invalidArchitectureMissingSchema = JSON.parse(
            fs.readFileSync(expectedFilePath, 'utf-8')
        );
        const response = await request(app)
            .post('/calm/validate')
            .send(invalidArchitectureMissingSchema);

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: 'The "$schema" field referenced is not available to the server' });
    });

    test('should return 201 when the schema is valid', async () => {
        const expectedFilePath = path.join(__dirname, '../../../test_fixtures/validation_route/valid_instantiation.json');
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

    test('should return 200 for health check', async () => {
        const response = await request(app)
            .get('/calm/validate/health');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ status: 'OK' });
    });
});

// });