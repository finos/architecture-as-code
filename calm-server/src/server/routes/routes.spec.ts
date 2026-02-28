import { Router } from 'express';
import { ServerRoutes } from './routes';
import { ValidationRouter } from './validation-route';
import { HealthRouter } from './health-route';
import { SchemaDirectory } from '@finos/calm-shared';

vi.mock('express', () => ({
    Router: vi.fn()
}));

vi.mock('./validation-route', () => {
    return {
        ValidationRouter: vi.fn()
    };
});

vi.mock('./health-route', () => {
    return {
        HealthRouter: vi.fn()
    };
});

vi.mock('@finos/calm-shared', () => {
    return {
        SchemaDirectory: vi.fn()
    };
});
describe('ServerRoutes', () => {
    let schemaDirectory: SchemaDirectory;
    let serverRoutes: ServerRoutes;
    let mainRouter: Router;
    let validateRouter: Router;
    let healthRouter: Router;

    beforeEach(() => {
        mainRouter = { use: vi.fn() } as unknown as Router;
        validateRouter = { use: vi.fn() } as unknown as Router;
        healthRouter = { use: vi.fn() } as unknown as Router;
        const routerMock = Router as unknown as vi.Mock;
        routerMock.mockReset();
        routerMock
            .mockImplementationOnce(() => mainRouter)
            .mockImplementationOnce(() => validateRouter)
            .mockImplementationOnce(() => healthRouter);
        serverRoutes = new ServerRoutes(schemaDirectory);
        void serverRoutes;
    });

    it('should initialize router', () => {
        expect(Router).toHaveBeenCalled();
    });

    it('should set up validate route', () => {
        expect(mainRouter.use).toHaveBeenCalledWith('/calm/validate', validateRouter);
        expect(ValidationRouter).toHaveBeenCalledWith(validateRouter, schemaDirectory, false, 900000, 100);
    });

    it('should set up health route', () => {
        expect(mainRouter.use).toHaveBeenCalledWith('/health', healthRouter);
        expect(HealthRouter).toHaveBeenCalledWith(healthRouter);
    });
});
