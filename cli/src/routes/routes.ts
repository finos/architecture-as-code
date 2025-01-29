import { Router } from 'express';
import { ValidationRouter } from './validation-route';

const VALIDATE_ROUTE_PATH = '/calm/validate';

export class CLIServerRoutes {
    router: Router;

    constructor(schemaDirectoryPath: string) {
        this.router = Router();
        this.initializeRoutes(schemaDirectoryPath);
    }

    private initializeRoutes(schemaDirectoryPath: string) {
        new ValidationRouter(this.router, schemaDirectoryPath);
        this.router.use(VALIDATE_ROUTE_PATH, this.router);
    }
}