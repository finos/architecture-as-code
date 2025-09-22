import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join, resolve } from 'path';
import { setupAiTools } from './ai-tools';

// Mock functions using vi.hoisted
const mocks = vi.hoisted(() => ({
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    readFile: vi.fn(),
    stat: vi.fn(),
    initLogger: vi.fn(() => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    })),
}));

// Mock the fs/promises module
vi.mock('fs/promises', () => ({
    mkdir: mocks.mkdir,
    writeFile: mocks.writeFile,
    readFile: mocks.readFile,
    stat: mocks.stat,
}));

vi.mock('@finos/calm-shared', () => ({
    initLogger: mocks.initLogger,
}));

vi.mock('@finos/calm-shared/src/logger.js', () => ({
    Logger: vi.fn(),
}));

describe('ai-tools', () => {
    const mockLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.initLogger.mockReturnValue(mockLogger);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('setupAiTools', () => {
        const targetDirectory = '/test/directory';
        const verbose = false;

        beforeEach(() => {
            // Mock successful directory stat
            mocks.stat.mockImplementation((path: string) => {
                if (path === resolve(targetDirectory)) {
                    return Promise.resolve({ isDirectory: () => true });
                }
                if (path === join(resolve(targetDirectory), '.git')) {
                    return Promise.resolve({}); // Git directory exists
                }
                return Promise.reject(new Error('File not found'));
            });

            // Mock successful mkdir
            mocks.mkdir.mockResolvedValue(undefined);

            // Mock successful writeFile
            mocks.writeFile.mockResolvedValue(undefined);

            // Mock successful readFile for bundled resources
            mocks.readFile.mockResolvedValue('mock chatmode content');
        });

        it('should setup AI tools successfully in a git repository', async () => {
            await setupAiTools(targetDirectory, verbose);

            // Verify logger was initialized
            expect(mocks.initLogger).toHaveBeenCalledWith(verbose, 'calm-ai-tools');

            // Verify directory validation
            expect(mocks.stat).toHaveBeenCalledWith(resolve(targetDirectory));

            // Verify git directory check
            expect(mocks.stat).toHaveBeenCalledWith(join(resolve(targetDirectory), '.git'));

            // Verify chatmodes directory creation
            expect(mocks.mkdir).toHaveBeenCalledWith(
                join(resolve(targetDirectory), '.github', 'chatmodes'),
                { recursive: true }
            );

            // Verify success messages
            expect(mockLogger.info).toHaveBeenCalledWith(`Setting up CALM AI tools in: ${resolve(targetDirectory)}`);
            expect(mockLogger.info).toHaveBeenCalledWith('Git repository detected');
            expect(mockLogger.info).toHaveBeenCalledWith('Created .github/chatmodes directory following GitHub Copilot conventions');
            expect(mockLogger.info).toHaveBeenCalledWith('✅ CALM AI tools setup completed successfully!');
        });

        it('should warn when not in a git repository', async () => {
            // Mock git directory not found
            mocks.stat.mockImplementation((path: string) => {
                if (path === resolve(targetDirectory)) {
                    return Promise.resolve({ isDirectory: () => true });
                }
                if (path === join(resolve(targetDirectory), '.git')) {
                    return Promise.reject(new Error('File not found'));
                }
                return Promise.reject(new Error('File not found'));
            });

            await setupAiTools(targetDirectory, verbose);

            expect(mockLogger.warn).toHaveBeenCalledWith('Warning: No .git directory found. This may not be a git repository.');
        });

        it('should throw error when target is not a directory', async () => {
            mocks.stat.mockImplementation((path: string) => {
                if (path === resolve(targetDirectory)) {
                    return Promise.resolve({ isDirectory: () => false });
                }
                return Promise.reject(new Error('File not found'));
            });

            await expect(setupAiTools(targetDirectory, verbose)).rejects.toThrow(
                `Target path is not a directory: ${resolve(targetDirectory)}`
            );
        });

        it('should handle errors and log them appropriately', async () => {
            const errorMessage = 'Permission denied';
            mocks.stat.mockRejectedValue(new Error(errorMessage));

            await expect(setupAiTools(targetDirectory, verbose)).rejects.toThrow(errorMessage);
            expect(mockLogger.error).toHaveBeenCalledWith(`❌ Failed to setup AI tools: Error: ${errorMessage}`);
        });

        it('should create chatmode configuration file', async () => {
            await setupAiTools(targetDirectory, verbose);

            const chatmodeFilePath = join(resolve(targetDirectory), '.github', 'chatmodes', 'CALM.chatmode.md');


            // Verify readFile was called for bundled resource
            expect(mocks.readFile).toHaveBeenCalledWith(
                expect.stringContaining('CALM.chatmode.md'),
                'utf8'
            );

            // Verify writeFile was called for chatmode config
            expect(mocks.writeFile).toHaveBeenCalledWith(
                chatmodeFilePath,
                'mock chatmode content',
                'utf8'
            );

            expect(mockLogger.info).toHaveBeenCalledWith('Created CALM chatmode configuration');
        });

        it('should use fallback content when bundled chatmode file not found', async () => {
            // Mock readFile to fail for bundled resource
            mocks.readFile.mockImplementation((path: string) => {
                if (path.includes('CALM.chatmode.md')) {
                    return Promise.reject(new Error('Bundled file not found'));
                }
                return Promise.resolve('mock content');
            });

            await setupAiTools(targetDirectory, verbose);

            const chatmodeFilePath = join(resolve(targetDirectory), '.github', 'chatmodes', 'CALM.chatmode.md');

            // Verify fallback content was written
            expect(mocks.writeFile).toHaveBeenCalledWith(
                chatmodeFilePath,
                expect.stringContaining('# CALM Architecture Assistant'),
                'utf8'
            );

            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Could not read bundled chatmode config, using fallback:')
            );
            expect(mockLogger.info).toHaveBeenCalledWith('Created CALM chatmode configuration (fallback)');
        });

        it('should create tool prompt files', async () => {
            await setupAiTools(targetDirectory, verbose);

            const promptsDir = join(resolve(targetDirectory), '.github', 'chatmodes', 'calm-prompts');

            // Verify prompts directory creation
            expect(mocks.mkdir).toHaveBeenCalledWith(promptsDir, { recursive: true });
            expect(mockLogger.info).toHaveBeenCalledWith('Created calm-prompts directory');

            // Verify tool files are attempted to be read and written
            const expectedToolFiles = [
                'architecture-creation.md',
                'node-creation.md',
                'relationship-creation.md',
                'interface-creation.md',
                'metadata-creation.md',
                'control-creation.md',
                'flow-creation.md',
                'pattern-creation.md',
                'documentation-creation.md'
            ];

            expectedToolFiles.forEach(fileName => {
                expect(mocks.readFile).toHaveBeenCalledWith(
                    expect.stringContaining(`tools/${fileName}`),
                    'utf8'
                );
                expect(mocks.writeFile).toHaveBeenCalledWith(
                    join(promptsDir, fileName),
                    'mock chatmode content',
                    'utf8'
                );
            });

            expect(mockLogger.info).toHaveBeenCalledWith('Created all tool prompt files');
        });

        it('should continue processing other tool files when one fails', async () => {
            // Mock readFile to fail for one specific tool file
            mocks.readFile.mockImplementation((path: string) => {
                if (path.includes('tools/node-creation.md')) {
                    return Promise.reject(new Error('File not found'));
                }
                return Promise.resolve('mock content');
            });

            await setupAiTools(targetDirectory, verbose);

            // Should warn about the failed file
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Could not read bundled tool file node-creation.md:')
            );

            // Should still complete successfully
            expect(mockLogger.info).toHaveBeenCalledWith('Created all tool prompt files');
        });

        it('should handle verbose logging', async () => {
            await setupAiTools(targetDirectory, true);

            expect(mocks.initLogger).toHaveBeenCalledWith(true, 'calm-ai-tools');
        });

        it('should resolve relative paths correctly', async () => {
            const relativePath = './relative/path';
            const resolvedPath = resolve(relativePath);

            // Update mock to handle the resolved relative path
            mocks.stat.mockImplementation((path: string) => {
                if (path === resolvedPath) {
                    return Promise.resolve({ isDirectory: () => true });
                }
                if (path === join(resolvedPath, '.git')) {
                    return Promise.resolve({}); // Git directory exists
                }
                return Promise.reject(new Error('File not found'));
            });

            await setupAiTools(relativePath, verbose);

            expect(mocks.stat).toHaveBeenCalledWith(resolvedPath);
            expect(mockLogger.info).toHaveBeenCalledWith(`Setting up CALM AI tools in: ${resolvedPath}`);
        });
    });
});