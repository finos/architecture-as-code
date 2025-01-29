import { Router } from 'express';
import { CLIServerRoutes } from './routes';
import { ValidationRouter } from './validation-route';
import { describe, it, expect, jest } from '@jest/globals';

jest.mock('express', () => ({
    Router: jest.fn(() => ({
        use: jest.fn(),
    })),
}));

jest.mock('./validation-route', () => ({
    ValidationRouter: jest.fn(),
}));

describe('CLIServerRoutes', () => {
    const schemaDirectoryPath = '/path/to/schema';

    it('should initialize router and routes correctly', () => {
        const cliServerRoutes = new CLIServerRoutes(schemaDirectoryPath);

        expect(Router).toHaveBeenCalled();
        expect(ValidationRouter).toHaveBeenCalledWith(cliServerRoutes.router, schemaDirectoryPath);
        expect(cliServerRoutes.router.use).toHaveBeenCalledWith('/calm/validate', cliServerRoutes.router);
    });
});