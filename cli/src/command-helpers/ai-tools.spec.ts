import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolve } from 'path';
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

        // Default successful mocks
        mocks.stat.mockImplementation((path: string) => {
            if (path.endsWith('.git')) {
                return Promise.resolve({}); // Git directory exists
            }
            return Promise.resolve({ isDirectory: () => true, size: 100 });
        });
        mocks.mkdir.mockResolvedValue(undefined);
        mocks.writeFile.mockResolvedValue(undefined);

        // Mock readFile to return appropriate content based on file type
        mocks.readFile.mockImplementation((path: string) => {
            const pathStr = String(path);
            if (pathStr.endsWith('.json')) {
                // Return mock JSON config for provider config files
                return Promise.resolve(JSON.stringify({
                    description: 'Mock AI Assistant',
                    topLevelDirectory: '.github/chatmodes',
                    topLevelPromptDirectory: '',
                    'skill-prefix': '## ',
                    'skill-suffix': '',
                    frontmatter: '',
                    'skill-prompts': ['prompt1', 'prompt2']
                }));
            }
            // Return mock markdown content for other files
            return Promise.resolve('# Mock CALM content with enough text to pass validation');
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const providers = ['copilot', 'kiro'] as const;
    const targetDirectory = '/test/directory';

    // 1. Provider-agnostic tests - run once for core functionality
    describe('setupAiTools - provider-agnostic behavior', () => {
        it('should enable verbose logging when requested', async () => {
            await setupAiTools('copilot', targetDirectory, true);

            expect(mocks.initLogger).toHaveBeenCalledWith(true, 'calm-ai-tools');
        });

        it('should initialize logger with correct parameters', async () => {
            await setupAiTools('copilot', targetDirectory, false);

            expect(mocks.initLogger).toHaveBeenCalledWith(false, 'calm-ai-tools');
        });
    });

    // 2. Provider-specific tests - run for each provider
    describe.each(providers)('setupAiTools - provider-specific: %s', (provider) => {
        beforeEach(async () => {
            // Use REAL files from calm-ai directory for these tests
            mocks.readFile.mockImplementation(async (path: string, encoding?: string) => {
                const actual = await vi.importActual<typeof import('fs/promises')>('fs/promises');

                // Remap paths from src/command-helpers/calm-ai to repository root calm-ai
                let actualPath = path;
                if (path.includes('calm-ai')) {
                    const calmAiIndex = path.lastIndexOf('calm-ai');
                    const relativeToCalmAi = path.substring(calmAiIndex + 'calm-ai/'.length);
                    actualPath = resolve(__dirname, '../../../calm-ai', relativeToCalmAi);
                }

                return actual.readFile(actualPath, encoding as BufferEncoding);
            });

            // Also update stat to handle real files
            mocks.stat.mockImplementation(async (path: string) => {
                const pathStr = String(path);

                // Mock test directory and .git checks
                if (pathStr.includes('/test/directory') || pathStr.endsWith('.git')) {
                    if (pathStr.endsWith('.git')) {
                        return Promise.resolve({});
                    }
                    return Promise.resolve({
                        isDirectory: () => true,
                        size: 100
                    });
                }

                // Remap bundled resource paths for real file stats
                let actualPath = pathStr;
                if (pathStr.includes('calm-ai')) {
                    const calmAiIndex = pathStr.lastIndexOf('calm-ai');
                    const relativeToCalmAi = pathStr.substring(calmAiIndex + 'calm-ai/'.length);
                    actualPath = resolve(__dirname, '../../../calm-ai', relativeToCalmAi);
                }

                const actual = await vi.importActual<typeof import('fs/promises')>('fs/promises');
                return actual.stat(actualPath);
            });
        });

        it('should setup AI tools successfully', async () => {
            // Need to mock the chatmode file read after it's created
            mocks.readFile.mockImplementation(async (path: string, encoding?: string) => {
                const actual = await vi.importActual<typeof import('fs/promises')>('fs/promises');

                // Remap paths from src/command-helpers/calm-ai to repository root calm-ai
                let actualPath = path;
                if (path.includes('calm-ai')) {
                    const calmAiIndex = path.lastIndexOf('calm-ai');
                    const relativeToCalmAi = path.substring(calmAiIndex + 'calm-ai/'.length);
                    actualPath = resolve(__dirname, '../../../calm-ai', relativeToCalmAi);
                }

                // For chatmode files in test directory, return mock content
                if (path.includes('/test/directory/') && path.includes('CALM.chatmode.md')) {
                    return Promise.resolve('# Mock CALM chatmode content with sufficient length for validation to pass successfully');
                }

                return actual.readFile(actualPath, encoding as BufferEncoding);
            });

            await setupAiTools(provider, targetDirectory, false);

            expect(mocks.initLogger).toHaveBeenCalledWith(false, 'calm-ai-tools');

            // Different providers use different top-level directories
            // copilot uses .github/chatmodes, kiro uses .kiro
            // Just verify mkdir was called (path varies by provider's real config)
            expect(mocks.mkdir).toHaveBeenCalled();

            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('CALM AI tools setup completed successfully'));
        });

        it('should handle bundled resource read failure', async () => {
            mocks.readFile.mockRejectedValue(new Error('Bundled file not found'));

            await expect(setupAiTools(provider, targetDirectory, false)).rejects.toThrow();
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to setup AI tools'));
        });

        it('should handle empty bundled chatmode file and catch errors', async () => {
            mocks.readFile.mockImplementation(async (path: string, encoding?: string) => {
                if (path.includes('CALM.chatmode.md')) {
                    return Promise.resolve(''); // Empty content
                }
                // Use real files for other paths
                const actual = await vi.importActual<typeof import('fs/promises')>('fs/promises');
                let actualPath = path;
                if (path.includes('calm-ai')) {
                    const calmAiIndex = path.lastIndexOf('calm-ai');
                    const relativeToCalmAi = path.substring(calmAiIndex + 'calm-ai/'.length);
                    actualPath = resolve(__dirname, '../../../calm-ai', relativeToCalmAi);
                }
                return actual.readFile(actualPath, encoding as BufferEncoding);
            });

            await expect(setupAiTools(provider, targetDirectory, false)).rejects.toThrow();
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Could not load bundled chatmode config'));
        });

        it('should warn about incomplete chatmode content', async () => {
            mocks.readFile.mockImplementation(async (path: string, encoding?: string) => {
                if (path.includes('CALM.chatmode_template.md')) {
                    return Promise.resolve('short'); // Too short and missing CALM
                }

                // For chatmode files in test directory after writeFile is called, return the short content
                if (path.includes('/test/directory/') && path.includes('CALM.chatmode.md')) {
                    return Promise.resolve('short');
                }

                // Use real files for other paths
                const actual = await vi.importActual<typeof import('fs/promises')>('fs/promises');
                let actualPath = path;
                if (path.includes('calm-ai')) {
                    const calmAiIndex = path.lastIndexOf('calm-ai');
                    const relativeToCalmAi = path.substring(calmAiIndex + 'calm-ai/'.length);
                    actualPath = resolve(__dirname, '../../../calm-ai', relativeToCalmAi);
                }
                return actual.readFile(actualPath, encoding as BufferEncoding);
            });

            // Mock writeFile to prevent actual file creation
            mocks.writeFile.mockResolvedValue(undefined);

            await setupAiTools(provider, targetDirectory, false);

            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Bundled chatmode file appears incomplete or corrupted'));
        });
    });

    // 3. Error handling tests - run once (same behavior for all providers)
    describe('setupAiTools - error handling', () => {
        it('should throw error when target is not a directory', async () => {
            mocks.stat.mockImplementation((path: string) => {
                if (path === resolve(targetDirectory)) {
                    return Promise.resolve({ isDirectory: () => false });
                }
                return Promise.resolve({ isDirectory: () => true, size: 100 });
            });

            await expect(setupAiTools('copilot', targetDirectory, false)).rejects.toThrow(
                `Target path is not a directory: ${resolve(targetDirectory)}`
            );
        });

        it('should warn when not in a git repository', async () => {
            mocks.stat.mockImplementation((path: string) => {
                if (path === resolve(targetDirectory)) {
                    return Promise.resolve({ isDirectory: () => true, size: 100 });
                }
                if (path.endsWith('.git')) {
                    return Promise.reject(new Error('Not found'));
                }
                return Promise.resolve({ isDirectory: () => true, size: 100 });
            });

            await setupAiTools('copilot', targetDirectory, false);

            expect(mockLogger.warn).toHaveBeenCalledWith('Warning: No .git directory found. This may not be a git repository.');
        });

        it('should handle directory stat failure', async () => {
            mocks.stat.mockImplementation((path: string) => {
                if (path === resolve(targetDirectory)) {
                    return Promise.reject(new Error('Permission denied'));
                }
                return Promise.resolve({ isDirectory: () => true, size: 100 });
            });

            await expect(setupAiTools('copilot', targetDirectory, false)).rejects.toThrow('Permission denied');
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to setup AI tools'));
        });

        it('should handle chatmode file verification failure', async () => {
            mocks.stat.mockImplementation((path: string) => {
                if (path === resolve(targetDirectory)) {
                    return Promise.resolve({ isDirectory: () => true });
                }
                if (path.endsWith('.git')) {
                    return Promise.resolve({});
                }
                if (path.endsWith('CALM.chatmode.md')) {
                    return Promise.reject(new Error('File verification failed'));
                }
                return Promise.resolve({ isDirectory: () => true, size: 100 });
            });

            await expect(setupAiTools('copilot', targetDirectory, false)).rejects.toThrow('Chatmode configuration setup failed');
        });

        it('should handle empty chatmode file after creation and throw error', async () => {
            mocks.stat.mockImplementation((path: string) => {
                if (path === resolve(targetDirectory)) {
                    return Promise.resolve({ isDirectory: () => true });
                }
                if (path.endsWith('.git')) {
                    return Promise.resolve({});
                }
                if (path.endsWith('CALM.chatmode.md')) {
                    return Promise.resolve({ size: 0 }); // File was created but is empty
                }
                return Promise.resolve({ isDirectory: () => true, size: 100 });
            });

            await expect(setupAiTools('copilot', targetDirectory, false)).rejects.toThrow('Created chatmode file is empty');
        });
    });
});
