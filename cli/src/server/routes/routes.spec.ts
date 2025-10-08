import { Router } from 'express';
import { CLIServerRoutes } from './routes';
import { ValidationRouter } from './validation-route';
import { HealthRouter } from './health-route';
import { SchemaDirectory } from '@finos/calm-shared';

const mockUse = vi.fn();
const mockRouter = {
    use: mockUse
};

vi.mock('express', () => ({
    Router: vi.fn(() => mockRouter)
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

vi.mock('@finos/calm-shared', () =>{
    return {
        SchemaDirectory: vi.fn()
    };
});
describe('CLIServerRoutes', () => {
    let schemaDirectory: SchemaDirectory;
    let cliServerRoutes: CLIServerRoutes;
    let mockRouter: Router;

    beforeEach(() => {
        cliServerRoutes = new CLIServerRoutes(schemaDirectory);
        mockRouter = cliServerRoutes.router;
    });

    it('should initialize router', () => {
        expect(Router).toHaveBeenCalled();
    });

    it('should set up validate route', () => {
        expect(mockRouter.use).toHaveBeenCalledWith('/calm/validate', mockRouter);
        expect(ValidationRouter).toHaveBeenCalled();
    });

    it('should set up health route', () => {
        expect(mockRouter.use).toHaveBeenCalledWith('/health', mockRouter);
        expect(HealthRouter).toHaveBeenCalled();
    });
});