import { Router } from 'express';
import { ValidationRouter } from './validation-route';
import { HealthRouter } from './health-route';
import { SchemaDirectory } from '@finos/calm-shared';

const HEALTH_ROUTE_PATH = '/health';
const VALIDATE_ROUTE_PATH = '/calm/validate';

export class CLIServerRoutes {
    router: Router;

    constructor(schemaDirectory: SchemaDirectory, debug: boolean = false) {
        this.router = Router();
        const validateRoute = this.router.use(VALIDATE_ROUTE_PATH, this.router);
        new ValidationRouter(validateRoute, schemaDirectory, debug);
        const healthRoute = this.router.use(HEALTH_ROUTE_PATH, this.router);
        new HealthRouter(healthRoute);
    }
}