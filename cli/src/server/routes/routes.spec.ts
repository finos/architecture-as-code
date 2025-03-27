import { Router } from 'express';
import { CLIServerRoutes } from './routes';
import { ValidationRouter } from './validation-route';
import { HealthRouter } from './health-route';

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

describe('CLIServerRoutes', () => {
    let schemaDirectoryPath: string;
    let cliServerRoutes: CLIServerRoutes;
    let mockRouter: Router;

    beforeEach(() => {
        schemaDirectoryPath = '/path/to/schema';
        cliServerRoutes = new CLIServerRoutes(schemaDirectoryPath);
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