import { exec } from 'child_process';
import path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { parseStringPromise } from 'xml2js';
import util from 'util';

const execPromise = util.promisify(exec);

describe('CLI Integration Tests', () => {

    let tempDir: string;
    const millisPerSecond = 1000;
    const integrationTestPrefix = 'calm-test';
    const projectRoot = __dirname;
    jest.setTimeout(30 * millisPerSecond);

    beforeAll(async () => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), integrationTestPrefix));
        await callNpmFunction(`${projectRoot}`, 'link');
    }, millisPerSecond * 20);

    afterAll(async () => {
        if (tempDir) {
            fs.rmSync(tempDir, { recursive: true });
        }
    }, millisPerSecond * 20);

    test('shows help if no arguments provided', (done) => {
        const noArgCommand = 'calm';
        exec(noArgCommand, (error, _stdout, stderr) => {
            expect(error).not.toBeNull();
            expect(stderr).toContain('A set of tools for interacting with the Common Architecture Language Model');
            expect(stderr).toContain('Usage:');
            done();
        });
    });

    test('shows help if -h provided', (done) => {
        const helpShortFlagCommand = 'calm -h';
        exec(helpShortFlagCommand, (_error, stdout, _stderr) => {
            expect(stdout).toContain('A set of tools for interacting with the Common Architecture Language Model');
            expect(stdout).toContain('Usage:');
            done();
        });
    });

    test('shows help if --help provided', (done) => {
        const helpLongFlagCommand = 'calm --help';
        exec(helpLongFlagCommand, (_error, stdout, _stderr) => {
            expect(stdout).toContain('A set of tools for interacting with the Common Architecture Language Model');
            expect(stdout).toContain('Usage:');
            done();
        });
    });

    test('example validate command - outputting JSON to stdout', (done) => {
        const exampleValidateCommand = 'calm validate -p ../calm/pattern/api-gateway.json -i ../calm/samples/api-gateway-instantiation.json';
        exec(exampleValidateCommand, (_error, stdout, _stderr) => {
            const parsedOutput = JSON.parse(stdout);
            const expectedFilePath = path.join(__dirname, '../test_fixtures/validate_output.json');
            const expectedJson = JSON.parse(fs.readFileSync(expectedFilePath, 'utf-8'));
            expect(parsedOutput).toEqual(expectedJson);
            done();
        });
    });

    test('example validate command - outputting JSON to file', (done) => {
        const targetOutputFile = path.join(tempDir, 'validate-output.json');
        const exampleValidateCommand = `calm validate -p ../calm/pattern/api-gateway.json -i ../calm/samples/api-gateway-instantiation.json -o ${targetOutputFile}`;
        exec(exampleValidateCommand, (_error, _stdout, _stderr) => {
            expect(fs.existsSync(targetOutputFile)).toBeTruthy();

            const outputString = fs.readFileSync(targetOutputFile, 'utf-8');
            const parsedOutput = JSON.parse(outputString);

            const expectedFilePath = path.join(__dirname, '../test_fixtures/validate_output.json');
            const expectedJson = JSON.parse(fs.readFileSync(expectedFilePath, 'utf-8'));

            expect(parsedOutput).toEqual(expectedJson);

            done();
        });
    });

    test('example validate command - outputting JUNIT to stdout', (done) => {
        const exampleValidateCommand = 'calm validate -p ../calm/pattern/api-gateway.json -i ../calm/samples/api-gateway-instantiation.json -f junit';
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
        const exampleValidateCommand = `calm validate -p ../calm/pattern/api-gateway.json -i ../calm/samples/api-gateway-instantiation.json -f junit -o ${targetOutputFile}`;
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
        const exampleValidateCommand = 'calm validate -p ../calm/pattern/api-gateway.json -i ../calm/samples/api-gateway-instantiation.json -f pretty';
        exec(exampleValidateCommand, (_error, stdout, _stderr) => {
            const expectedFilePath = path.join(__dirname, '../test_fixtures/validate_output_pretty.txt');
            const expectedOutput = fs.readFileSync(expectedFilePath, 'utf-8');
            //Some minor replacement logic to avoid issues with line endings
            expect(stdout.replace(/\r\n/g, '\n')).toEqual(expectedOutput.replace(/\r\n/g, '\n'));
            done();
        });
    });

    test('example validate command - outputting PRETTY to file', (done) => {
        const targetOutputFile = path.join(tempDir, 'validate-output-pretty.txt');
        const exampleValidateCommand = `calm validate -p ../calm/pattern/api-gateway.json -i ../calm/samples/api-gateway-instantiation.json -f pretty -o ${targetOutputFile}`;
        exec(exampleValidateCommand, (_error, _stdout, _stderr) => {
            expect(fs.existsSync(targetOutputFile)).toBeTruthy();

            const outputString = fs.readFileSync(targetOutputFile, 'utf-8');
            const expectedFilePath = path.join(__dirname, '../test_fixtures/validate_output_pretty.txt');
            const expectedOutput = fs.readFileSync(expectedFilePath, 'utf-8');

            //Some minor replacement logic to avoid issues with line endings
            expect(outputString.replace(/\r\n/g, '\n')).toEqual(expectedOutput.replace(/\r\n/g, '\n'));
            done();
        });
    });
});


async function callNpmFunction(projectRoot: string, command: string) {
    await execPromise(`npm ${command}`, { cwd: projectRoot });
}

