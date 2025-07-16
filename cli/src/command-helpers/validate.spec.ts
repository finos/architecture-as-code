import { Command } from 'commander';
import { Mock } from 'vitest';
import { getFormattedOutput, validate, exitBasedOffOfValidationOutcome, SchemaDirectory } from '@finos/calm-shared';
import { mkdirp } from 'mkdirp';
import { writeFileSync } from 'fs';
import path from 'path';
import { runValidate, writeOutputFile, checkValidateOptions, ValidateOptions } from './validate';


const dummyArch = { dummy: 'arch' };
const dummyPattern = { dummy: 'pattern' };

const mocks = vi.hoisted(() => ({
    validate: vi.fn(),
    getFormattedOutput: vi.fn(),
    exitBasedOffOfValidationOutcome: vi.fn(),
    initLogger: vi.fn(() => ({ error: vi.fn(), debug: vi.fn() })),
    processExit: vi.fn(),
    mkdirpSync: vi.fn(),
    writeFileSync: vi.fn(),
    parseDocumentLoaderConfig: vi.fn(),
    buildDocumentLoader: vi.fn()
}));

vi.mock('@finos/calm-shared', async () => ({
    ...(await vi.importActual('@finos/calm-shared')),
    validate: mocks.validate,
    getFormattedOutput: mocks.getFormattedOutput,
    exitBasedOffOfValidationOutcome: mocks.exitBasedOffOfValidationOutcome,
    initLogger: mocks.initLogger
}));

vi.mock('mkdirp', () => ({
    mkdirp: { sync: mocks.mkdirpSync },
}));

vi.mock('fs', () => ({
    ...vi.importActual('fs'),
    writeFileSync: mocks.writeFileSync,
}));

vi.mock('../cli', async () => ({
    ...(await vi.importActual('../cli')),
    parseDocumentLoaderConfig: mocks.parseDocumentLoaderConfig
}));

vi.mock('@finos/calm-shared/dist/document-loader/document-loader', async () => ({
    ...(await vi.importActual('@finos/calm-shared/dist/document-loader/document-loader')),
    buildDocumentLoader: mocks.buildDocumentLoader
}));

describe('runValidate', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        process.exit = mocks.processExit as any;
    });

    it('should process validation successfully', async () => {
        // Mock buildDocumentLoader to return an object with loadMissingDocument
        mocks.parseDocumentLoaderConfig.mockResolvedValue({});
        mocks.buildDocumentLoader.mockReturnValue({
            loadMissingDocument: vi.fn((filePath: string) => {
                if (filePath === 'arch.json') return dummyArch;
                if (filePath === 'pattern.json') return dummyPattern;
                return undefined;
            })
        });

        const options: ValidateOptions = {
            architecturePath: 'arch.json',
            patternPath: 'pattern.json',
            metaSchemaPath: 'schemas',
            verbose: true,
            outputFormat: 'json',
            outputPath: 'out.json',
            strict: false,
        };

        const fakeOutcome = { valid: true };
        (validate as Mock).mockResolvedValue(fakeOutcome);
        (getFormattedOutput as Mock).mockReturnValue('formatted output');

        await runValidate(options);

        // Instead of filenames, expect dummy objects to be passed to validate
        expect(validate).toHaveBeenCalledWith(dummyArch, dummyPattern, expect.any(SchemaDirectory), true);
        expect(getFormattedOutput).toHaveBeenCalledWith(fakeOutcome, 'json');
        expect(exitBasedOffOfValidationOutcome).toHaveBeenCalledWith(fakeOutcome, false);

        // When output is provided, writeOutputFile should call mkdirp.sync and writeFileSync
        expect(mkdirp.sync).toHaveBeenCalledWith(path.dirname('out.json'));
        expect(writeFileSync).toHaveBeenCalledWith('out.json', 'formatted output');
    });

    it('should call process.exit(1) when an error occurs', async () => {
        const options: ValidateOptions = {
            architecturePath: 'arch.json',
            patternPath: 'pattern.json',
            metaSchemaPath: 'schemas',
            verbose: true,
            outputFormat: 'json',
            outputPath: 'out.json',
            strict: false,
        };

        mocks.parseDocumentLoaderConfig.mockResolvedValue({});
        mocks.buildDocumentLoader.mockReturnValue({
            loadMissingDocument: vi.fn((filePath: string) => {
                if (filePath === 'arch.json') return dummyArch;
                if (filePath === 'pattern.json') return dummyPattern;
                return undefined;
            })
        });

        const error = new Error('Validation failed');
        (validate as Mock).mockRejectedValue(error);

        await runValidate(options);
        expect(mocks.processExit).toHaveBeenCalledWith(1);
    });
});

describe('writeOutputFile', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('should write output to file if output is provided', () => {
        const output = 'dir/out.txt';
        const content = 'some content';
        writeOutputFile(output, content);
        expect(mkdirp.sync).toHaveBeenCalledWith(path.dirname(output));
        expect(writeFileSync).toHaveBeenCalledWith(output, content);
    });

    it('should write output to stdout if no output is provided', () => {
        const content = 'stdout content';
        const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
        writeOutputFile('', content);
        expect(stdoutSpy).toHaveBeenCalledWith(content);
        stdoutSpy.mockRestore();
    });
});


describe('checkValidateOptions', () => {
    it('should call program.error if neither pattern nor architecture is provided', () => {
        const program = new Command();
        const errorSpy = vi.spyOn(program, 'error').mockImplementation((msg: string) => { throw new Error(msg); });
        const options = {};
        expect(() => checkValidateOptions(program, options, '-p, --pattern <file>', '-a, --architecture <file>')).toThrow(/one of the required options/);
        errorSpy.mockRestore();
    });

    it('should not call program.error if a pattern is provided', () => {
        const program = new Command();
        const errorSpy = vi.spyOn(program, 'error').mockImplementation((msg: string) => { throw new Error(msg); });
        const options = { pattern: 'pattern.json' };
        expect(() => checkValidateOptions(program, options, '-p, --pattern <file>', '-a, --architecture <file>')).not.toThrow();
        errorSpy.mockRestore();
    });

    it('should not call program.error if an architecture is provided', () => {
        const program = new Command();
        const errorSpy = vi.spyOn(program, 'error').mockImplementation((msg: string) => { throw new Error(msg); });
        const options = { architecture: 'arch.json' };
        expect(() => checkValidateOptions(program, options, '-p, --pattern <file>', '-a, --architecture <file>')).not.toThrow();
        errorSpy.mockRestore();
    });
});
