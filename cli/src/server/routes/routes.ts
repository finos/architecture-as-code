import { Router } from 'express';
import { ValidationRouter } from './validation-route';

const VALIDATE_ROUTE_PATH = '/calm/validate';

export class CLIServerRoutes {
    router: Router;

    constructor(schemaDirectoryPath: string, debug: boolean = false) {
        this.router = Router();
        const validateRoute = this.router.use(VALIDATE_ROUTE_PATH, this.router);
        new ValidationRouter(validateRoute, schemaDirectoryPath, debug);
    }
}