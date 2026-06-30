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

export function findDisallowedPatternRef(value: unknown): string | undefined {
    if (Array.isArray(value)) {
        for (const item of value) {
            const disallowed = findDisallowedPatternRef(item);
            if (disallowed !== undefined) {
                return disallowed;
            }
        }
        return undefined;
    }
    
    if (isJsonObject(value)) {
        for (const [key, val] of Object.entries(value)) {
            if (key === '$ref' && typeof val === 'string' && !isAllowedPatternRef(val)) {
                return val;
            }
            const disallowed = findDisallowedPatternRef(val);
            if (disallowed !== undefined) {
                return disallowed;
            }
        }
    }
    
    return undefined;
}

function hasNonArrayRelationships(architecture: Record<string, unknown>): boolean {
    return 'relationships' in architecture && !Array.isArray(architecture['relationships']);
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
        router.post('/with-pattern', this.validateWithPattern);
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

        const schema = architecture['$schema'] as string | undefined;
        if (!schema) {
            return res.status(400).type('json').send(new ErrorResponse('The "$schema" field is missing from the request body'));
        }

        if (!isHttpUrl(schema)) {
            this.logger.error(`The "$schema" field is not an http(s) URL: ${schema}`);
            return res.status(400).type('json').send(new ErrorResponse('The "$schema" field must be an absolute http(s) URL'));
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
            this.logger.error('Failed to validate architecture: ' + error);
            return res.status(500).type('json').send(new ErrorResponse('Failed to validate architecture'));
        }
    };

    private validateWithPattern = async (
        req: Request<Record<string, never>, ValidationOutcome | ErrorResponse, ValidationWithPatternRequest>,
        res: Response<ValidationOutcome | ErrorResponse>
    ) => {
        let architecture;
        try {
            architecture = JSON.parse(req.body.architecture);
        } catch (error) {
            this.logger.error('Invalid JSON format for architecture ' + error);
            return res.status(400).type('json').send(new ErrorResponse('Invalid JSON format for architecture'));
        }

        if(!isJsonObject(architecture)) {
            this.logger.error('Architecture is not a JSON object');
            return res.status(400).type('json').send(new ErrorResponse('The architecture must be a JSON object'));
        }

        if (hasNonArrayRelationships(architecture)) {
            this.logger.error('The "relationships" field in the architecture is not an array');
            return res.status(400).type('json').send(new ErrorResponse('The "relationships" field in the architecture must be an array'));
        }

        let pattern;
        try {
            pattern = JSON.parse(req.body.pattern);
        } catch (error) {
            this.logger.error('Invalid JSON format for pattern ' + error);
            return res.status(400).type('json').send(new ErrorResponse('Invalid JSON format for pattern'));
        }

        if(!isJsonObject(pattern)) {
            this.logger.error('Pattern is not a JSON object');
            return res.status(400).type('json').send(new ErrorResponse('The pattern must be a JSON object'));
        }

        const schema = architecture['$schema'] as string | undefined;
        if (!schema) {
            return res.status(400).type('json').send(new ErrorResponse('The "$schema" field is missing from the request body'));
        }

        const patternId = pattern['$id'] as string | undefined;
        if (!patternId) {
            return res.status(400).type('json').send(new ErrorResponse('The "$id" field is missing from the provided pattern'));
        }

        if (schema !== patternId) {
            this.logger.error(`The "$schema" field (${schema}) in the architecture does not match the "$id" field (${patternId}) in the pattern`);
            return res.status(400).type('json').send(new ErrorResponse(`The "$schema" field (${schema}) in the architecture does not match the "$id" field (${patternId}) in the pattern`));
        }

        const disallowedRef = findDisallowedPatternRef(pattern);
        if (disallowedRef !== undefined) {
            this.logger.error(`Pattern contains a disallowed $ref: ${disallowedRef}`);
            return res.status(400).type('json').send(new ErrorResponse(
                `The provided pattern contains a "$ref" to a non-permitted location: "${disallowedRef}". `
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

class ValidationRequest {
    architecture!: string;
}

class ValidationWithPatternRequest {
    architecture!: string;
    pattern!: string;
}