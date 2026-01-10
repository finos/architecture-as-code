import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join, resolve } from 'path';
import { setupAiTools, setupEnhancedAiTools } from './ai-tools';

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
        mocks.readFile.mockResolvedValue('# Mock CALM content with enough text to pass validation');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('setupAiTools', () => {
        const targetDirectory = '/test/directory';
        const verbose = false;

        it('should setup AI tools successfully', async () => {
            await setupAiTools(targetDirectory, verbose);

            expect(mocks.initLogger).toHaveBeenCalledWith(verbose, 'calm-ai-tools');
            expect(mocks.mkdir).toHaveBeenCalledWith(
                join(resolve(targetDirectory), '.github', 'chatmodes'),
                { recursive: true }
            );
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('CALM AI tools setup completed successfully'));
        });

        it('should throw error when target is not a directory', async () => {
            mocks.stat.mockImplementation((path: string) => {
                if (path === resolve(targetDirectory)) {
                    return Promise.resolve({ isDirectory: () => false });
                }
                return Promise.resolve({ isDirectory: () => true, size: 100 });
            });

            await expect(setupAiTools(targetDirectory, verbose)).rejects.toThrow(
                `Target path is not a directory: ${resolve(targetDirectory)}`
            );
        });

        it('should handle bundled resource read failure', async () => {
            mocks.readFile.mockRejectedValue(new Error('Bundled file not found'));

            await expect(setupAiTools(targetDirectory, verbose)).rejects.toThrow();
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to setup AI tools'));
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

            await setupAiTools(targetDirectory, verbose);

            expect(mockLogger.warn).toHaveBeenCalledWith('Warning: No .git directory found. This may not be a git repository.');
        });

        it('should handle empty bundled files and catch errors', async () => {
            mocks.readFile.mockImplementation((path: string) => {
                if (path.includes('CALM.chatmode.md')) {
                    return Promise.resolve(''); // Empty content
                }
                return Promise.resolve('# Valid content with CALM and sufficient length for validation');
            });

            // Should still complete but log error
            await setupAiTools(targetDirectory, verbose);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Could not load bundled chatmode config'));
        });

        it('should warn about incomplete chatmode content but still proceed', async () => {
            mocks.readFile.mockImplementation((path: string) => {
                if (path.includes('CALM.chatmode.md')) {
                    return Promise.resolve('short'); // Too short and missing CALM
                }
                return Promise.resolve('# Valid content with CALM and sufficient length for validation');
            });

            await setupAiTools(targetDirectory, verbose);

            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Bundled chatmode file appears incomplete or corrupted'));
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

            await expect(setupAiTools(targetDirectory, verbose)).rejects.toThrow('Chatmode configuration setup failed');
        });

        it('should enable verbose logging when requested', async () => {
            await setupAiTools(targetDirectory, true);

            expect(mocks.initLogger).toHaveBeenCalledWith(true, 'calm-ai-tools');
        });

        it('should handle directory stat failure', async () => {
            mocks.stat.mockImplementation((path: string) => {
                if (path === resolve(targetDirectory)) {
                    return Promise.reject(new Error('Permission denied'));
                }
                return Promise.resolve({ isDirectory: () => true, size: 100 });
            });

            await expect(setupAiTools(targetDirectory, verbose)).rejects.toThrow('Permission denied');
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to setup AI tools'));
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

            await expect(setupAiTools(targetDirectory, verbose)).rejects.toThrow('Created chatmode file is empty');
        });
    });

    const providers = ["copilot", "kiro"] as const;

    describe.each(providers)('setupEnhancedAiTools: %s', (provider) => {
        const targetDirectory = '/test/directory';
        const verbose = false;

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
                        return Promise.resolve({} as any);
                    }
                    return Promise.resolve({
                        isDirectory: () => true,
                        size: 100
                    } as any);
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
            await setupEnhancedAiTools(provider, targetDirectory, verbose);

            expect(mocks.initLogger).toHaveBeenCalledWith(verbose, 'calm-ai-tools');

            // Different providers use different top-level directories
            // copilot uses .github/chatmodes, kiro uses .kiro
            // Just verify mkdir was called (path varies by provider's real config)
            expect(mocks.mkdir).toHaveBeenCalled();

            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('CALM AI tools setup completed successfully'));
        });
    });


});
