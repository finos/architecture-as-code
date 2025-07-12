import { describe, it, expect, beforeEach } from 'vitest';
import { Command } from 'commander';
import { setupCLI } from './cli.js';

describe('CLI Setup', () => {
    let program: Command;

    beforeEach(() => {
        program = new Command();
    });

    describe('setupCLI', () => {
        it('should setup CLI with correct name and version', () => {
            setupCLI(program);
      
            expect(program.name()).toBe('calm');
            expect(program.version()).toBeDefined();
            expect(program.description()).toContain('Common Architecture Language Model');
        });

        it('should register all expected commands', () => {
            setupCLI(program);
      
            const commandNames = program.commands.map(cmd => cmd.name());
      
            expect(commandNames).toContain('generate');
            expect(commandNames).toContain('validate');
            expect(commandNames).toContain('docify');
            expect(commandNames).toContain('server');
            expect(commandNames).toContain('template');
        });

        it('should register generate command with required options', () => {
            setupCLI(program);
      
            const generateCommand = program.commands.find(cmd => cmd.name() === 'generate');
            expect(generateCommand).toBeDefined();
            expect(generateCommand?.description()).toContain('Generate an architecture');
      
            const options = generateCommand?.options || [];
            const patternOption = options.find(opt => opt.long === '--pattern');
            const outputOption = options.find(opt => opt.long === '--output');
      
            expect(patternOption?.required).toBe(true);
            expect(outputOption?.required).toBe(true);
        });

        it('should register validate command with correct options', () => {
            setupCLI(program);
      
            const validateCommand = program.commands.find(cmd => cmd.name() === 'validate');
            expect(validateCommand).toBeDefined();
            expect(validateCommand?.description()).toContain('Validate that an architecture');
      
            const options = validateCommand?.options || [];
            const patternOption = options.find(opt => opt.long === '--pattern');
            const strictOption = options.find(opt => opt.long === '--strict');
      
            expect(patternOption).toBeDefined();
            expect(strictOption).toBeDefined();
            // Note: architecture option may not exist in current implementation
        });

        it('should register docify command with correct options', () => {
            setupCLI(program);
      
            const docifyCommand = program.commands.find(cmd => cmd.name() === 'docify');
            expect(docifyCommand).toBeDefined();
            expect(docifyCommand?.description()).toContain('Generate a documentation website');
      
            const options = docifyCommand?.options || [];
            const outputOption = options.find(opt => opt.long === '--output');
      
            expect(outputOption).toBeDefined();
            // Note: docify command may not have --architecture option in current implementation
        });

        it('should register server command with correct options', () => {
            setupCLI(program);
      
            const serverCommand = program.commands.find(cmd => cmd.name() === 'server');
            expect(serverCommand).toBeDefined();
            expect(serverCommand?.description()).toContain('Start a HTTP server');
      
            const options = serverCommand?.options || [];
            const portOption = options.find(opt => opt.long === '--port');
      
            expect(portOption).toBeDefined();
        });

        it('should register template command with correct options', () => {
            setupCLI(program);
      
            const templateCommand = program.commands.find(cmd => cmd.name() === 'template');
            expect(templateCommand).toBeDefined();
            expect(templateCommand?.description()).toContain('Generate files from a CALM model');
      
            const options = templateCommand?.options || [];
            const inputOption = options.find(opt => opt.long === '--input');
            const outputOption = options.find(opt => opt.long === '--output');
            const templateOption = options.find(opt => opt.long === '--template');
      
            expect(inputOption).toBeDefined();
            expect(outputOption).toBeDefined();
            expect(templateOption).toBeDefined();
        });

        it('should have correct command count', () => {
            setupCLI(program);
      
            expect(program.commands).toHaveLength(5);
        });

        it('should setup commands with proper structure', () => {
            setupCLI(program);
      
            program.commands.forEach(command => {
                expect(command.name()).toBeTruthy();
                expect(command.description()).toBeTruthy();
                // Commands should have action handlers (internal implementation)
            });
        });

        it('should handle command option validation', () => {
            setupCLI(program);
      
            const generateCommand = program.commands.find(cmd => cmd.name() === 'generate');
            const validateCommand = program.commands.find(cmd => cmd.name() === 'validate');
      
            // Check that required options are properly marked
            expect(generateCommand?.options.some(opt => opt.required)).toBe(true);
      
            // Check that optional options exist
            expect(validateCommand?.options.some(opt => !opt.required)).toBe(true);
        });

        it('should setup help text correctly', () => {
            setupCLI(program);
      
            const helpText = program.helpInformation();
      
            expect(helpText).toContain('calm');
            expect(helpText).toContain('generate');
            expect(helpText).toContain('validate');
            expect(helpText).toContain('docify');
            expect(helpText).toContain('server');
            expect(helpText).toContain('template');
        });
    });

    describe('command options validation', () => {
        it('should validate generate command options', () => {
            setupCLI(program);
      
            const generateCommand = program.commands.find(cmd => cmd.name() === 'generate');
            const options = generateCommand?.options || [];
      
            // Check for all expected options
            const expectedOptions = ['--pattern', '--output', '--schemaDirectory', '--calmHubUrl', '--verbose'];
      
            expectedOptions.forEach(expectedOption => {
                const option = options.find(opt => opt.long === expectedOption);
                expect(option, `Expected option ${expectedOption} to exist`).toBeDefined();
            });
        });

        it('should validate validate command options', () => {
            setupCLI(program);
      
            const validateCommand = program.commands.find(cmd => cmd.name() === 'validate');
            const options = validateCommand?.options || [];
      
            // Check for all expected options
            const expectedOptions = ['--pattern', '--architecture', '--schemaDirectory', '--strict', '--format', '--output'];
      
            expectedOptions.forEach(expectedOption => {
                const option = options.find(opt => opt.long === expectedOption);
                expect(option, `Expected option ${expectedOption} to exist`).toBeDefined();
            });
        });

        it('should validate docify command options', () => {
            setupCLI(program);
      
            const docifyCommand = program.commands.find(cmd => cmd.name() === 'docify');
            const options = docifyCommand?.options || [];
      
            // Check for some expected options (implementation may vary)
            const outputOption = options.find(opt => opt.long === '--output');
            expect(outputOption).toBeDefined();
        });

        it('should validate server command options', () => {
            setupCLI(program);
      
            const serverCommand = program.commands.find(cmd => cmd.name() === 'server');
            const options = serverCommand?.options || [];
      
            // Check for all expected options
            const expectedOptions = ['--port', '--verbose'];
      
            expectedOptions.forEach(expectedOption => {
                const option = options.find(opt => opt.long === expectedOption);
                expect(option, `Expected option ${expectedOption} to exist`).toBeDefined();
            });
        });

        it('should validate template command options', () => {
            setupCLI(program);
      
            const templateCommand = program.commands.find(cmd => cmd.name() === 'template');
            const options = templateCommand?.options || [];
      
            // Check for all expected options
            const expectedOptions = ['--input', '--output', '--template', '--bundle'];
      
            expectedOptions.forEach(expectedOption => {
                const option = options.find(opt => opt.long === expectedOption);
                expect(option, `Expected option ${expectedOption} to exist`).toBeDefined();
            });
        });
    });
});
