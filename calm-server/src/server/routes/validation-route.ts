import { SchemaDirectory, validate, ValidationOutcome, initLogger } from '@finos/calm-shared';
import type { Logger } from '@finos/calm-shared';
import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';

export class ValidationRouter {
    private schemaDirectory: SchemaDirectory;
    private logger: Logger;
    private schemaLoadPromise: Promise<void> | null = null;

    constructor(
        router: Router,
        schemaDirectory: SchemaDirectory,
        debug: boolean = false,
        rateLimitWindowMs: number = 900000, // 15 minutes
        rateLimitMaxRequests: number = 100
    ) {
        const limiter = rateLimit({
            windowMs: rateLimitWindowMs,
            max: rateLimitMaxRequests,
        });
        this.schemaDirectory = schemaDirectory;
        this.logger = initLogger(debug, 'calm-server');
        router.use(limiter);
        this.initializeRoutes(router);
    }

    private initializeRoutes(router: Router) {
        router.post('/', this.validateSchema);
    }

    private async ensureSchemasLoaded() {
        if (!this.schemaLoadPromise) {
            this.schemaLoadPromise = this.schemaDirectory.loadSchemas().catch((error) => {
                this.schemaLoadPromise = null;
                throw error;
            });
        }

        await this.schemaLoadPromise;
    }

    private validateSchema = async (
        req: Request<Record<string, never>, ValidationOutcome | ErrorResponse, ValidationRequest>,
        res: Response<ValidationOutcome | ErrorResponse>
    ) => {
        let architecture;
        try {
            architecture = JSON.parse(req.body.architecture);
        } catch (error) {
            this.logger.error('Invalid JSON format for architecture ' + error);
            return res.status(400).type('json').send(new ErrorResponse('Invalid JSON format for architecture'));
        }

        const schema = architecture['$schema'];
        if (!schema) {
            return res.status(400).type('json').send(new ErrorResponse('The "$schema" field is missing from the request body'));
        }

        try {
            await this.ensureSchemasLoaded();
        } catch (error) {
            this.logger.error('Failed to load schemas: ' + error);
            return res.status(500).type('json').send(new ErrorResponse('Failed to load schemas'));
        }
        let foundSchema;
        try {
            foundSchema = await this.schemaDirectory.getSchema(schema);
            if (!foundSchema) {
                this.logger.error('Schema with $id ' + schema + ' not found');
                return res.status(400).type('json').send(new ErrorResponse('The "$schema" field referenced is not available to the server'));
            }
        } catch (err) {
            this.logger.error('Failed to load schema: ' + err);
            return res.status(500).type('json').send(new ErrorResponse('Failed to load schema: ' + err));
        }
        try {
            const outcome = await validate(architecture, foundSchema, undefined, this.schemaDirectory, true);
            return res.status(201).type('json').send(outcome);
        } catch (error) {
            return res.status(500).type('json').send(new ErrorResponse(error.message));
        }
    };
}

class ErrorResponse {
    error: string;
    constructor(error: string) {
        this.error = error;
    }
}

class ValidationRequest {
    architecture: string;
}
