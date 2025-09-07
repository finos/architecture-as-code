import { execSync } from 'child_process';
import path, { join } from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { execa } from 'execa';
import { parseStringPromise } from 'xml2js';
import axios from 'axios';
import { Mock } from 'vitest';
import { expectDirectoryMatch, expectFilesMatch } from '@finos/calm-shared';
import { spawn } from 'node:child_process';
vi.mock('axios');

const millisPerSecond = 1000;
const integrationTestPrefix = 'calm-consumer-test';
let tempDir: string;
const repoRoot = path.resolve(__dirname);

function run(file: string, args: string[]) {
    const cp = execa(file, args, { cwd: tempDir });
    cp.stdout?.pipe(process.stdout);
    cp.stderr?.pipe(process.stderr);
    return cp;
}

function calm(): string {
    return path.join(tempDir, 'node_modules/.bin/calm');
}

describe('CLI Integration Tests', () => {
    vi.setConfig({ testTimeout: 30 * millisPerSecond });

    beforeAll(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), integrationTestPrefix));

        const tgzName = execSync('npm pack', { cwd: repoRoot })
            .toString()
            .trim();

        const sourceTarball = path.join(repoRoot, tgzName);
        const targetTarball = path.join(tempDir, tgzName);
        fs.renameSync(sourceTarball, targetTarball);

        execSync('npm init -y', { cwd: tempDir, stdio: 'inherit' });
        execSync(`npm install ${targetTarball}`, {
            cwd: tempDir,
            stdio: 'inherit',
        });
    }, millisPerSecond * 30);

    afterAll(() => {
        if (tempDir) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('calm --version works', async () => {
        const { stdout } = await run(calm(), ['--version']);
        expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });

    test('shows help if no arguments provided', async () => {
        await expect(run(calm(), [])).rejects.toHaveProperty(
            'stderr',
            expect.stringContaining('Usage:')
        );
    });

    test('calm -h shows help', async () => {
        const { stdout } = await run(calm(), ['-h']);
        expect(stdout).toContain(
            'A set of tools for interacting with the Common Architecture Language Model'
        );
        expect(stdout).toContain('Usage:');
    });

    test('calm --help shows help', async () => {
        const { stdout } = await run(calm(), ['--help']);
        expect(stdout).toContain(
            'A set of tools for interacting with the Common Architecture Language Model'
        );
        expect(stdout).toContain('Usage:');
    });

    test('validate command outputs JSON to stdout', async () => {
        const apiGatewayPath = path.join(
            __dirname,
            '../test_fixtures/api-gateway/api-gateway.json'
        );
        const apiGatewayArchPath = path.join(
            __dirname,
            '../test_fixtures/api-gateway/api-gateway-architecture.json'
        );
        const { stdout } = await run(
            calm(), ['validate', '-p', apiGatewayPath, '-a', apiGatewayArchPath]
        );
        const expected = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, '../test_fixtures/validate_output.json'),
                'utf8'
            )
        );
        const parsedOutput = JSON.parse(stdout);
        removeLineNumbers(parsedOutput);
        removeLineNumbers(expected);
        expect(parsedOutput).toEqual(expected);
    });

    test('validate command outputs JSON to file', async () => {
        const apiGatewayPath = path.join(
            __dirname,
            '../test_fixtures/api-gateway/api-gateway.json'
        );
        const apiGatewayArchPath = path.join(
            __dirname,
            '../test_fixtures/api-gateway/api-gateway-architecture.json'
        );
        const targetOutputFile = path.join(tempDir, 'validate-output.json');
        await run(
            calm(), ['validate', '-p', apiGatewayPath, '-a', apiGatewayArchPath, '-o', targetOutputFile]
        );
        expect(fs.existsSync(targetOutputFile)).toBe(true);
        const expectedJson = JSON.parse(
            fs.readFileSync(targetOutputFile, 'utf8')
        );
        const parsedOutput = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, '../test_fixtures/validate_output.json'),
                'utf8'
            )
        );
        removeLineNumbers(parsedOutput);
        removeLineNumbers(expectedJson);
        expect(parsedOutput).toEqual(expectedJson);
    });

    test('validate command outputs JUNIT to stdout', async () => {
        const apiGatewayPath = path.join(
            __dirname,
            '../test_fixtures/api-gateway/api-gateway.json'
        );
        const apiGatewayArchPath = path.join(
            __dirname,
            '../test_fixtures/api-gateway/api-gateway-architecture.json'
        );
        const { stdout } = await run(
            calm(), ['validate', '-p', apiGatewayPath, '-a', apiGatewayArchPath, '-f', 'junit']
        );
        const actual = await parseStringPromise(stdout);
        const expected = await parseStringPromise(
            fs.readFileSync(
                path.join(
                    __dirname,
                    '../test_fixtures/validate_output_junit.xml'
                ),
                'utf8'
            )
        );
        expect(actual).toEqual(expected);
    });

    test('validate command outputs JUNIT to file', async () => {
        const apiGatewayPath = path.join(
            __dirname,
            '../test_fixtures/api-gateway/api-gateway.json'
        );
        const apiGatewayArchPath = path.join(
            __dirname,
            '../test_fixtures/api-gateway/api-gateway-architecture.json'
        );
        const targetOutputFile = path.join(tempDir, 'validate-output.xml');
        await run(
            calm(), ['validate', '-p', apiGatewayPath, '-a', apiGatewayArchPath, '-f', 'junit', '-o', targetOutputFile]
        );
        expect(fs.existsSync(targetOutputFile)).toBe(true);
        const actual = await parseStringPromise(
            fs.readFileSync(targetOutputFile, 'utf8')
        );
        const expected = await parseStringPromise(
            fs.readFileSync(
                path.join(
                    __dirname,
                    '../test_fixtures/validate_output_junit.xml'
                ),
                'utf8'
            )
        );
        expect(actual).toEqual(expected);
    });

    test('validate command outputs PRETTY to stdout', async () => {
        const p = path.join(
            __dirname,
            '../test_fixtures/api-gateway/api-gateway.json'
        );
        const a = path.join(
            __dirname,
            '../test_fixtures/api-gateway/api-gateway-architecture.json'
        );
        const { stdout } = await run(
            calm(), ['validate', '-p', p, '-a', a, '-f', 'pretty']
        );
        const expected = fs.readFileSync(
            path.join(__dirname, '../test_fixtures/validate_output_pretty.txt'),
            'utf8'
        );
        expect(stdout.trim().replace(/\r\n/g, '\n')).toEqual(
            expected.trim().replace(/\r\n/g, '\n')
        );
    });

    test('validate command fails when neither architecture nor pattern is provided', async () => {
        await expect(run(calm(), ['validate'])).rejects.toMatchObject({
            stderr: expect.stringContaining(
                'error: one of the required options \'-p, --pattern <file>\' or \'-a, --architecture <file>\' was not specified'
            )
        });
    });

    test('validate command validates an architecture only', async () => {
        const apiGatewayArchPath = path.join(__dirname, '../test_fixtures/api-gateway/api-gateway-architecture.json');
        const targetOutputFile = path.join(tempDir, 'validate-output.json');

        await run(calm(), ['validate', '-a', apiGatewayArchPath, '-o', targetOutputFile]);
        const outputFile = fs.readFileSync(targetOutputFile, 'utf-8');

        const parsedOutput = JSON.parse(outputFile);
        const expectedFilePath = path.join(__dirname, '../test_fixtures/validate_architecture_only_output.json');
        const expectedOutput = JSON.parse(fs.readFileSync(expectedFilePath, 'utf-8'));

        removeLineNumbers(parsedOutput);
        removeLineNumbers(expectedOutput);

        expect(parsedOutput).toEqual(expectedOutput);
    });



    test('generate command produces the expected output', async () => {
        const p = path.join(
            __dirname,
            '../test_fixtures/api-gateway/api-gateway.json'
        );
        const s = path.join(__dirname, '../../calm/release');
        const out = path.join(tempDir, 'generate-output.json');
        await run(calm(), ['generate', '-p', p, '-o', out, '-s', s]);
        const actual = JSON.parse(fs.readFileSync(out, 'utf8'));
        const expected = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, '../test_fixtures/generate_output.json'),
                'utf8'
            )
        );
        expect(actual).toEqual(expected);
    });

    test('server command starts and responds to /health', async () => {
        (axios.get as Mock).mockResolvedValue({
            status: 200,
            data: { status: 'ok' },
        });
        const serverProcess = spawn(
            calm(), ['server', '--port', '3002', '--schema-directory', '../../dist/calm/'],
            {
                cwd: tempDir,
                stdio: 'inherit',
                detached: true,
            }
        );
        await new Promise((r) => setTimeout(r, 5 * millisPerSecond));
        try {
            const res = await axios.get('http://127.0.0.1:3002/health');
            expect(res.status).toBe(200);
            expect(res.data.status).toBe('ok');
        } finally {
            process.kill(-serverProcess.pid);
        }
    });

    test('template command generates expected output', async () => {
        const fixtureDir = path.resolve(__dirname, '../test_fixtures/template');
        const testModelPath = path.join(
            fixtureDir,
            'model/document-system.json'
        );
        const localDirectory = path.join(
            fixtureDir,
            'model/url-to-file-directory.json'
        );
        const templateBundlePath = path.join(
            fixtureDir,
            'template-bundles/doc-system'
        );
        const expectedOutput = path.join(
            fixtureDir,
            'expected-output/cli-e2e-output.html'
        );
        const outputDir = path.join(tempDir, 'output');
        const outputFile = path.join(outputDir, 'cli-e2e-output.html');

        await run(
            calm(),
            [
                'template',
                '--architecture', testModelPath,
                '--bundle', templateBundlePath,
                '--output', outputDir,
                '--url-to-local-file-mapping', localDirectory
            ]
        );

        expect(fs.existsSync(outputFile)).toBe(true);
        const actualContent = fs.readFileSync(outputFile, 'utf8').trim();
        const expectedContent = fs.readFileSync(expectedOutput, 'utf8').trim();
        expect(actualContent).toEqual(expectedContent);
    });


    test('template command works with --template mode', async () => {
        const fixtureDir = path.resolve(__dirname, '../test_fixtures/template');
        const testModelPath = path.join(fixtureDir, 'model/document-system.json');
        const templatePath = path.join(fixtureDir, 'self-provided/single-template.hbs');
        const expectedOutputPath = path.join(fixtureDir, 'expected-output/single-template-output.md');
        const outputDir = path.join(tempDir, 'output-single-template');
        const outputFile = path.join(outputDir, 'simple-template-output.md');

        await run(
            calm(), ['template', '--architecture', testModelPath, '--template', templatePath, '--output', outputFile]
        );

        expect(fs.existsSync(outputFile)).toBe(true);
        const actual = fs.readFileSync(outputFile, 'utf8').trim();
        const expected = fs.readFileSync(expectedOutputPath, 'utf8').trim();
        expect(actual).toEqual(expected);
    });

    test('template command works with --template-dir mode', async () => {
        const fixtureDir = path.resolve(__dirname, '../test_fixtures/template');
        const testModelPath = path.join(fixtureDir, 'model/document-system.json');
        const templateDirPath = path.join(fixtureDir, 'self-provided/template-dir');
        const expectedOutputDir = path.join(fixtureDir, 'expected-output/template-dir');
        const actualOutputDir = path.join(tempDir, 'output-template-dir');

        await run(
            calm(), ['template', '--architecture', testModelPath, '--template-dir', templateDirPath, '--output', actualOutputDir]
        );

        await expectDirectoryMatch(expectedOutputDir, actualOutputDir);
    });



    test('docify command generates expected files', async () => {
        const fixtureDir = path.resolve(__dirname, '../test_fixtures/template');
        const testModelPath = path.join(
            fixtureDir,
            'model/document-system.json'
        );
        const localDirectory = path.join(
            fixtureDir,
            'model/url-to-file-directory.json'
        );
        const outputDir = path.join(tempDir, 'output/documentation');
        await run(
            calm(), ['docify', '--architecture', testModelPath, '--output', outputDir, '--url-to-local-file-mapping', localDirectory]
        );
        [
            'docs/index.md',
            'docs/flows/flow-document-upload.md',
            'docs/nodes/document-system.md',
            'docs/nodes/db-docs.md',
            'docs/nodes/svc-storage.md',
            'docs/nodes/svc-upload.md',
        ].forEach((f) =>
            expect(fs.existsSync(path.join(outputDir, f))).toBeTruthy()
        );
    });


    test('docify command works with --template mode', async () => {
        const fixtureDir = path.resolve(__dirname, '../test_fixtures/template');
        const testModelPath = path.join(fixtureDir, 'model/document-system.json');
        const localDirectory = path.join(fixtureDir, 'model/url-to-file-directory.json');
        const templatePath = path.join(fixtureDir, 'self-provided/single-template.hbs');
        const expectedOutputPath = path.join(fixtureDir, 'expected-output/single-template-output.md');
        const outputDir = path.join(tempDir, 'output-single-template');
        const outputFile = path.join(outputDir, 'simple-template-output.md');

        await run(
            calm(), ['docify', '--architecture', testModelPath, '--template', templatePath, '--output', outputFile, '--url-to-local-file-mapping', localDirectory]
        );

        expect(fs.existsSync(outputFile)).toBe(true);
        const actual = fs.readFileSync(outputFile, 'utf8').trim();
        const expected = fs.readFileSync(expectedOutputPath, 'utf8').trim();
        expect(actual).toEqual(expected);
    });

    test('docify command works with --template-dir mode', async () => {
        const fixtureDir = path.resolve(__dirname, '../test_fixtures/template');
        const testModelPath = path.join(fixtureDir, 'model/document-system.json');
        const localDirectory = path.join(fixtureDir, 'model/url-to-file-directory.json');
        const templateDirPath = path.join(fixtureDir, 'self-provided/template-dir');
        const expectedOutputDir = path.join(fixtureDir, 'expected-output/template-dir');
        const actualOutputDir = path.join(tempDir, 'output-template-dir');

        await run(
            calm(), ['docify', '--architecture', testModelPath, '--template-dir', templateDirPath, '--output', actualOutputDir, '--url-to-local-file-mapping', localDirectory]
        );

        await expectDirectoryMatch(expectedOutputDir, actualOutputDir);
    });


    describe('calm docify command - widget rendering', () => {
        function runTemplateWidgetTest(templateName: string, outputName: string) {
            return async () => {

                const GETTING_STARTED_TEST_FIXTURES_DIR = join(
                    __dirname,
                    '../../cli/test_fixtures/getting-started'
                );

                const testModelPath = path.resolve(
                    GETTING_STARTED_TEST_FIXTURES_DIR,
                    'STEP-3/conference-signup-with-flow.arch.json'
                );

                const fixtureDir = path.resolve(__dirname, '../test_fixtures/template');
                const templatePath = path.join(fixtureDir, `widget-tests/${templateName}`);
                const expectedOutputPath = path.join(fixtureDir, `expected-output/widget-tests/${outputName}`);
                const outputDir = path.join(tempDir, 'widget-tests');
                const outputFile = path.join(outputDir, outputName);

                await run(
                    calm(), ['docify', '--architecture', testModelPath, '--template', templatePath, '--output', outputFile]
                );

                expect(fs.existsSync(outputFile)).toBe(true);
                const actual = fs.readFileSync(outputFile, 'utf8').trim();
                const expected = fs.readFileSync(expectedOutputPath, 'utf8').trim();
                expect(actual).toEqual(expected);
            };
        }

        test('A user can render a table widget', runTemplateWidgetTest('table-test.hbs', 'table-test.md'));

        test('A user can render a list widget', runTemplateWidgetTest('list-test.hbs', 'list-test.md'));

        test('A user can render a flow sequence widget', runTemplateWidgetTest('flow-sequence-test.hbs', 'flow-sequence-test.md'));

        test('A user can render a related nodes widget', runTemplateWidgetTest('related-nodes-test.hbs', 'related-nodes-test.md'));

        test('A user can render a blocked architecture widget', runTemplateWidgetTest('block-architecture-test.hbs', 'block-architecture-test.md'));

        test('A user can render a json view their document or parts of their document', runTemplateWidgetTest('json-viewer-test.hbs', 'json-viewer-test.md'));

        test('A user can render a SAD document', runTemplateWidgetTest('sad-test.hbs', 'sad-test.md'));
    });


    test('Getting Started Verification - CLI Steps', async () => {
        const GETTING_STARTED_DIR = join(
            __dirname,
            '../../calm/getting-started'
        );
        const GETTING_STARTED_TEST_FIXTURES_DIR = join(
            __dirname,
            '../../cli/test_fixtures/getting-started'
        );

        //STEP 1: Generate Architecture From Pattern
        const inputPattern = path.resolve(
            GETTING_STARTED_DIR,
            'conference-signup.pattern.json'
        );
        const outputArchitecture = path.resolve(
            tempDir,
            'conference-signup.arch.json'
        );
        await run(calm(), ['generate', '-p', inputPattern, '-o', outputArchitecture]);

        const expectedOutputArchitecture = path.resolve(
            GETTING_STARTED_TEST_FIXTURES_DIR,
            'STEP-1/conference-signup.arch.json'
        );
        await expectFilesMatch(expectedOutputArchitecture, outputArchitecture);

        //STEP 2: Generate Docify Website From Architecture
        const outputWebsite = path.resolve(tempDir, 'website');
        await run(
            calm(), ['docify', '--architecture', outputArchitecture, '--output', outputWebsite]
        );

        const expectedOutputDocifyWebsite = path.resolve(
            GETTING_STARTED_TEST_FIXTURES_DIR,
            'STEP-2/website'
        );
        await expectDirectoryMatch(expectedOutputDocifyWebsite, outputWebsite);

        //STEP 3: Add flow to architecture-document
        const flowUrl = 'https://calm.finos.org/getting-started/flows/conference-signup.flow.json';


        patchJson(outputArchitecture, (arch) => {
            arch['flows'] = [
                {
                    $schema: 'https://calm.finos.org/release/1.0-rc2/meta/flow.json',
                    $id: flowUrl,
                    'unique-id': 'flow-conference-signup',
                    name: 'Conference Signup Flow',
                    description: 'Flow for registering a user through the conference website and storing their details in the attendee database.',
                    transitions: [
                        {
                            'relationship-unique-id': 'conference-website-load-balancer',
                            'sequence-number': 1,
                            description: 'User submits sign-up form via Conference Website to Load Balancer',
                        },
                        {
                            'relationship-unique-id': 'load-balancer-attendees',
                            'sequence-number': 2,
                            description: 'Load Balancer forwards request to Attendees Service',
                        },
                        {
                            'relationship-unique-id': 'attendees-attendees-store',
                            'sequence-number': 3,
                            description: 'Attendees Service stores attendee info in the Attendees Store',
                        },
                    ],
                },
            ];
        });

        await expectFilesMatch(
            path.resolve(GETTING_STARTED_TEST_FIXTURES_DIR, 'STEP-3/conference-signup-with-flow.arch.json'),
            outputArchitecture
        );


        const outputWebsiteWithFlow = path.resolve(
            tempDir,
            'website-with-flow'
        );
        await run(
            calm(), ['docify', '--architecture', outputArchitecture, '--output', outputWebsiteWithFlow]
        );

        const expectedOutputDocifyWebsiteWithFLow = path.resolve(
            GETTING_STARTED_TEST_FIXTURES_DIR,
            'STEP-3/website'
        );
        await expectDirectoryMatch(
            expectedOutputDocifyWebsiteWithFLow,
            outputWebsiteWithFlow
        );
    });

    function writeJson(filePath: string, obj: object) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(obj, null, 2));
    }

    function readJson(filePath: string) {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }

    function patchJson(filePath: string, patchFn: (o: object) => void) {
        const obj = readJson(filePath);
        patchFn(obj);
        writeJson(filePath, obj);
    }

    // Utility to recursively remove specific line/character fields from JSON
    function removeLineNumbers(obj: object) {
        const fieldsToRemove = [
            'line_start',
            'line_end',
            'character_start',
            'character_end',
        ];
        if (Array.isArray(obj)) {
            obj.forEach(removeLineNumbers);
        } else if (obj && typeof obj === 'object') {
            for (const key of Object.keys(obj)) {
                if (fieldsToRemove.includes(key)) {
                    delete obj[key];
                } else {
                    removeLineNumbers(obj[key]);
                }
            }
        }
    }
});
