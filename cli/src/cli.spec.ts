jest.mock('@finos/calm-shared', () => ({
    ...jest.requireActual('@finos/calm-shared'),
    runGenerate: jest.fn(),
    TemplateProcessor: jest.fn().mockImplementation(() => ({
        processTemplate: jest.fn().mockResolvedValue(undefined),
    })),
}));

jest.mock('./server/cli-server', () => ({
    startServer: jest.fn(),
}));

jest.mock('./validate/validate', () => ({
    runValidate: jest.fn(() => Promise.resolve()),
    checkValidateOptions: jest.fn(() => Promise.resolve()),
}));

describe('CLI Commands', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    describe('Generate Command', () => {
        it('should call runGenerate with correct arguments', async () => {
            process.argv = [
                'node',
                'cli.js',
                'generate',
                '-p',
                'pattern.json',
                '-o',
                'output.json',
                '--verbose',
                '--generateAll',
                '--schemaDirectory',
                'schemas'
            ];
            await import('./index');
            const { runGenerate } = jest.requireMock('@finos/calm-shared');
            expect(runGenerate).toHaveBeenCalledTimes(1);
            expect(runGenerate).toHaveBeenCalledWith(
                'pattern.json',
                'output.json',
                true,
                true,
                'schemas'
            );
        });
    });

    describe('Validate Command', () => {
        it('should call runValidate with correct options', async () => {
            process.argv = [
                'node',
                'cli.js',
                'validate',
                '-p',
                'pattern.json',
                '-a',
                'arch.json'
            ];
            const { runValidate, checkValidateOptions } = jest.requireMock('./validate/validate');
            await import('./index');
            expect(checkValidateOptions).toHaveBeenCalledTimes(1);
            expect(runValidate).toHaveBeenCalledTimes(1);
            expect(runValidate.mock.calls[0][0]).toEqual(
                expect.objectContaining({
                    pattern: 'pattern.json',
                    architecture: 'arch.json'
                })
            );
        });

    });

    describe('Server Command', () => {
        it('should call startServer with correct options', async () => {
            process.argv = [
                'node',
                'cli.js',
                'server',
                '--port',
                '4000',
                '--schemaDirectory',
                'mySchemas',
                '--verbose'
            ];
            await import('./index');
            const { startServer } = jest.requireMock('./server/cli-server');
            expect(startServer).toHaveBeenCalledTimes(1);
            expect(startServer).toHaveBeenCalledWith({
                port: '4000',
                schemaDirectory: 'mySchemas',
                verbose: true
            });
        });
    });

    describe('Template Command', () => {
        it('should instantiate TemplateProcessor with correct arguments and call processTemplate', async () => {
            process.argv = [
                'node',
                'cli.js',
                'template',
                '--input',
                'model.json',
                '--bundle',
                'templateDir',
                '--output',
                'outDir',
                '--verbose'
            ];
            await import('./index');//
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const TemplateProcessorMock = (require('@finos/calm-shared').TemplateProcessor as jest.Mock);
            await import('./index');
            expect(TemplateProcessorMock.mock.calls.length).toBe(1);
            expect(TemplateProcessorMock.mock.calls[0]).toEqual(['model.json', 'templateDir', 'outDir']);
        });
    });
});
