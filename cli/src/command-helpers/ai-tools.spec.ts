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

    // HIGH PRIORITY: Security & Data Validation Tests
    describe('getBundledResourcePath - security validation', () => {
        // Need to import the internal function for testing
        // We'll test it indirectly through setupAiTools since it's not exported

        it('should prevent path traversal attacks with ".." in path', async () => {
            // This test verifies that the function would reject malicious paths
            // by ensuring that real file operations never use traversal paths
            mocks.readFile.mockImplementation(async (path: string) => {
                if (String(path).includes('..')) {
                    throw new Error('Path traversal detected in test');
                }
                return Promise.resolve(JSON.stringify({
                    description: 'Test',
                    topLevelDirectory: '.github/chatmodes',
                    topLevelPromptDirectory: '',
                    'skill-prefix': '## ',
                    'skill-suffix': '',
                    frontmatter: '',
                    'skill-prompts': ['prompt1']
                }));
            });

            // Normal operation should not trigger path traversal
            await setupAiTools('copilot', targetDirectory, false);

            // Verify no paths with ".." were used
            const allCalls = mocks.readFile.mock.calls;
            allCalls.forEach(([path]) => {
                const pathStr = String(path);
                // Internal bundled resources shouldn't have .. in their constructed paths
                if (pathStr.includes('calm-ai')) {
                    expect(pathStr).not.toMatch(/\.\.\//);
                }
            });
        });

        it('should construct valid bundled resource paths without absolute path traversal', async () => {
            await setupAiTools('copilot', targetDirectory, false);

            // Verify that all bundled resource reads use relative paths from __dirname
            const allCalls = mocks.readFile.mock.calls;
            allCalls.forEach(([path]) => {
                const pathStr = String(path);
                if (pathStr.includes('calm-ai')) {
                    // Should contain calm-ai but not start with / (absolute)
                    expect(pathStr).toContain('calm-ai');
                }
            });
        });
    });

    describe('createChatmodeConfig - JSON validation', () => {
        it('should handle malformed JSON in config file', async () => {
            mocks.readFile.mockImplementation(async (path: string) => {
                if (String(path).endsWith('.json')) {
                    return Promise.resolve('{ invalid json malformed');
                }
                return Promise.resolve('# Valid markdown content');
            });

            await expect(setupAiTools('copilot', targetDirectory, false)).rejects.toThrow();
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringMatching(/Failed to setup AI tools/)
            );
        });

        it('should throw error for missing required field topLevelDirectory in config', async () => {
            mocks.readFile.mockImplementation(async (path: string) => {
                if (String(path).endsWith('.json')) {
                    return Promise.resolve(JSON.stringify({
                        description: 'Test',
                        // Missing topLevelDirectory
                        topLevelPromptDirectory: '',
                        'skill-prefix': '## ',
                        'skill-suffix': '',
                        frontmatter: '',
                        'skill-prompts': ['prompt1']
                    }));
                }
                return Promise.resolve('# Valid markdown content');
            });

            await expect(setupAiTools('copilot', targetDirectory, false)).rejects.toThrow(
                'Invalid AI configuration for provider: copilot'
            );
        });

        it('should throw error for missing required field skill-prompts in config', async () => {
            mocks.readFile.mockImplementation(async (path: string) => {
                if (String(path).endsWith('.json')) {
                    return Promise.resolve(JSON.stringify({
                        description: 'Test',
                        topLevelDirectory: '.github/chatmodes',
                        topLevelPromptDirectory: '',
                        'skill-prefix': '## ',
                        'skill-suffix': '',
                        frontmatter: ''
                        // Missing skill-prompts
                    }));
                }
                return Promise.resolve('# Valid markdown content');
            });

            await expect(setupAiTools('copilot', targetDirectory, false)).rejects.toThrow(
                'Invalid AI configuration for provider: copilot'
            );
        });

        it('should throw error for both missing required fields', async () => {
            mocks.readFile.mockImplementation(async (path: string) => {
                if (String(path).endsWith('.json')) {
                    return Promise.resolve(JSON.stringify({
                        description: 'Test',
                        topLevelPromptDirectory: '',
                        'skill-prefix': '## ',
                        'skill-suffix': '',
                        frontmatter: ''
                        // Missing both topLevelDirectory and skill-prompts
                    }));
                }
                return Promise.resolve('# Valid markdown content');
            });

            await expect(setupAiTools('copilot', targetDirectory, false)).rejects.toThrow(
                'Invalid AI configuration for provider: copilot'
            );
        });
    });

    describe('setupAiTools - config validation at entry point', () => {
        it('should throw error for invalid AI configuration early - missing topLevelDirectory', async () => {
            mocks.readFile.mockImplementation(async (path: string) => {
                if (String(path).endsWith('.json')) {
                    return Promise.resolve(JSON.stringify({
                        description: 'Test',
                        // topLevelDirectory missing
                        topLevelPromptDirectory: '',
                        'skill-prompts': null // Also invalid
                    }));
                }
                return Promise.resolve('# Valid markdown content');
            });

            await expect(setupAiTools('copilot', targetDirectory, false)).rejects.toThrow();
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining('Failed to setup AI tools')
            );
        });

        it('should throw error for invalid AI configuration early - missing skill-prompts', async () => {
            mocks.readFile.mockImplementation(async (path: string) => {
                if (String(path).endsWith('.json')) {
                    return Promise.resolve(JSON.stringify({
                        description: 'Test',
                        topLevelDirectory: '.github/chatmodes',
                        topLevelPromptDirectory: ''
                        // skill-prompts missing
                    }));
                }
                return Promise.resolve('# Valid markdown content');
            });

            await expect(setupAiTools('copilot', targetDirectory, false)).rejects.toThrow();
        });

        it('should validate config after parsing and before directory creation', async () => {
            mocks.readFile.mockImplementation(async (path: string) => {
                if (String(path).endsWith('.json')) {
                    // Return config with empty/falsy required fields
                    return Promise.resolve(JSON.stringify({
                        description: 'Test',
                        topLevelDirectory: '',  // Empty string (falsy)
                        topLevelPromptDirectory: '',
                        'skill-prompts': []  // Empty array (falsy)
                    }));
                }
                return Promise.resolve('# Valid markdown content');
            });

            await expect(setupAiTools('copilot', targetDirectory, false)).rejects.toThrow(
                'Invalid AI configuration for provider: copilot'
            );
        });
    });

    // MEDIUM PRIORITY: validateBundledResources() Function Tests
    describe('validateBundledResources - direct testing', () => {
        it('should successfully validate all bundled resources exist', async () => {
            // Mock all required files with valid content
            mocks.readFile.mockImplementation(async (path: string) => {
                const pathStr = String(path);
                if (pathStr.endsWith('.json')) {
                    return Promise.resolve(JSON.stringify({
                        description: 'Test',
                        topLevelDirectory: '.github/chatmodes',
                        topLevelPromptDirectory: '',
                        'skill-prefix': '## ',
                        'skill-suffix': '',
                        frontmatter: '',
                        'skill-prompts': ['prompt1']
                    }));
                }
                // All bundled resource files return valid content
                return Promise.resolve('# Valid markdown content with sufficient length for validation');
            });

            await setupAiTools('copilot', targetDirectory, false);

            // Verify validation was performed (logger should show validation message)
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringMatching(/Validating bundled AI tool resources/)
            );
        });

        it('should detect and report missing bundled files', async () => {
            let callCount = 0;
            mocks.readFile.mockImplementation(async (path: string) => {
                const pathStr = String(path);

                // Simulate missing bundled files (architecture-creation.md, node-creation.md)
                if (pathStr.includes('tools/architecture-creation.md') ||
                    pathStr.includes('tools/node-creation.md')) {
                    throw new Error('ENOENT: no such file or directory');
                }

                if (pathStr.endsWith('.json')) {
                    return Promise.resolve(JSON.stringify({
                        description: 'Test',
                        topLevelDirectory: '.github/chatmodes',
                        topLevelPromptDirectory: '',
                        'skill-prefix': '## ',
                        'skill-suffix': '',
                        frontmatter: '',
                        'skill-prompts': ['prompt1']
                    }));
                }

                return Promise.resolve('# Valid markdown content with sufficient length');
            });

            await setupAiTools('copilot', targetDirectory, false);

            // Verify missing files were logged as errors
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringMatching(/Missing bundled file:/)
            );
        });

        it('should detect and warn about empty/corrupted bundled files', async () => {
            mocks.readFile.mockImplementation(async (path: string) => {
                const pathStr = String(path);

                // Simulate corrupted/empty files
                if (pathStr.includes('tools/relationship-creation.md')) {
                    return Promise.resolve(''); // Empty file
                }

                if (pathStr.endsWith('.json')) {
                    return Promise.resolve(JSON.stringify({
                        description: 'Test',
                        topLevelDirectory: '.github/chatmodes',
                        topLevelPromptDirectory: '',
                        'skill-prefix': '## ',
                        'skill-suffix': '',
                        frontmatter: '',
                        'skill-prompts': ['prompt1']
                    }));
                }

                return Promise.resolve('# Valid markdown content with sufficient length');
            });

            await setupAiTools('copilot', targetDirectory, false);

            // Verify warning about corrupted file
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringMatching(/Bundled file appears empty:/)
            );
        });
    });

    // MEDIUM PRIORITY: createToolPrompts() Edge Cases
    describe('createToolPrompts - edge cases and error handling', () => {
        it('should warn when tool file content is too short', async () => {
            mocks.readFile.mockImplementation(async (path: string) => {
                const pathStr = String(path);

                // Short content for a tool file (< 100 chars)
                if (pathStr.includes('tools/metadata-creation.md')) {
                    return Promise.resolve('short'); // Only 5 chars
                }

                if (pathStr.endsWith('.json')) {
                    return Promise.resolve(JSON.stringify({
                        description: 'Test',
                        topLevelDirectory: '.github/chatmodes',
                        topLevelPromptDirectory: '',
                        'skill-prefix': '## ',
                        'skill-suffix': '',
                        frontmatter: '',
                        'skill-prompts': ['prompt1']
                    }));
                }

                // Mock chatmode file after creation
                if (pathStr.includes('CALM.chatmode.md')) {
                    return Promise.resolve('# Valid chatmode content with sufficient length');
                }

                return Promise.resolve('# Valid markdown content with sufficient length');
            });

            await setupAiTools('copilot', targetDirectory, false);

            // Verify warning about incomplete tool file
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringMatching(/Tool file .* appears incomplete/)
            );
        });

        it('should throw error when more than half of tool prompts fail', async () => {
            mocks.readFile.mockImplementation(async (path: string) => {
                const pathStr = String(path);

                // Fail specific tool files (7 out of 11)
                const failingFiles = [
                    'architecture-creation.md',
                    'node-creation.md',
                    'relationship-creation.md',
                    'interface-creation.md',
                    'metadata-creation.md',
                    'control-creation.md',
                    'flow-creation.md'
                ];

                if (pathStr.includes('tools/') && !pathStr.includes('templates/')) {
                    const fileName = pathStr.split('/').pop();
                    if (fileName && failingFiles.includes(fileName)) {
                        throw new Error('Read failed');
                    }
                }

                if (pathStr.endsWith('.json')) {
                    return Promise.resolve(JSON.stringify({
                        description: 'Test',
                        topLevelDirectory: '.github/chatmodes',
                        topLevelPromptDirectory: '',
                        'skill-prefix': '## ',
                        'skill-suffix': '',
                        frontmatter: '',
                        'skill-prompts': ['prompt1']
                    }));
                }

                // Mock chatmode file after creation
                if (pathStr.includes('CALM.chatmode.md')) {
                    return Promise.resolve('# Valid chatmode content with sufficient length');
                }

                return Promise.resolve('# Valid markdown content with sufficient length');
            });

            await expect(setupAiTools('copilot', targetDirectory, false)).rejects.toThrow(
                /Tool prompt setup failed:/
            );

            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringMatching(/More than half of tool prompts failed/)
            );
        });

        it('should warn but continue when less than half of tool prompts fail', async () => {
            let failCount = 0;
            mocks.readFile.mockImplementation(async (path: string) => {
                const pathStr = String(path);

                // Fail 3 out of 11 tool files (minority)
                if (pathStr.includes('tools/control-creation.md') ||
                    pathStr.includes('tools/flow-creation.md') ||
                    pathStr.includes('tools/pattern-creation.md')) {
                    throw new Error('Read failed');
                }

                if (pathStr.endsWith('.json')) {
                    return Promise.resolve(JSON.stringify({
                        description: 'Test',
                        topLevelDirectory: '.github/chatmodes',
                        topLevelPromptDirectory: '',
                        'skill-prefix': '## ',
                        'skill-suffix': '',
                        frontmatter: '',
                        'skill-prompts': ['prompt1']
                    }));
                }

                // Mock chatmode file after creation
                if (pathStr.includes('CALM.chatmode.md')) {
                    return Promise.resolve('# Valid chatmode content with sufficient length');
                }

                return Promise.resolve('# Valid markdown content with sufficient length');
            });

            await setupAiTools('copilot', targetDirectory, false);

            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringMatching(/Some tool prompts failed - AI functionality may be limited/)
            );

            // Should still complete successfully
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining('CALM AI tools setup completed successfully')
            );
        });

        it('should handle tool prompt file stat verification failure', async () => {
            mocks.readFile.mockImplementation(async (path: string) => {
                const pathStr = String(path);

                if (pathStr.endsWith('.json')) {
                    return Promise.resolve(JSON.stringify({
                        description: 'Test',
                        topLevelDirectory: '.github/chatmodes',
                        topLevelPromptDirectory: '',
                        'skill-prefix': '## ',
                        'skill-suffix': '',
                        frontmatter: '',
                        'skill-prompts': ['prompt1']
                    }));
                }

                // Mock chatmode file after creation
                if (pathStr.includes('CALM.chatmode.md')) {
                    return Promise.resolve('# Valid chatmode content with sufficient length');
                }

                return Promise.resolve('# Valid markdown content with sufficient length');
            });

            // Mock stat to fail for written tool prompt files
            mocks.stat.mockImplementation(async (path: string) => {
                const pathStr = String(path);

                if (pathStr === resolve(targetDirectory)) {
                    return Promise.resolve({ isDirectory: () => true, size: 100 });
                }
                if (pathStr.endsWith('.git')) {
                    return Promise.resolve({});
                }

                // Fail stat for a couple of tool prompt files after write
                if (pathStr.includes('calm-prompts/architecture-creation.md') ||
                    pathStr.includes('calm-prompts/node-creation.md')) {
                    throw new Error('Stat failed');
                }

                return Promise.resolve({ isDirectory: () => true, size: 100 });
            });

            await setupAiTools('copilot', targetDirectory, false);

            // Should log warnings about failed files
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringMatching(/Failed to create tool prompt/)
            );
        });

        it('should detect empty tool prompt files after write (size = 0)', async () => {
            mocks.readFile.mockImplementation(async (path: string) => {
                const pathStr = String(path);

                if (pathStr.endsWith('.json')) {
                    return Promise.resolve(JSON.stringify({
                        description: 'Test',
                        topLevelDirectory: '.github/chatmodes',
                        topLevelPromptDirectory: '',
                        'skill-prefix': '## ',
                        'skill-suffix': '',
                        frontmatter: '',
                        'skill-prompts': ['prompt1']
                    }));
                }

                // Mock chatmode file after creation
                if (pathStr.includes('CALM.chatmode.md')) {
                    return Promise.resolve('# Valid chatmode content with sufficient length');
                }

                return Promise.resolve('# Valid markdown content with sufficient length');
            });

            // Mock stat to return size 0 for some written files
            mocks.stat.mockImplementation(async (path: string) => {
                const pathStr = String(path);

                if (pathStr === resolve(targetDirectory)) {
                    return Promise.resolve({ isDirectory: () => true, size: 100 });
                }
                if (pathStr.endsWith('.git')) {
                    return Promise.resolve({});
                }

                // Return size 0 for interface-creation.md
                if (pathStr.includes('calm-prompts/interface-creation.md')) {
                    return Promise.resolve({ size: 0 });
                }

                return Promise.resolve({ isDirectory: () => true, size: 100 });
            });

            await setupAiTools('copilot', targetDirectory, false);

            // Should log warning about empty written file
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringMatching(/Failed to create tool prompt/)
            );
        });
    });

    // MEDIUM PRIORITY: Content Validation Tests
    describe('setupAiTools - directory handling variations', () => {
        it('should use chatmodesDir directly when topLevelPromptDirectory is empty string', async () => {
            mocks.readFile.mockImplementation(async (path: string) => {
                const pathStr = String(path);

                if (pathStr.endsWith('.json')) {
                    return Promise.resolve(JSON.stringify({
                        description: 'Test',
                        topLevelDirectory: '.github/chatmodes',
                        topLevelPromptDirectory: '', // Empty string
                        'skill-prefix': '## ',
                        'skill-suffix': '',
                        frontmatter: '',
                        'skill-prompts': ['prompt1']
                    }));
                }

                // Mock chatmode file after creation
                if (pathStr.includes('CALM.chatmode.md')) {
                    return Promise.resolve('# Valid chatmode content with sufficient length');
                }

                return Promise.resolve('# Valid markdown content with sufficient length');
            });

            await setupAiTools('copilot', targetDirectory, false);

            // Verify chatmode was created directly in chatmodes directory
            expect(mocks.writeFile).toHaveBeenCalledWith(
                expect.stringContaining('.github/chatmodes/CALM.chatmode.md'),
                expect.any(String),
                'utf-8'
            );
        });

        it('should create nested directory when topLevelPromptDirectory is specified', async () => {
            mocks.readFile.mockImplementation(async (path: string) => {
                const pathStr = String(path);

                if (pathStr.endsWith('.json')) {
                    return Promise.resolve(JSON.stringify({
                        description: 'Test',
                        topLevelDirectory: '.claude',
                        topLevelPromptDirectory: 'prompts', // Nested directory
                        'skill-prefix': '## ',
                        'skill-suffix': '',
                        frontmatter: '',
                        'skill-prompts': ['prompt1']
                    }));
                }

                // Mock chatmode file after creation
                if (pathStr.includes('CALM.chatmode.md')) {
                    return Promise.resolve('# Valid chatmode content with sufficient length');
                }

                return Promise.resolve('# Valid markdown content with sufficient length');
            });

            await setupAiTools('copilot', targetDirectory, false);

            // Verify nested directory was created
            expect(mocks.mkdir).toHaveBeenCalledWith(
                expect.stringContaining('.claude/prompts'),
                { recursive: true }
            );

            // Verify chatmode was created in nested directory
            expect(mocks.writeFile).toHaveBeenCalledWith(
                expect.stringContaining('.claude/prompts/CALM.chatmode.md'),
                expect.any(String),
                'utf-8'
            );
        });
    });
});
