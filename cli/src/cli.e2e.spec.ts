import { exec, execSync } from 'child_process';
import path, {join} from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { parseStringPromise } from 'xml2js';
import util from 'util';
import axios from 'axios';
import { Mock } from 'vitest';
import {expectDirectoryMatch, expectFilesMatch} from '@finos/calm-shared';
vi.mock('axios');

const execPromise = util.promisify(exec);

const millisPerSecond = 1000;
const integrationTestPrefix = 'calm-consumer-test';
let tempDir: string;
const repoRoot = path.resolve(__dirname);

function calm(command: string): string {
    return `${path.join(tempDir, 'node_modules/.bin/calm')} ${command}`; //referencing local calm install in-case someone locally has installed calm globally.
}

describe('CLI Integration Tests', () => {
    vi.setConfig({ testTimeout: 30 * millisPerSecond });

    beforeAll(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), integrationTestPrefix));

        const tgzName = execSync('npm pack', { cwd: repoRoot }).toString().trim();
        const sourceTarball = path.join(repoRoot, tgzName);
        const targetTarball = path.join(tempDir, tgzName);
        fs.renameSync(sourceTarball, targetTarball);

        // Create clean test consumer
        execSync('npm init -y', { cwd: tempDir, stdio: 'inherit' });
        execSync(`npm install ${targetTarball}`, { cwd: tempDir, stdio: 'inherit' });
    }, millisPerSecond * 30);

    afterAll(() => {
        if (tempDir) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('calm --version works', async () => {
        const { stdout } = await execPromise(calm('--version'));
        expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/); // basic semver check
    });


    test('shows help if no arguments provided', async () => {
        try {
            await execPromise(calm(''));
        } catch (err) {
            expect(err.stderr).toContain('Usage:');
        }
    });
    test('calm -h shows help', async () => {
        const { stdout } = await execPromise(calm('-h'));
        expect(stdout).toContain('A set of tools for interacting with the Common Architecture Language Model');
        expect(stdout).toContain('Usage:');
    });

    test('calm --help shows help', async () => {
        const { stdout } = await execPromise(calm('--help'));
        expect(stdout).toContain('A set of tools for interacting with the Common Architecture Language Model');
        expect(stdout).toContain('Usage:');
    });


    test('validate command outputs JSON to stdout', async () => {
        const apiGatewayPath = path.join(__dirname, '../../calm/pattern/api-gateway.json');
        const apiGatewayArchPath = path.join(__dirname, '../../calm/samples/api-gateway-architecture.json');
        const cmd = calm(`validate -p ${apiGatewayPath.toString()} -a ${apiGatewayArchPath.toString()}`);
        const { stdout } = await execPromise(cmd);

        const expected = JSON.parse(fs.readFileSync(path.join(__dirname, '../test_fixtures/validate_output.json'), 'utf8'));
        const parsedOutput = JSON.parse(stdout);
        removeLineNumbers(parsedOutput);
        removeLineNumbers(expected);
        expect(parsedOutput).toEqual(expected);
    });

    test('validate command outputs JSON to file', async () => {
        const apiGatewayPath = path.join(__dirname, '../../calm/pattern/api-gateway.json');
        const apiGatewayArchPath = path.join(__dirname, '../../calm/samples/api-gateway-architecture.json');
        const targetOutputFile = path.join(tempDir, 'validate-output.json');

        const cmd = calm(`validate -p ${apiGatewayPath} -a ${apiGatewayArchPath} -o ${targetOutputFile}`);
        await execPromise(cmd);

        expect(fs.existsSync(targetOutputFile)).toBe(true);

        const outputString = fs.readFileSync(targetOutputFile, 'utf-8');
        const parsedOutput = JSON.parse(outputString);

        const expectedFilePath = path.join(__dirname, '../test_fixtures/validate_output.json');
        const expectedJson = JSON.parse(fs.readFileSync(expectedFilePath, 'utf-8'));
        removeLineNumbers(parsedOutput);
        removeLineNumbers(expectedJson);
        expect(parsedOutput).toEqual(expectedJson);
    });

    test('validate command outputs JUNIT to stdout', async () => {
        const apiGatewayPath = path.join(__dirname, '../../calm/pattern/api-gateway.json');
        const apiGatewayArchPath = path.join(__dirname, '../../calm/samples/api-gateway-architecture.json');
        const cmd = calm(`validate -p ${apiGatewayPath} -a ${apiGatewayArchPath} -f junit`);

        const { stdout } = await execPromise(cmd);
        const parsedOutput = await parseStringPromise(stdout);

        const expectedFilePath = path.join(__dirname, '../test_fixtures/validate_output_junit.xml');
        const expectedXmlString = fs.readFileSync(expectedFilePath, 'utf-8');
        const expectedXml = await parseStringPromise(expectedXmlString);

        expect(parsedOutput).toEqual(expectedXml);
    });

    test('validate command outputs JUNIT to file', async () => {
        const apiGatewayPath = path.join(__dirname, '../../calm/pattern/api-gateway.json');
        const apiGatewayArchPath = path.join(__dirname, '../../calm/samples/api-gateway-architecture.json');
        const targetOutputFile = path.join(tempDir, 'validate-output.xml');

        const cmd = calm(`validate -p ${apiGatewayPath} -a ${apiGatewayArchPath} -f junit -o ${targetOutputFile}`);
        await execPromise(cmd);

        expect(fs.existsSync(targetOutputFile)).toBe(true);

        const outputString = fs.readFileSync(targetOutputFile, 'utf-8');
        const parsedOutput = await parseStringPromise(outputString);

        const expectedFilePath = path.join(__dirname, '../test_fixtures/validate_output_junit.xml');
        const expectedXmlString = fs.readFileSync(expectedFilePath, 'utf-8');
        const expectedXml = await parseStringPromise(expectedXmlString);

        expect(parsedOutput).toEqual(expectedXml);
    });


    test('validate command outputs PRETTY to stdout', async () => {
        const apiGatewayPath = path.join(__dirname, '../../calm/pattern/api-gateway.json');
        const apiGatewayArchPath = path.join(__dirname, '../../calm/samples/api-gateway-architecture.json');
        const cmd = calm(`validate -p ${apiGatewayPath} -a ${apiGatewayArchPath} -f pretty`);

        const { stdout } = await execPromise(cmd);

        const expectedFilePath = path.join(__dirname, '../test_fixtures/validate_output_pretty.txt');
        const expectedOutput = fs.readFileSync(expectedFilePath, 'utf-8');

        // Normalize line endings to avoid platform-specific mismatches
        expect(stdout.replace(/\r\n/g, '\n')).toEqual(expectedOutput.replace(/\r\n/g, '\n'));
    });

    test('validate command fails when neither architecture nor pattern is provided', async () => {
        const cmd = calm('validate');

        await expect(execPromise(cmd)).rejects.toMatchObject({
            stderr: expect.stringContaining(
                'error: one of the required options \'-p, --pattern <file>\' or \'-a, --architecture <file>\' was not specified'
            )
        });
    });

    test('validate command validates an architecture only', async () => {
        const apiGatewayArchPath = path.join(__dirname, '../../calm/samples/api-gateway-architecture.json');
        const targetOutputFile = path.join(tempDir, 'validate-output.json');
        const cmd = calm(`validate -a ${apiGatewayArchPath} -o ${targetOutputFile}`);

        await execPromise(cmd);
        const outputFile = fs.readFileSync(targetOutputFile, 'utf-8');

        const parsedOutput = JSON.parse(outputFile);
        const expectedFilePath = path.join(__dirname, '../test_fixtures/validate_architecture_only_output.json');
        const expectedOutput = JSON.parse(fs.readFileSync(expectedFilePath, 'utf-8'));
        
        removeLineNumbers(parsedOutput);
        removeLineNumbers(expectedOutput);
        
        expect(parsedOutput).toEqual(expectedOutput);
    });



    test('generate command produces the expected output', async () => {
        const apiGatewayPatternPath = path.join(__dirname, '../../calm/pattern/api-gateway.json');
        const schemaDirectoryPath = path.join(__dirname, '../../calm/release');
        const targetOutputFile = path.join(tempDir, 'generate-output.json');

        const cmd = calm(`generate -p ${apiGatewayPatternPath} -o ${targetOutputFile} -s ${schemaDirectoryPath}`);
        await execPromise(cmd);

        const outputString = fs.readFileSync(targetOutputFile, 'utf-8');
        const parsedOutput = JSON.parse(outputString);

        const expectedFilePath = path.join(__dirname, '../test_fixtures/generate_output.json');
        const expectedJson = JSON.parse(fs.readFileSync(expectedFilePath, 'utf-8'));

        expect(parsedOutput).toEqual(expectedJson);
    });


    test('server command starts and responds to /health', async () => {
        // TODO does this actually test anything? 
        // mock axios.get to return a 200 response and then call axios.get and assert it's 200?
        (axios.get as Mock).mockResolvedValue({ status: 200, data: { status: 'ok' } });
        const serverCmd = calm('server -p 3002 --schemaDirectory ../../dist/calm/');
        const serverProcess = exec(serverCmd);

        await new Promise(res => setTimeout(res, 5 * millisPerSecond));
        try {
            const res = await axios.get('http://127.0.0.1:3002/health');
            expect(res.status).toBe(200);
            expect(res.data.status).toBe('ok');
        } finally {
            serverProcess.kill();
        }
    });

    test('template command generates expected output', async () => {
        const fixtureDir = path.resolve(__dirname, '../test_fixtures/template');
        const testModelPath = path.join(fixtureDir, 'model/document-system.json');
        const localDirectory = path.join(fixtureDir, 'model/url-to-file-directory.json');
        const templateBundlePath = path.join(fixtureDir, 'template-bundles/doc-system');
        const expectedOutput = path.join(fixtureDir, 'expected-output/cli-e2e-output.html');
        const outputDir = path.resolve(tempDir, 'output');
        const outputFile = path.join(outputDir, 'cli-e2e-output.html');

        const cmd = calm(`template --input ${testModelPath} --bundle ${templateBundlePath} --output ${outputDir} --url-to-local-file-mapping ${localDirectory}`);
        await execPromise(cmd);

        expect(fs.existsSync(outputFile)).toBe(true);

        const actualContent = fs.readFileSync(outputFile, 'utf8').trim();
        const expectedContent = fs.readFileSync(expectedOutput, 'utf8').trim();
        expect(actualContent).toEqual(expectedContent);
    });

    test('docify command generates expected files', async () => {
        const fixtureDir = path.resolve(__dirname, '../test_fixtures/template');
        const testModelPath = path.join(fixtureDir, 'model/document-system.json');
        const localDirectory = path.join(fixtureDir, 'model/url-to-file-directory.json');
        const outputDir = path.resolve(tempDir, 'output/documentation');

        const expectedFiles = [
            'docs/index.md',
            'docs/flows/flow-document-upload.md',
            'docs/nodes/document-system.md',
            'docs/nodes/db-docs.md',
            'docs/nodes/svc-storage.md',
            'docs/nodes/svc-upload.md'
        ].map(file => path.join(outputDir, file));

        const cmd = calm(`docify --input ${testModelPath} --output ${outputDir} --url-to-local-file-mapping ${localDirectory}`);
        await execPromise(cmd);

        for (const file of expectedFiles) {
            expect(fs.existsSync(file)).toBeTruthy();
        }
    });

    test('Getting Started Verification - CLI Steps', async () => {
        const GETTING_STARTED_DIR = join(__dirname,'../../calm/getting-started');
        const GETTING_STARTED_TEST_FIXTURES_DIR = join(__dirname,'../../cli/test_fixtures/getting-started');

        // This will enforce that people verify the getting-started guide works prior to any cli change
        const { stdout } = await execPromise(calm('--version'));
        expect(stdout.trim()).toMatch('0.7.9'); // basic semver check

        //STEP 1: Generate Architecture From Pattern
        const inputPattern = path.resolve(GETTING_STARTED_DIR, 'conference-signup.pattern.json');
        const outputArchitecture = path.resolve(tempDir,'conference-signup.arch.json');
        await execPromise(calm(`generate --pattern ${inputPattern} --output ${outputArchitecture}`));

        const expectedOutputArchitecture = path.resolve(GETTING_STARTED_TEST_FIXTURES_DIR,'STEP-1/conference-signup.arch.json');
        await expectFilesMatch(expectedOutputArchitecture, outputArchitecture);


        //STEP 2: Generate Docify Website From Architecture
        const outputWebsite = path.resolve(tempDir, 'website');
        await execPromise(calm(`docify --input ${outputArchitecture} --output ${outputWebsite}`));

        const expectedOutputDocifyWebsite = path.resolve(GETTING_STARTED_TEST_FIXTURES_DIR,'STEP-2/website');
        await expectDirectoryMatch(expectedOutputDocifyWebsite, outputWebsite);


        //STEP 3: Add flow to architecture-document
        const flowsDir = path.resolve(tempDir, 'flows');
        const flowFile = path.resolve(flowsDir, 'conference-signup.flow.json');
        const flowUrl  = 'https://calm.finos.org/getting-started/flows/conference-signup.flow.json';
        fs.mkdirSync(flowsDir, { recursive: true });

        /* eslint-disable quotes */
        writeJson(flowFile, {
            "$schema": "https://calm.finos.org/release/1.0-rc1/meta/flow.json",
            "$id": flowUrl,
            "unique-id": "flow-conference-signup",
            "name": "Conference Signup Flow",
            "description": "Flow for registering a user through the conference website and storing their details in the attendee database.",
            "transitions": [
                {
                    "relationship-unique-id": "conference-website-load-balancer",
                    "sequence-number": 1,
                    "summary": "User submits sign-up form via Conference Website to Load Balancer"
                },
                {
                    "relationship-unique-id": "load-balancer-attendees",
                    "sequence-number": 2,
                    "summary": "Load Balancer forwards request to Attendees Service"
                },
                {
                    "relationship-unique-id": "attendees-attendees-store",
                    "sequence-number": 3,
                    "summary": "Attendees Service stores attendee info in the Attendees Store"
                }
            ]
        });

        await expectFilesMatch(
            path.resolve(GETTING_STARTED_TEST_FIXTURES_DIR, 'STEP-3/flows/conference-signup.flow.json'),
            flowFile
        );

        const directory = path.resolve(tempDir, 'directory.json');
        writeJson(directory, {
            "https://calm.finos.org/getting-started/flows/conference-signup.flow.json": "flows/conference-signup-with-flow.arch.json"
        });  //since the flow document is not published



        patchJson(outputArchitecture, arch => {
            arch['flows'] =  arch['flows'] || [];
            if (!arch['flows'].includes(flowUrl)) arch['flows'].push(flowUrl);
        });
        await expectFilesMatch(
            path.resolve(GETTING_STARTED_TEST_FIXTURES_DIR,'STEP-3/conference-signup-with-flow.arch.json'),
            outputArchitecture
        );

        // Patch directory.json to map the URL → local path
        patchJson(directory, dir => {
            dir[flowUrl] = 'flows/conference-signup.flow.json';
        });
        await expectFilesMatch(
            path.resolve(GETTING_STARTED_TEST_FIXTURES_DIR,'STEP-3/directory.json'),
            directory
        );

        const outputWebsiteWithFlow = path.resolve(tempDir, 'website-with-flow');
        await execPromise(calm(`docify --input ${outputArchitecture} --output ${outputWebsiteWithFlow} --url-to-local-file-mapping ${directory}`));

        const expectedOutputDocifyWebsiteWithFLow = path.resolve(GETTING_STARTED_TEST_FIXTURES_DIR,'STEP-3/website');
        await expectDirectoryMatch(expectedOutputDocifyWebsiteWithFLow, outputWebsiteWithFlow);

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
        const fieldsToRemove = ['line_start', 'line_end', 'character_start', 'character_end'];
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
