import { getFormattedOutput, validate, exitBasedOffOfValidationOutcome } from '@finos/calm-shared';
import { initLogger } from '@finos/calm-shared/logger';
import { mkdirp } from 'mkdirp';
import { writeFileSync } from 'fs';
import path from 'path';
import {runValidate, writeOutputFile, checkValidateOptions} from './validate';
import { Command } from 'commander';

vi.mock('@finos/calm-shared', async () => ({
    ...vi.importActual('@finos/calm-shared'),
    validate: vi.fn(),
    getFormattedOutput: vi.fn(),
    exitBasedOffOfValidationOutcome: vi.fn(),
}));

vi.mock('@finos/calm-shared/logger', () => ({
    initLogger: vi.fn(),
}));

vi.mock('mkdirp', () => ({
    mkdirp: { sync: vi.fn() },
}));

vi.mock('fs', () => ({
    ...vi.importActual('fs'),
    writeFileSync: vi.fn(),
}));

describe('runValidate', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('should process validation successfully', async () => {
        const options = {
            architecture: 'arch.json',
            pattern: 'pattern.json',
            schemaDirectory: 'schemas',
            verbose: true,
            format: 'json',
            output: 'out.json',
            strict: false,
        };

        const fakeOutcome = { valid: true };
        (validate as vi.Mock).mockResolvedValue(fakeOutcome);
        (getFormattedOutput as vi.Mock).mockReturnValue('formatted output');

        await runValidate(options);

        expect(validate).toHaveBeenCalledWith('arch.json', 'pattern.json', 'schemas', true);
        expect(getFormattedOutput).toHaveBeenCalledWith(fakeOutcome, 'json');
        expect(exitBasedOffOfValidationOutcome).toHaveBeenCalledWith(fakeOutcome, false);

        // When output is provided, writeOutputFile should call mkdirp.sync and writeFileSync
        expect(mkdirp.sync).toHaveBeenCalledWith(path.dirname('out.json'));
        expect(writeFileSync).toHaveBeenCalledWith('out.json', 'formatted output');
    });

    it('should call process.exit(1) when an error occurs', async () => {
        const options = {
            architecture: 'arch.json',
            pattern: 'pattern.json',
            schemaDirectory: 'schemas',
            verbose: false,
            format: 'json',
            output: 'out.json',
            strict: false,
        };

        const error = new Error('Validation failed');
        (validate as vi.Mock).mockRejectedValue(error);
        const loggerMock = { error: vi.fn(), debug: vi.fn() };
        (initLogger as vi.Mock).mockReturnValue(loggerMock);
        const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
            throw new Error(`process.exit called with ${code}`);
        });

        await expect(runValidate(options)).rejects.toThrow('process.exit called with 1');
        expect(loggerMock.error).toHaveBeenCalledWith('An error occurred while validating: ' + error.message);
        expect(loggerMock.debug).toHaveBeenCalled();
        exitSpy.mockRestore();
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
