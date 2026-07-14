import { SchemaDirectory, validate, ValidationOutcome, initLogger } from '@finos/calm-shared';
import type { Logger } from '@finos/calm-shared';
import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';

function isJsonObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isHttpUrl(value: string): boolean {
    return /^https?:\/\//i.test(value.trim());
}

function isAllowedPatternRef(ref: string): boolean {
    const trimmed = ref.trim();
    return trimmed.startsWith('#') || isHttpUrl(trimmed);
}

export function hasDisallowedPatternRef(value: unknown): boolean {
    if (Array.isArray(value)) {
        return value.some((item) => hasDisallowedPatternRef(item));
    }
    
    if (isJsonObject(value)) {
        return Object.entries(value).some(([key, val]) => 
            (key === '$ref' && typeof val === 'string' && !isAllowedPatternRef(val)) || hasDisallowedPatternRef(val)
        );
    }
    
    return false;
}

function hasNonArrayRelationships(architecture: Record<string, unknown>): boolean {
    return 'relationships' in architecture && !Array.isArray(architecture['relationships']);
}

function hasPattern(pattern: unknown): pattern is string {
    return typeof pattern === 'string' && pattern.trim() !== '';
}


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

        if (!isJsonObject(architecture)) {
            this.logger.error('Architecture is not a JSON object');
            return res.status(400).type('json').send(new ErrorResponse('The architecture must be a JSON object'));
        }

        if (hasNonArrayRelationships(architecture)) {
            this.logger.error('The "relationships" field in the architecture is not an array');
            return res.status(400).type('json').send(new ErrorResponse('The "relationships" field in the architecture must be an array'));
        }

        if (hasPattern(req.body.pattern)) {
            return this.validateAgainstPattern(architecture, req.body.pattern, res);
        }

        return this.validateAgainstSchema(architecture, res);
    };

    private validateAgainstSchema = async (
        architecture: Record<string, unknown>,
        res: Response<ValidationOutcome | ErrorResponse>
    ) => {
        const schema = architecture['$schema'];
        if (typeof schema !== 'string') {
            return res.status(400).type('json').send(new ErrorResponse('The "$schema" field in the architecture is missing or is not a string'));
        }

        if (!isHttpUrl(schema)) {
            this.logger.error(`The "$schema" field is not an http(s) URL: ${schema}`);
            return res.status(400).type('json').send(new ErrorResponse('The "$schema" field in the architecture must be an absolute http(s) URL'));
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
                return res.status(400).type('json').send(new ErrorResponse('The "$schema" field in the architecture references a schema that is not available to the server'));
            }
        } catch (err) {
            this.logger.error('Failed to load schema: ' + err);
            return res.status(500).type('json').send(new ErrorResponse('Failed to load schema: ' + err));
        }
        try {
            const outcome = await validate(architecture, foundSchema, undefined, this.schemaDirectory, true);
            return res.status(201).type('json').send(outcome);
        } catch (error) {
            this.logger.error('Failed to validate architecture: ' + error);
            return res.status(500).type('json').send(new ErrorResponse('Failed to validate architecture'));
        }
    };

    private validateAgainstPattern = async (
        architecture: Record<string, unknown>,
        patternRaw: string,
        res: Response<ValidationOutcome | ErrorResponse>
    ) => {
        let pattern;
        try {
            pattern = JSON.parse(patternRaw);
        } catch (error) {
            this.logger.error('Invalid JSON format for pattern ' + error);
            return res.status(400).type('json').send(new ErrorResponse('Invalid JSON format for pattern'));
        }

        if (!isJsonObject(pattern)) {
            this.logger.error('Pattern is not a JSON object');
            return res.status(400).type('json').send(new ErrorResponse('The pattern must be a JSON object'));
        }

        const schema = architecture['$schema'];
        if (typeof schema !== 'string') {
            return res.status(400).type('json').send(new ErrorResponse('The "$schema" field in the architecture is missing or is not a string'));
        }

        const patternId = pattern['$id'];
        if (typeof patternId !== 'string') {
            return res.status(400).type('json').send(new ErrorResponse('The "$id" field in the provided pattern is missing or is not a string'));
        }

        if (schema !== patternId) {
            this.logger.error(`The "$schema" field (${schema}) in the architecture does not match the "$id" field (${patternId}) in the pattern`);
            return res.status(400).type('json').send(new ErrorResponse(`The "$schema" field (${schema}) in the architecture does not match the "$id" field (${patternId}) in the pattern`));
        }

        if (hasDisallowedPatternRef(pattern)) {

            this.logger.error('Pattern contains a disallowed $ref');
            return res.status(400).type('json').send(new ErrorResponse(
                'The provided pattern contains a "$ref" to a non-permitted location. '
                + 'Only local fragment references (e.g. "#/defs/...") and absolute http(s) URLs to approved hosts are allowed.'
            ));
        }
        try {
            await this.ensureSchemasLoaded();
        } catch (error) {
            this.logger.error('Failed to load schemas: ' + error);
            return res.status(500).type('json').send(new ErrorResponse('Failed to load schemas'));
        }

        try {
            const outcome = await validate(architecture, pattern, undefined, this.schemaDirectory, true);
            return res.status(201).type('json').send(outcome);
        } catch (error) {
            this.logger.error('Failed to validate architecture against pattern: ' + error);
            return res.status(500).type('json').send(new ErrorResponse('Failed to validate architecture against pattern'));
        }
    };
}

class ErrorResponse {
    error: string;
    constructor(error: string) {
        this.error = error;
    }
}

interface ValidationRequest {
    architecture: string;
    pattern?: string;
}