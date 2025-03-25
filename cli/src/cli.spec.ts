jest.mock('@finos/calm-shared', () => ({
    runGenerate: jest.fn(),
    TemplateProcessor: jest.fn().mockImplementation(() => ({
        processTemplate: jest.fn().mockResolvedValue(undefined),
    })),
    Docifier: jest.fn().mockImplementation(() => ({
        docify: jest.fn().mockResolvedValue(undefined),
    }))
}));

jest.mock('./server/cli-server', () => ({
    startServer: jest.fn(),
}));

jest.mock('./command-helpers/validate', () => ({
    runValidate: jest.fn(() => Promise.resolve()),
    checkValidateOptions: jest.fn(() => Promise.resolve()),
}));

jest.mock('./command-helpers/template', () => ({
    getUrlToLocalFileMap: jest.fn()
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

    test('example validate command - outputting JUNIT to stdout', (done) => {
        const exampleValidateCommand = 'calm validate -p ../calm/pattern/api-gateway.json -a ../calm/samples/api-gateway-architecture.json -f junit';
        exec(exampleValidateCommand, async (_error, stdout, _stderr) => {
            const parsedOutput = await parseStringPromise(stdout);

            const expectedFilePath = path.join(__dirname, '../test_fixtures/validate_output_junit.xml');
            const expectedXmlString = fs.readFileSync(expectedFilePath, 'utf-8');
            const expectedXml = await parseStringPromise(expectedXmlString);

            expect(parsedOutput).toEqual(expectedXml);
            done();
        });
    });

    test('example validate command - outputting JUNIT to file', (done) => {
        const targetOutputFile = path.join(tempDir, 'validate-output.xml');
        const exampleValidateCommand = `calm validate -p ../calm/pattern/api-gateway.json -a ../calm/samples/api-gateway-architecture.json -f junit -o ${targetOutputFile}`;
        exec(exampleValidateCommand, async (_error, _stdout, _stderr) => {
            expect(fs.existsSync(targetOutputFile)).toBeTruthy();

            const outputString = fs.readFileSync(targetOutputFile, 'utf-8');
            const parsedOutput = await parseStringPromise(outputString);

            const expectedFilePath = path.join(__dirname, '../test_fixtures/validate_output_junit.xml');
            const expectedXmlString = fs.readFileSync(expectedFilePath, 'utf-8');
            const expectedXml = await parseStringPromise(expectedXmlString);

            expect(parsedOutput).toEqual(expectedXml);

            done();
        });
    });


    test('example generate command - does it give the output we expect', (done) => {
        const targetOutputFile = path.join(tempDir, 'generate-output.json');
        const exampleGenerateCommand = `calm generate -p ../calm/pattern/api-gateway.json -o ${targetOutputFile}`;
        exec(exampleGenerateCommand, async (_error, _stdout, _stderr) => {

            const outputString = fs.readFileSync(targetOutputFile, 'utf-8');
            const parsedOutput = JSON.parse(outputString);


            const expectedFilePath = path.join(__dirname, '../test_fixtures/generate_output.json');
            const expectedJson = JSON.parse(fs.readFileSync(expectedFilePath, 'utf-8'));

            expect(parsedOutput).toEqual(expectedJson);

            done();
        });
    });

    test('example validate command - outputting PRETTY to stdout', (done) => {
        const exampleValidateCommand = 'calm validate -p ../calm/pattern/api-gateway.json -a ../calm/samples/api-gateway-architecture.json -f pretty';
        exec(exampleValidateCommand, (_error, stdout, _stderr) => {
            const expectedFilePath = path.join(__dirname, '../test_fixtures/validate_output_pretty.txt');
            const expectedOutput = fs.readFileSync(expectedFilePath, 'utf-8');
            //Some minor replacement logic to avoid issues with line endings
            expect(stdout.replace(/\r\n/g, '\n')).toEqual(expectedOutput.replace(/\r\n/g, '\n'));
            done();
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
            const {getUrlToLocalFileMap} = jest.requireMock('./command-helpers/template');
            (getUrlToLocalFileMap as jest.Mock).mockReturnValue(new Map<string, string>);

            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const TemplateProcessorMock = (require('@finos/calm-shared').TemplateProcessor as jest.Mock);
            await import('./index');
            expect(TemplateProcessorMock.mock.calls.length).toBe(1);
            expect(TemplateProcessorMock.mock.calls[0]).toEqual(['model.json', 'templateDir', 'outDir', new Map<string, string>()]);
        });

        it('should instantiate TemplateProcessor with additional url to file map', async () => {
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
                '--url-to-local-file-mapping',
                'url-to-file-directory.json',
                '--verbose'
            ];
            const urlToLocalFileMap = new Map<string, string>([
                ['https://calm.finos.org/docuflow/flow/document-upload', 'flows/flow-document-upload.json'],
            ]);

            const {getUrlToLocalFileMap} = jest.requireMock('./command-helpers/template');
            (getUrlToLocalFileMap as jest.Mock).mockReturnValue(urlToLocalFileMap);
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const TemplateProcessorMock = (require('@finos/calm-shared').TemplateProcessor as jest.Mock);
            await import('./index');
            expect(TemplateProcessorMock.mock.calls.length).toBe(1);
            expect(TemplateProcessorMock.mock.calls[0]).toEqual(['model.json', 'templateDir', 'outDir', urlToLocalFileMap]);
        });
    });


    describe('Docify Command', () => {

        it('should instantiate Docifier with additional url to file map', async () => {
            process.argv = [
                'node',
                'cli.js',
                'docify',
                '--input',
                'model.json',
                '--output',
                'outDir',
                '--url-to-local-file-mapping',
                'url-to-file-directory.json',
                '--verbose'
            ];

            const urlToLocalFileMap = new Map<string, string>([
                ['https://calm.finos.org/docuflow/flow/document-upload', 'flows/flow-document-upload.json'],
            ]);

            const { getUrlToLocalFileMap } = jest.requireMock('./command-helpers/template');
            (getUrlToLocalFileMap as jest.Mock).mockReturnValue(urlToLocalFileMap);
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const DocifierMock = require('@finos/calm-shared').Docifier;
            await import('./index');

            expect(DocifierMock).toHaveBeenCalledTimes(1);
            expect(DocifierMock).toHaveBeenCalledWith('WEBSITE', 'model.json', 'outDir', urlToLocalFileMap);

        });
    });
});

