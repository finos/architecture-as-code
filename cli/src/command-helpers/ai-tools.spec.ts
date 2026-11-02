import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import os from 'os';
import path from 'path';
import { setupAiTools } from './ai-tools';

const mocks = vi.hoisted(() => ({
    initLogger: vi.fn(),
}));

vi.mock('@finos/calm-shared', () => ({
    initLogger: mocks.initLogger,
}));

const REAL_BUNDLE = path.resolve(__dirname, '../../../calm-ai');
const PROVIDERS = {
    copilot: '.github/skills',
    kiro: '.kiro/skills',
    claude: '.claude/skills',
    codex: '.agents/skills',
} as const;

describe('ai-tools', () => {
    const logger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    };
    let tempDir: string;
    let targetDir: string;

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.initLogger.mockReturnValue(logger);
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'calm-ai-tools-'));
        targetDir = path.join(tempDir, 'repo');
        fs.mkdirSync(path.join(targetDir, '.git'), { recursive: true });
    });

    afterEach(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    function writeBundle(root: string, files: Record<string, string>, provider = 'copilot', config: unknown = { skillsDirectory: '.github/skills' }) {
        fs.mkdirSync(path.join(root, 'ai-assistants'), { recursive: true });
        fs.writeFileSync(path.join(root, 'ai-assistants', `${provider}.json`),
            typeof config === 'string' ? config : JSON.stringify(config));
        for (const [file, content] of Object.entries(files)) {
            const target = path.join(root, 'skills', 'calm', file);
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, content);
        }
        return root;
    }

    const validSkill = '---\nname: calm\ndescription: CALM skill\n---\n\n# FINOS CALM\n';

    describe('with the real bundle', () => {
        it.each(Object.entries(PROVIDERS))('installs the skill for %s under %s', async (provider, skillsDirectory) => {
            await setupAiTools(provider, targetDir, false, REAL_BUNDLE);

            const skillDir = path.join(targetDir, skillsDirectory, 'calm');
            const skill = fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8');
            expect(skill).toMatch(/^---\nname: calm\n/);
            expect(skill).toContain('references/node.md');

            const references = fs.readdirSync(path.join(skillDir, 'references')).sort();
            expect(references).toEqual(fs.readdirSync(path.join(REAL_BUNDLE, 'skills', 'calm', 'references')).sort());
            expect(references).toContain('cli.md');

            expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Installed the CALM skill'));
            expect(logger.error).not.toHaveBeenCalled();
        });

        it('passes the verbose flag to the logger', async () => {
            await setupAiTools('claude', targetDir, true, REAL_BUNDLE);
            expect(mocks.initLogger).toHaveBeenCalledWith(true, 'calm-ai-tools');
        });

        it('overwrites a previously installed skill', async () => {
            const skillFile = path.join(targetDir, '.claude/skills/calm/SKILL.md');
            fs.mkdirSync(path.dirname(skillFile), { recursive: true });
            fs.writeFileSync(skillFile, 'stale');

            await setupAiTools('claude', targetDir, false, REAL_BUNDLE);

            expect(fs.readFileSync(skillFile, 'utf8')).toMatch(/^---\nname: calm\n/);
        });

        it('rejects an unknown provider', async () => {
            await expect(setupAiTools('unknown', targetDir, false, REAL_BUNDLE))
                .rejects.toThrow('Failed to load AI configuration for provider "unknown"');
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to setup AI tools'));
        });
    });

    describe('target directory checks', () => {
        it('throws when the target is not a directory', async () => {
            const file = path.join(tempDir, 'file.txt');
            fs.writeFileSync(file, 'x');

            await expect(setupAiTools('copilot', file, false, REAL_BUNDLE))
                .rejects.toThrow(`Target path is not a directory: ${file}`);
        });

        it('throws when the target does not exist', async () => {
            await expect(setupAiTools('copilot', path.join(tempDir, 'missing'), false, REAL_BUNDLE))
                .rejects.toThrow('ENOENT');
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to setup AI tools'));
        });

        it('warns but continues when the target is not a git repository', async () => {
            fs.rmSync(path.join(targetDir, '.git'), { recursive: true });

            await setupAiTools('copilot', targetDir, false, REAL_BUNDLE);

            expect(logger.warn).toHaveBeenCalledWith('Warning: No .git directory found. This may not be a git repository.');
            expect(fs.existsSync(path.join(targetDir, '.github/skills/calm/SKILL.md'))).toBe(true);
        });
    });

    describe('provider configuration checks', () => {
        it('throws on malformed JSON', async () => {
            const bundle = writeBundle(path.join(tempDir, 'bundle'), { 'SKILL.md': validSkill }, 'copilot', '{ not json');

            await expect(setupAiTools('copilot', targetDir, false, bundle))
                .rejects.toThrow('Failed to load AI configuration for provider "copilot"');
        });

        it('throws when skillsDirectory is missing', async () => {
            const bundle = writeBundle(path.join(tempDir, 'bundle'), { 'SKILL.md': validSkill }, 'copilot', { description: 'x' });

            await expect(setupAiTools('copilot', targetDir, false, bundle))
                .rejects.toThrow('Invalid AI configuration for provider: copilot');
        });

        it.each(['../outside', '/etc/skills', 'a/../../b'])('rejects an unsafe skillsDirectory %s', async (skillsDirectory) => {
            const bundle = writeBundle(path.join(tempDir, 'bundle'), { 'SKILL.md': validSkill }, 'copilot', { skillsDirectory });

            await expect(setupAiTools('copilot', targetDir, false, bundle))
                .rejects.toThrow('Unsafe skills directory');
            expect(fs.existsSync(path.join(tempDir, 'outside'))).toBe(false);
        });
    });

    describe('bundled skill checks', () => {
        it('throws when SKILL.md is missing from the bundle', async () => {
            const bundle = writeBundle(path.join(tempDir, 'bundle'), { 'references/node.md': '# Node' });

            await expect(setupAiTools('copilot', targetDir, false, bundle))
                .rejects.toThrow('Bundled skill is missing SKILL.md');
        });

        it('throws when SKILL.md has no frontmatter', async () => {
            const bundle = writeBundle(path.join(tempDir, 'bundle'), { 'SKILL.md': '# No frontmatter' });

            await expect(setupAiTools('copilot', targetDir, false, bundle))
                .rejects.toThrow('Bundled SKILL.md has no valid frontmatter');
        });

        it('throws when a bundled file is empty', async () => {
            const bundle = writeBundle(path.join(tempDir, 'bundle'), { 'SKILL.md': validSkill, 'references/empty.md': '   ' });

            await expect(setupAiTools('copilot', targetDir, false, bundle))
                .rejects.toThrow('Bundled skill file is empty: references/empty.md');
        });

        it('copies nested supporting files', async () => {
            const bundle = writeBundle(path.join(tempDir, 'bundle'), {
                'SKILL.md': validSkill,
                'references/node.md': '# Node',
                'references/deep/more.md': '# More',
            });

            await setupAiTools('copilot', targetDir, false, bundle);

            const skillDir = path.join(targetDir, '.github/skills/calm');
            expect(fs.readFileSync(path.join(skillDir, 'references/deep/more.md'), 'utf8')).toBe('# More');
            expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('(3 files)'));
        });
    });
});
