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

function run(command: string) {
    const cp = execa(command, { cwd: tempDir, shell: true });
    cp.stdout?.pipe(process.stdout);
    cp.stderr?.pipe(process.stderr);
    return cp;
}

function calm(cmd: string): string {
    return `${path.join(tempDir, 'node_modules/.bin/calm')} ${cmd}`;
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

        // Create clean test consumer
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
        const { stdout } = await run(calm('--version'));
        expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });

    test('shows help if no arguments provided', async () => {
        await expect(run(calm(''))).rejects.toHaveProperty(
            'stderr',
            expect.stringContaining('Usage:')
        );
    });

    test('calm -h shows help', async () => {
        const { stdout } = await run(calm('-h'));
        expect(stdout).toContain(
            'A set of tools for interacting with the Common Architecture Language Model'
        );
        expect(stdout).toContain('Usage:');
    });

    test('calm --help shows help', async () => {
        const { stdout } = await run(calm('--help'));
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
            calm(`validate -p ${apiGatewayPath} -a ${apiGatewayArchPath}`)
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
            calm(
                `validate -p ${apiGatewayPath} -a ${apiGatewayArchPath} -o ${targetOutputFile}`
            )
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
            calm(
                `validate -p ${apiGatewayPath} -a ${apiGatewayArchPath} -f junit`
            )
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
            calm(
                `validate -p ${apiGatewayPath} -a ${apiGatewayArchPath} -f junit -o ${targetOutputFile}`
            )
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
            calm(`validate -p ${p} -a ${a} -f pretty`)
        );
        const expected = fs.readFileSync(
            path.join(__dirname, '../test_fixtures/validate_output_pretty.txt'),
            'utf8'
        );
        expect(stdout.trim().replace(/\r\n/g, '\n')).toEqual(
            expected.trim().replace(/\r\n/g, '\n')
        );
    });

    test('generate command produces the expected output', async () => {
        const p = path.join(
            __dirname,
            '../test_fixtures/api-gateway/api-gateway.json'
        );
        const s = path.join(__dirname, '../../calm/release');
        const out = path.join(tempDir, 'generate-output.json');
        await run(calm(`generate -p ${p} -o ${out} -s ${s}`));
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
            calm('server -p 3002 --schemaDirectory ../../dist/calm/'),
            {
                cwd: tempDir,
                shell: true,
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
            calm(
                `template --input ${testModelPath} --bundle ${templateBundlePath} --output ${outputDir} --url-to-local-file-mapping ${localDirectory}`
            )
        );

        expect(fs.existsSync(outputFile)).toBe(true);
        const actualContent = fs.readFileSync(outputFile, 'utf8').trim();
        const expectedContent = fs.readFileSync(expectedOutput, 'utf8').trim();
        expect(actualContent).toEqual(expectedContent);
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
            calm(
                `docify --input ${testModelPath} --output ${outputDir} --url-to-local-file-mapping ${localDirectory}`
            )
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

    test('Getting Started Verification - CLI Steps', async () => {
        const GETTING_STARTED_DIR = join(
            __dirname,
            '../../calm/getting-started'
        );
        const GETTING_STARTED_TEST_FIXTURES_DIR = join(
            __dirname,
            '../../cli/test_fixtures/getting-started'
        );

        // This will enforce that people verify the getting-started guide works prior to any cli change
        const { stdout } = await run(calm('--version'));
        expect(stdout.trim()).toMatch('0.7.10'); // basic semver check

        //STEP 1: Generate Architecture From Pattern
        const inputPattern = path.resolve(
            GETTING_STARTED_DIR,
            'conference-signup.pattern.json'
        );
        const outputArchitecture = path.resolve(
            tempDir,
            'conference-signup.arch.json'
        );
        await run(calm(`generate -p ${inputPattern} -o ${outputArchitecture}`));

        const expectedOutputArchitecture = path.resolve(
            GETTING_STARTED_TEST_FIXTURES_DIR,
            'STEP-1/conference-signup.arch.json'
        );
        await expectFilesMatch(expectedOutputArchitecture, outputArchitecture);

        //STEP 2: Generate Docify Website From Architecture
        const outputWebsite = path.resolve(tempDir, 'website');
        await run(
            calm(
                `docify --input ${outputArchitecture} --output ${outputWebsite}`
            )
        );

        const expectedOutputDocifyWebsite = path.resolve(
            GETTING_STARTED_TEST_FIXTURES_DIR,
            'STEP-2/website'
        );
        await expectDirectoryMatch(expectedOutputDocifyWebsite, outputWebsite);

        //STEP 3: Add flow to architecture-document
        const flowsDir = path.resolve(tempDir, 'flows');
        const flowFile = path.resolve(flowsDir, 'conference-signup.flow.json');
        const flowUrl =
            'https://calm.finos.org/getting-started/flows/conference-signup.flow.json';
        fs.mkdirSync(flowsDir, { recursive: true });

        /* eslint-disable quotes */
        writeJson(flowFile, {
            $schema: 'https://calm.finos.org/release/1.0-rc1/meta/flow.json',
            $id: flowUrl,
            'unique-id': 'flow-conference-signup',
            name: 'Conference Signup Flow',
            description:
                'Flow for registering a user through the conference website and storing their details in the attendee database.',
            transitions: [
                {
                    'relationship-unique-id':
                        'conference-website-load-balancer',
                    'sequence-number': 1,
                    summary:
                        'User submits sign-up form via Conference Website to Load Balancer',
                },
                {
                    'relationship-unique-id': 'load-balancer-attendees',
                    'sequence-number': 2,
                    summary:
                        'Load Balancer forwards request to Attendees Service',
                },
                {
                    'relationship-unique-id': 'attendees-attendees-store',
                    'sequence-number': 3,
                    summary:
                        'Attendees Service stores attendee info in the Attendees Store',
                },
            ],
        });

        await expectFilesMatch(
            path.resolve(
                GETTING_STARTED_TEST_FIXTURES_DIR,
                'STEP-3/flows/conference-signup.flow.json'
            ),
            flowFile
        );

        const directory = path.resolve(tempDir, 'directory.json');
        writeJson(directory, {
            'https://calm.finos.org/getting-started/flows/conference-signup.flow.json':
                'flows/conference-signup-with-flow.arch.json',
        }); //since the flow document is not published

        patchJson(outputArchitecture, (arch) => {
            arch['flows'] = arch['flows'] || [];
            if (!arch['flows'].includes(flowUrl)) arch['flows'].push(flowUrl);
        });
        await expectFilesMatch(
            path.resolve(
                GETTING_STARTED_TEST_FIXTURES_DIR,
                'STEP-3/conference-signup-with-flow.arch.json'
            ),
            outputArchitecture
        );

        // Patch directory.json to map the URL → local path
        patchJson(directory, (dir) => {
            dir[flowUrl] = 'flows/conference-signup.flow.json';
        });
        await expectFilesMatch(
            path.resolve(
                GETTING_STARTED_TEST_FIXTURES_DIR,
                'STEP-3/directory.json'
            ),
            directory
        );

        const outputWebsiteWithFlow = path.resolve(
            tempDir,
            'website-with-flow'
        );
        await run(
            calm(
                `docify --input ${outputArchitecture} --output ${outputWebsiteWithFlow} --url-to-local-file-mapping ${directory}`
            )
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
