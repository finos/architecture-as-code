import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { setupWorkspaceCommands } from './commands';

const mocks = vi.hoisted(() => {
    return {
        ensureWorkspaceBundle: vi.fn(async () => '/fake/bundle'),
        getActiveWorkspace: vi.fn(async () => 'default'),
        listWorkspaces: vi.fn(async () => ['default', 'other']),
        setActiveWorkspace: vi.fn(async () => { }),
        cleanWorkspaceBundle: vi.fn(async () => { }),
        cleanAllWorkspaces: vi.fn(async () => { }),
        addFileToBundle: vi.fn(async () => ({ id: 'test-doc', destPath: '/fake/bundle/files/test.json', rel: 'files/test.json' })),
        printBundleTree: vi.fn(async () => { }),
        populateWorkspaceBundle: vi.fn(async () => { }),
        createNewDocument: vi.fn(async () => '/fake/repo/com.example-architecture-my-arch.json'),
        pushWorkspaceToHub: vi.fn(async () => { }),
        findWorkspaceBundlePath: vi.fn(() => '/fake/bundle'),
        findGitRoot: vi.fn(() => '/fake/repo'),
        loadCliConfig: vi.fn(async () => ({ calmHubUrl: 'https://calmhub.example.com' })),
        CalmHubService: vi.fn(() => ({ isMockService: true })),
        select: vi.fn(async () => 'architecture'),
        input: vi.fn(async () => 'prompted-name'),
        readFile: vi.fn(async () => JSON.stringify({ title: 'My Architecture' })),
    };
});

vi.mock('./workspace', () => ({
    ensureWorkspaceBundle: mocks.ensureWorkspaceBundle,
    getActiveWorkspace: mocks.getActiveWorkspace,
    listWorkspaces: mocks.listWorkspaces,
    setActiveWorkspace: mocks.setActiveWorkspace,
    cleanWorkspaceBundle: mocks.cleanWorkspaceBundle,
    cleanAllWorkspaces: mocks.cleanAllWorkspaces,
}));

vi.mock('./bundle', () => ({
    addFileToBundle: mocks.addFileToBundle,
    printBundleTree: mocks.printBundleTree,
}));

vi.mock('./populate', () => ({
    populateWorkspaceBundle: mocks.populateWorkspaceBundle,
}));

vi.mock('./new', () => ({
    createNewDocument: mocks.createNewDocument,
}));

vi.mock('./push', () => ({
    pushWorkspaceToHub: mocks.pushWorkspaceToHub,
}));

vi.mock('../../workspace-resolver', () => ({
    findWorkspaceBundlePath: mocks.findWorkspaceBundlePath,
    findGitRoot: mocks.findGitRoot,
}));

vi.mock('../../cli-config', () => ({
    loadCliConfig: mocks.loadCliConfig,
}));

vi.mock('../../service/calm-hub-service', () => ({
    CalmHubService: mocks.CalmHubService,
}));

vi.mock('fs/promises', async (importOriginal) => {
    const actual = await importOriginal<typeof import('fs/promises')>();
    return { ...actual, readFile: mocks.readFile };
});

vi.mock('@inquirer/prompts', () => ({
    select: mocks.select,
    input: mocks.input,
}));

vi.mock('@finos/calm-shared/src/logger', () => ({
    initLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    }),
}));

describe('setupWorkspaceCommands', () => {
    let program: Command;
    let exitSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        program = new Command();
        program.exitOverride();
        setupWorkspaceCommands(program);
        vi.clearAllMocks();
        exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit'); });
    });

    afterEach(() => {
        exitSpy.mockRestore();
    });

    describe('workspace init', () => {
        it('should call ensureWorkspaceBundle with the given name', async () => {
            await program.parseAsync(['node', 'test', 'workspace', 'init', 'my-ws']);
            expect(mocks.ensureWorkspaceBundle).toHaveBeenCalledWith(
                expect.any(String),
                'my-ws'
            );
        });

        it('should call ensureWorkspaceBundle with custom dir', async () => {
            await program.parseAsync(['node', 'test', 'workspace', 'init', 'my-ws', '--dir', '/custom/dir']);
            expect(mocks.ensureWorkspaceBundle).toHaveBeenCalledWith(
                '/custom/dir',
                'my-ws'
            );
        });

        it('should exit on error', async () => {
            mocks.ensureWorkspaceBundle.mockRejectedValueOnce(new Error('init failed'));
            await expect(program.parseAsync(['node', 'test', 'workspace', 'init', 'ws'])).rejects.toThrow();
            expect(exitSpy).toHaveBeenCalledWith(1);
        });
    });

    describe('workspace add', () => {
        it('should call addFileToBundle using title from file as id', async () => {
            // readFile mock returns JSON with title 'My Architecture'; select mock returns 'architecture'
            await program.parseAsync(['node', 'test', 'workspace', 'add', 'test.json']);
            expect(mocks.addFileToBundle).toHaveBeenCalledWith(
                '/fake/bundle',
                expect.stringContaining('test.json'),
                expect.objectContaining({ id: 'My Architecture', type: 'architecture' })
            );
        });

        it('should prompt for name when file has no title field', async () => {
            mocks.readFile.mockResolvedValueOnce(JSON.stringify({ $id: 'no-title' }));
            await program.parseAsync(['node', 'test', 'workspace', 'add', 'test.json']);
            expect(mocks.input).toHaveBeenCalled();
            expect(mocks.addFileToBundle).toHaveBeenCalledWith(
                '/fake/bundle',
                expect.stringContaining('test.json'),
                expect.objectContaining({ id: 'prompted-name', type: 'architecture' })
            );
        });

        it('should use --id and --type when provided, skipping prompts', async () => {
            await program.parseAsync(['node', 'test', 'workspace', 'add', 'test.json', '--id', 'custom-id', '--type', 'pattern', '--copy']);
            expect(mocks.select).not.toHaveBeenCalled();
            expect(mocks.addFileToBundle).toHaveBeenCalledWith(
                '/fake/bundle',
                expect.stringContaining('test.json'),
                expect.objectContaining({ id: 'custom-id', copy: true, type: 'pattern' })
            );
        });

        it('should exit when no workspace bundle found', async () => {
            mocks.findWorkspaceBundlePath.mockReturnValueOnce(null);
            await expect(
                program.parseAsync(['node', 'test', 'workspace', 'add', 'test.json', '--type', 'architecture', '--id', 'test'])
            ).rejects.toThrow();
            expect(exitSpy).toHaveBeenCalledWith(1);
        });

        it('should exit on addFileToBundle error', async () => {
            mocks.addFileToBundle.mockRejectedValueOnce(new Error('add failed'));
            await expect(
                program.parseAsync(['node', 'test', 'workspace', 'add', 'test.json', '--type', 'architecture', '--id', 'test'])
            ).rejects.toThrow();
            expect(exitSpy).toHaveBeenCalledWith(1);
        });
    });

    describe('workspace populate', () => {
        it('should call populateWorkspaceBundle', async () => {
            await program.parseAsync(['node', 'test', 'workspace', 'populate']);
            expect(mocks.populateWorkspaceBundle).toHaveBeenCalledWith(undefined, { debug: false });
        });

        it('should pass verbose option', async () => {
            await program.parseAsync(['node', 'test', 'workspace', 'populate', '--verbose']);
            expect(mocks.populateWorkspaceBundle).toHaveBeenCalledWith(undefined, { debug: true });
        });

        it('should exit on error', async () => {
            mocks.populateWorkspaceBundle.mockRejectedValueOnce(new Error('populate failed'));
            await expect(program.parseAsync(['node', 'test', 'workspace', 'populate'])).rejects.toThrow();
            expect(exitSpy).toHaveBeenCalledWith(1);
        });
    });

    describe('workspace tree', () => {
        it('should call printBundleTree', async () => {
            await program.parseAsync(['node', 'test', 'workspace', 'tree']);
            expect(mocks.printBundleTree).toHaveBeenCalledWith('/fake/bundle');
        });

        it('should exit when no workspace bundle found', async () => {
            mocks.findWorkspaceBundlePath.mockReturnValueOnce(null);
            await expect(program.parseAsync(['node', 'test', 'workspace', 'tree'])).rejects.toThrow();
            expect(exitSpy).toHaveBeenCalledWith(1);
        });

        it('should exit on error', async () => {
            mocks.printBundleTree.mockRejectedValueOnce(new Error('tree failed'));
            await expect(program.parseAsync(['node', 'test', 'workspace', 'tree'])).rejects.toThrow();
            expect(exitSpy).toHaveBeenCalledWith(1);
        });
    });

    describe('workspace list', () => {
        it('should call listWorkspaces and getActiveWorkspace', async () => {
            await program.parseAsync(['node', 'test', 'workspace', 'list']);
            expect(mocks.listWorkspaces).toHaveBeenCalledWith('/fake/repo');
            expect(mocks.getActiveWorkspace).toHaveBeenCalledWith('/fake/repo');
        });

        it('should exit when no git root found', async () => {
            mocks.findGitRoot.mockReturnValueOnce(null);
            await expect(program.parseAsync(['node', 'test', 'workspace', 'list'])).rejects.toThrow();
            expect(exitSpy).toHaveBeenCalledWith(1);
        });

        it('should handle empty workspace list', async () => {
            mocks.listWorkspaces.mockResolvedValueOnce([]);
            await program.parseAsync(['node', 'test', 'workspace', 'list']);
            expect(mocks.listWorkspaces).toHaveBeenCalled();
        });

        it('should exit on error', async () => {
            mocks.listWorkspaces.mockRejectedValueOnce(new Error('list failed'));
            await expect(program.parseAsync(['node', 'test', 'workspace', 'list'])).rejects.toThrow();
            expect(exitSpy).toHaveBeenCalledWith(1);
        });
    });

    describe('workspace show', () => {
        it('should call getActiveWorkspace', async () => {
            await program.parseAsync(['node', 'test', 'workspace', 'show']);
            expect(mocks.getActiveWorkspace).toHaveBeenCalledWith('/fake/repo');
        });

        it('should handle no active workspace', async () => {
            mocks.getActiveWorkspace.mockResolvedValueOnce(null);
            await program.parseAsync(['node', 'test', 'workspace', 'show']);
            expect(mocks.getActiveWorkspace).toHaveBeenCalled();
        });

        it('should exit when no git root found', async () => {
            mocks.findGitRoot.mockReturnValueOnce(null);
            await expect(program.parseAsync(['node', 'test', 'workspace', 'show'])).rejects.toThrow();
            expect(exitSpy).toHaveBeenCalledWith(1);
        });

        it('should exit on error', async () => {
            mocks.getActiveWorkspace.mockRejectedValueOnce(new Error('show failed'));
            await expect(program.parseAsync(['node', 'test', 'workspace', 'show'])).rejects.toThrow();
            expect(exitSpy).toHaveBeenCalledWith(1);
        });
    });

    describe('workspace switch', () => {
        it('should call setActiveWorkspace', async () => {
            await program.parseAsync(['node', 'test', 'workspace', 'switch', 'other']);
            expect(mocks.setActiveWorkspace).toHaveBeenCalledWith('/fake/repo', 'other');
        });

        it('should exit when workspace not found', async () => {
            await expect(program.parseAsync(['node', 'test', 'workspace', 'switch', 'nonexistent'])).rejects.toThrow();
            expect(exitSpy).toHaveBeenCalledWith(1);
        });

        it('should exit when no git root found', async () => {
            mocks.findGitRoot.mockReturnValueOnce(null);
            await expect(program.parseAsync(['node', 'test', 'workspace', 'switch', 'other'])).rejects.toThrow();
            expect(exitSpy).toHaveBeenCalledWith(1);
        });

        it('should exit on error', async () => {
            mocks.listWorkspaces.mockRejectedValueOnce(new Error('switch failed'));
            await expect(program.parseAsync(['node', 'test', 'workspace', 'switch', 'other'])).rejects.toThrow();
            expect(exitSpy).toHaveBeenCalledWith(1);
        });
    });

    describe('workspace clean', () => {
        it('should call cleanWorkspaceBundle for active workspace', async () => {
            await program.parseAsync(['node', 'test', 'workspace', 'clean']);
            expect(mocks.cleanWorkspaceBundle).toHaveBeenCalledWith('/fake/repo', 'default');
        });

        it('should call cleanAllWorkspaces with --all flag', async () => {
            await program.parseAsync(['node', 'test', 'workspace', 'clean', '--all']);
            expect(mocks.cleanAllWorkspaces).toHaveBeenCalledWith('/fake/repo');
        });

        it('should exit when no git root found', async () => {
            mocks.findGitRoot.mockReturnValueOnce(null);
            await expect(program.parseAsync(['node', 'test', 'workspace', 'clean'])).rejects.toThrow();
            expect(exitSpy).toHaveBeenCalledWith(1);
        });

        it('should exit when no active workspace and no --all flag', async () => {
            mocks.getActiveWorkspace.mockResolvedValueOnce(null);
            await expect(program.parseAsync(['node', 'test', 'workspace', 'clean'])).rejects.toThrow();
            expect(exitSpy).toHaveBeenCalledWith(1);
        });

        it('should exit on error', async () => {
            mocks.cleanWorkspaceBundle.mockRejectedValueOnce(new Error('clean failed'));
            await expect(program.parseAsync(['node', 'test', 'workspace', 'clean'])).rejects.toThrow();
            expect(exitSpy).toHaveBeenCalledWith(1);
        });
    });

    describe('workspace new', () => {
        it('creates a document and registers it with its namespace', async () => {
            await program.parseAsync(['node', 'test', 'workspace', 'new', 'architecture', 'com.example', 'my-arch']);
            expect(mocks.createNewDocument).toHaveBeenCalledWith('com.example', 'my-arch', 'architecture');
            expect(mocks.addFileToBundle).toHaveBeenCalledWith(
                '/fake/bundle',
                '/fake/repo/com.example-architecture-my-arch.json',
                { type: 'architecture', namespace: 'com.example' }
            );
        });

        it('exits when no workspace bundle is found', async () => {
            mocks.findWorkspaceBundlePath.mockReturnValueOnce(null);
            await expect(
                program.parseAsync(['node', 'test', 'workspace', 'new', 'architecture', 'com.example', 'my-arch'])
            ).rejects.toThrow();
            expect(exitSpy).toHaveBeenCalledWith(1);
        });

        it('exits on createNewDocument error', async () => {
            mocks.createNewDocument.mockRejectedValueOnce(new Error('create failed'));
            await expect(
                program.parseAsync(['node', 'test', 'workspace', 'new', 'architecture', 'com.example', 'my-arch'])
            ).rejects.toThrow();
            expect(exitSpy).toHaveBeenCalledWith(1);
        });
    });

    describe('workspace push', () => {
        it('calls pushWorkspaceToHub with a CalmHubService instance', async () => {
            await program.parseAsync(['node', 'test', 'workspace', 'push']);
            expect(mocks.CalmHubService).toHaveBeenCalledWith('https://calmhub.example.com');
            expect(mocks.pushWorkspaceToHub).toHaveBeenCalledWith(
                '/fake/bundle',
                expect.objectContaining({ isMockService: true })
            );
        });

        it('uses --calm-hub-url over the value from config', async () => {
            await program.parseAsync(['node', 'test', 'workspace', 'push', '--calm-hub-url', 'https://override.example.com']);
            expect(mocks.CalmHubService).toHaveBeenCalledWith('https://override.example.com');
        });

        it('exits when no workspace bundle is found', async () => {
            mocks.findWorkspaceBundlePath.mockReturnValueOnce(null);
            await expect(program.parseAsync(['node', 'test', 'workspace', 'push'])).rejects.toThrow();
            expect(exitSpy).toHaveBeenCalledWith(1);
        });

        it('exits when no CalmHub URL is configured', async () => {
            mocks.loadCliConfig.mockResolvedValueOnce({});
            await expect(program.parseAsync(['node', 'test', 'workspace', 'push'])).rejects.toThrow();
            expect(exitSpy).toHaveBeenCalledWith(1);
        });

        it('exits on pushWorkspaceToHub error', async () => {
            mocks.pushWorkspaceToHub.mockRejectedValueOnce(new Error('push failed'));
            await expect(program.parseAsync(['node', 'test', 'workspace', 'push'])).rejects.toThrow();
            expect(exitSpy).toHaveBeenCalledWith(1);
        });
    });
});
