import { Router } from 'express';
import { CLIServerRoutes } from './routes';
import { ValidationRouter } from './validation-route';



const mockUse = jest.fn();
const mockRouter = {
    use: mockUse
};

jest.mock('express', () => ({
    Router: jest.fn(() => mockRouter)
}));

jest.mock('./validation-route', () => {
    return {
        ValidationRouter: jest.fn()
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
});