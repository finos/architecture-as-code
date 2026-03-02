import { Router } from 'express';
import { ValidationRouter } from './validation-route';
import { HealthRouter } from './health-route';
import { SchemaDirectory } from '@finos/calm-shared';

const HEALTH_ROUTE_PATH = '/health';
const VALIDATE_ROUTE_PATH = '/calm/validate';

export class ServerRoutes {
    router: Router;

    constructor(
        schemaDirectory: SchemaDirectory,
        debug: boolean = false,
        rateLimitWindowMs: number = 900000, // 15 minutes
        rateLimitMaxRequests: number = 100
    ) {
        this.router = Router();
        const validateRouter = Router();
        this.router.use(VALIDATE_ROUTE_PATH, validateRouter);
        new ValidationRouter(validateRouter, schemaDirectory, debug, rateLimitWindowMs, rateLimitMaxRequests);

        const healthRouter = Router();
        this.router.use(HEALTH_ROUTE_PATH, healthRouter);
        new HealthRouter(healthRouter);
    }
}
