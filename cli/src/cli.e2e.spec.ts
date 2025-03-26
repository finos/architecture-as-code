import { exec } from 'child_process';
import path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { parseStringPromise } from 'xml2js';
import util from 'util';
import axios from 'axios';



// Mock axios
vi.mock('axios');

const execPromise = util.promisify(exec);

describe('CLI Integration Tests', () => {

    let tempDir: string;
    const millisPerSecond = 1000;
    const integrationTestPrefix = 'calm-test';
    const projectRoot = __dirname;
    vi.setConfig({ testTimeout: 30 * millisPerSecond });

    beforeAll(async () => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), integrationTestPrefix));
        await callNpxFunction(`${projectRoot}/../..`, 'link cli');      // Link the CLI package to the top-level node_modules
    }, millisPerSecond * 20);

    afterAll(async () => {
        if (tempDir) {
            fs.rmSync(tempDir, { recursive: true });
        }
    }, millisPerSecond * 20);

    test('shows help if no arguments provided', async () => {
        const noArgCommand = 'calm';
        exec(noArgCommand, (error, _stdout, stderr) => {
            expect(error).not.toBeNull();
            expect(stderr).toContain('A set of tools for interacting with the Common Architecture Language Model');
            expect(stderr).toContain('Usage:');
        });
    });

    test('shows help if -h provided', async () => {
        const helpShortFlagCommand = 'calm -h';
        exec(helpShortFlagCommand, (_error, stdout, _stderr) => {
            expect(stdout).toContain('A set of tools for interacting with the Common Architecture Language Model');
            expect(stdout).toContain('Usage:');
        });
    });

    test('shows help if --help provided', async () => {
        const helpLongFlagCommand = 'calm --help';
        exec(helpLongFlagCommand, (_error, stdout, _stderr) => {
            expect(stdout).toContain('A set of tools for interacting with the Common Architecture Language Model');
            expect(stdout).toContain('Usage:');
        });
    });

    test('example validate command - outputting JSON to stdout', async () => {
        const exampleValidateCommand = 'calm validate -p ../calm/pattern/api-gateway.json -a ../calm/samples/api-gateway-architecture.json';
        exec(exampleValidateCommand, (_error, stdout, _stderr) => {
            const parsedOutput = JSON.parse(stdout);
            const expectedFilePath = path.join(__dirname, '../test_fixtures/validate_output.json');
            const expectedJson = JSON.parse(fs.readFileSync(expectedFilePath, 'utf-8'));
            expect(parsedOutput).toEqual(expectedJson);
        });
    });

    test('example validate command - outputting JSON to file', async () => {
        const targetOutputFile = path.join(tempDir, 'validate-output.json');
        const exampleValidateCommand = `calm validate -p ../calm/pattern/api-gateway.json -a ../calm/samples/api-gateway-architecture.json -o ${targetOutputFile}`;
        exec(exampleValidateCommand, (_error, _stdout, _stderr) => {
            expect(fs.existsSync(targetOutputFile)).toBeTruthy();

            const outputString = fs.readFileSync(targetOutputFile, 'utf-8');
            const parsedOutput = JSON.parse(outputString);

            const expectedFilePath = path.join(__dirname, '../test_fixtures/validate_output.json');
            const expectedJson = JSON.parse(fs.readFileSync(expectedFilePath, 'utf-8'));

            expect(parsedOutput).toEqual(expectedJson);
        });
    });

    test('example validate command - outputting JUNIT to stdout', async () => {
        const exampleValidateCommand = 'calm validate -p ../calm/pattern/api-gateway.json -a ../calm/samples/api-gateway-architecture.json -f junit';
        exec(exampleValidateCommand, async (_error, stdout, _stderr) => {
            const parsedOutput = await parseStringPromise(stdout);

            const expectedFilePath = path.join(__dirname, '../test_fixtures/validate_output_junit.xml');
            const expectedXmlString = fs.readFileSync(expectedFilePath, 'utf-8');
            const expectedXml = await parseStringPromise(expectedXmlString);

            expect(parsedOutput).toEqual(expectedXml);
        });
    });

    test('example validate command - outputting JUNIT to file', async () => {
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
        });
    });


    test('example generate command - does it give the output we expect', async () => {
        const targetOutputFile = path.join(tempDir, 'generate-output.json');
        const exampleGenerateCommand = `calm generate -p ../calm/pattern/api-gateway.json -o ${targetOutputFile}`;
        exec(exampleGenerateCommand, async (_error, _stdout, _stderr) => {

            const outputString = fs.readFileSync(targetOutputFile, 'utf-8');
            const parsedOutput = JSON.parse(outputString);


            const expectedFilePath = path.join(__dirname, '../test_fixtures/generate_output.json');
            const expectedJson = JSON.parse(fs.readFileSync(expectedFilePath, 'utf-8'));

            expect(parsedOutput).toEqual(expectedJson);
        });
    });

    test('example validate command - outputting PRETTY to stdout', async () => {
        const exampleValidateCommand = 'calm validate -p ../calm/pattern/api-gateway.json -a ../calm/samples/api-gateway-architecture.json -f pretty';
        exec(exampleValidateCommand, (_error, stdout, _stderr) => {
            const expectedFilePath = path.join(__dirname, '../test_fixtures/validate_output_pretty.txt');
            const expectedOutput = fs.readFileSync(expectedFilePath, 'utf-8');
            //Some minor replacement logic to avoid issues with line endings
            expect(stdout.replace(/\r\n/g, '\n')).toEqual(expectedOutput.replace(/\r\n/g, '\n'));
        });
    });

    test('example validate command - outputting PRETTY to file', async () => {
        const targetOutputFile = path.join(tempDir, 'validate-output-pretty.txt');
        const exampleValidateCommand = `calm validate -p ../calm/pattern/api-gateway.json -a ../calm/samples/api-gateway-architecture.json -f pretty -o ${targetOutputFile}`;
        exec(exampleValidateCommand, (_error, _stdout, _stderr) => {
            expect(fs.existsSync(targetOutputFile)).toBeTruthy();

            const outputString = fs.readFileSync(targetOutputFile, 'utf-8');
            const expectedFilePath = path.join(__dirname, '../test_fixtures/validate_output_pretty.txt');
            const expectedOutput = fs.readFileSync(expectedFilePath, 'utf-8');

            //Some minor replacement logic to avoid issues with line endings
            expect(outputString.replace(/\r\n/g, '\n')).toEqual(expectedOutput.replace(/\r\n/g, '\n'));
        });
    });

    test('example validate command - fails when neither an architecture or a pattern is provided', async () => {
        const calmValidateCommand = 'calm validate';
        exec(calmValidateCommand, (error, _stdout, stderr) => {
            expect(error).not.toBeNull();
            expect(stderr).toContain('error: one of the required options \'-p, --pattern <file>\' or \'-a, --architecture <file>\' was not specified');
        });
    });

    test('example validate command - validates an architecture only', async () => {
        const calmValidateArchitectureOnlyCommand = 'calm validate -a ../calm/samples/api-gateway-architecture.json';
        exec(calmValidateArchitectureOnlyCommand, (error, stdout, _stderr) => {
            const expectedFilePath = path.join(__dirname, '../test_fixtures/validate_architecture_only_output.json');
            const expectedOutput = fs.readFileSync(expectedFilePath, 'utf-8');
            expect(error).toBeNull();
            expect(stdout).toContain(expectedOutput);
        });
    });

    test('example server command - starts server and responds to requests', async () => {
        // Mock the axios response
        const mockResponse = { status: 200, data: { status: 'ok' } };
        (axios.get as vi.Mock).mockResolvedValue(mockResponse);

        const serverCommand = 'calm server -p 3001 --schemaDirectory ../../dist/calm/';
        const serverProcess = exec(serverCommand);
        // Give the server some time to start
        await new Promise(resolve => setTimeout(resolve, 5 * millisPerSecond));
        try {
            const response = await axios.get('http://127.0.0.1:3001/health');
            expect(response.status).toBe(200);
            expect(response.data.status).toBe('ok');
        } finally {
            serverProcess.kill();
        }
    });

    test('example template command - generates expected output', async () => {

        const fixtureDir = path.resolve(__dirname, '../test_fixtures/template');
        const testModelPath = path.join(fixtureDir, 'model/document-system.json');
        const localDirectory = path.join(fixtureDir, 'model/url-to-file-directory.json');
        const templateBundlePath = path.join(fixtureDir, 'template-bundles/doc-system');
        const expectedOutput = path.join(fixtureDir, 'expected-output/cli-e2e-output.html');
        const outputDir = path.resolve(__dirname, 'output');
        const outputFile = path.join(outputDir, 'cli-e2e-output.html');

        const templateCommand = `calm template --input ${testModelPath} --bundle ${templateBundlePath} --output ${outputDir} --url-to-local-file-mapping ${localDirectory}`;
        await execPromise(templateCommand);

        await new Promise(resolve => setTimeout(resolve, 2 * millisPerSecond));

        expect(fs.existsSync(outputFile)).toBe(true);

        if (fs.existsSync(outputFile)) {
            const actualContent = fs.readFileSync(outputFile, 'utf8').trim();
            const expectedContent = fs.readFileSync(expectedOutput, 'utf8').trim();

            expect(actualContent).toEqual(expectedContent);

            if (fs.existsSync(outputDir)) {
                fs.rmSync(outputDir, { recursive: true, force: true });
            }
        }
    });

    test('example docify command - generates expected output', async () => {
        const fixtureDir = path.resolve(__dirname, '../test_fixtures/template');
        const testModelPath = path.join(fixtureDir, 'model/document-system.json');
        const localDirectory = path.join(fixtureDir, 'model/url-to-file-directory.json');
        const outputDir = path.resolve(__dirname, 'output/documentation');

        const expectedFiles = [
            'docs/index.md',
            'docs/flows/flow-document-upload.md',
            'docs/nodes/document-system.md',
            'docs/nodes/db-docs.md',
            'docs/nodes/svc-storage.md',
            'docs/nodes/svc-upload.md'
        ].map(file => path.join(outputDir, file));

        try {
            const templateCommand = `calm docify --input ${testModelPath} --output ${outputDir} --url-to-local-file-mapping ${localDirectory}`;
            await execPromise(templateCommand);

            await new Promise(resolve => setTimeout(resolve, 2 * 1000));

            for (const file of expectedFiles) {
                expect(fs.existsSync(file)).toBeTruthy();
            }
        } finally {
            if (fs.existsSync(outputDir)) {
                fs.rmSync(outputDir, { recursive: true, force: true });
            }
        }
    });


});

async function callNpxFunction(projectRoot: string, command: string) {
    await execPromise(`npx ${command}`, { cwd: projectRoot });
}
