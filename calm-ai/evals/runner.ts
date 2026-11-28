import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { inject } from 'vitest';

const execute = promisify(execFile);
const cli = fileURLToPath(new URL('../../cli/dist/index.js', import.meta.url));

declare module 'vitest' {
    interface ProvidedContext {
        evalRunDirectory: string;
    }
}

interface RunOptions {
    cwd: string;
    env: NodeJS.ProcessEnv;
    timeout: number;
}

interface Assistant {
    provider: string;
    skillPath: string;
    run(prompt: string, options: RunOptions): Promise<{ stdout: string; stderr: string }>;
}

function runAssistant(command: string, args: string[], promptArgs: string[], options: RunOptions) {
    const model = options.env.CALM_EVAL_MODEL;
    const execution = execute(command, [
        ...args, ...(model ? ['--model', model] : []), ...promptArgs,
    ], { ...options, maxBuffer: 16 * 1024 * 1024 });
    execution.child.stdin?.end();
    return execution;
}

const codex: Assistant = {
    provider: 'codex',
    skillPath: '.agents/skills/calm/SKILL.md',
    run(prompt, options) {
        return runAssistant('codex', [
            '--ask-for-approval', 'never', 'exec', '--sandbox', 'workspace-write',
            '--ignore-user-config', '--ephemeral', '--json',
        ], ['--', prompt], options);
    },
};

const claude: Assistant = {
    provider: 'claude',
    skillPath: '.claude/skills/calm/SKILL.md',
    run(prompt, options) {
        return runAssistant('claude', [
            '--print', '--output-format', 'json', '--no-session-persistence',
            '--restricted', '--strict-mcp-config', '--permission-mode', 'dontAsk',
            '--tools', 'Read,Glob,Grep,Write,Edit,Bash',
            '--allowedTools', 'Read,Glob,Grep,Write,Edit,Bash(which calm),Bash(command -v calm),Bash(calm validate *)',
        ], ['--', prompt], options);
    },
};

const copilot: Assistant = {
    provider: 'copilot',
    skillPath: '.github/agents/CALM.agent.md',
    run(prompt, options) {
        return runAssistant('copilot', [
            '--output-format', 'json', '--no-ask-user',
            '--no-custom-instructions', '--disable-builtin-mcps', '--disallow-temp-dir',
            '--available-tools=bash,view,glob,grep,create,edit,apply_patch',
            `--allow-tool=write(${options.cwd}/**),shell(calm validate:*),shell(which calm),shell(command -v calm)`,
        ], ['--prompt', prompt], {
            ...options,
            env: {
                ...options.env,
                COPILOT_ALLOW_ALL: 'false',
                COPILOT_ASSISTED_APPROVAL: 'false',
                COPILOT_AUTO_UPDATE: 'false',
                COPILOT_DISABLE_LOGIN_SHELL_ENV: '1',
            },
        });
    },
};

export function selectAssistant(name = process.env.CALM_EVAL_ASSISTANT ?? 'codex'): Assistant {
    switch (name) {
        case 'codex': return codex;
        case 'claude': return claude;
        case 'copilot': return copilot;
        default: throw new Error(`Unsupported CALM_EVAL_ASSISTANT "${name}". Choose codex, claude, or copilot.`);
    }
}

export async function runEval(
    assistant: Assistant,
    prompt: string,
    filename: string,
    assertArtifact: (path: string) => Promise<void>,
): Promise<void> {
    const run = await mkdtemp(join(inject('evalRunDirectory'), `${assistant.provider}-`));
    const cwd = join(run, 'workspace');
    const bin = join(run, 'bin');
    const env = { ...process.env, PATH: [bin, process.env.PATH].join(delimiter) };
    const commandOptions = { cwd, env, timeout: 15_000 };
    let stage = 'setup';

    async function log(result: { stdout?: string; stderr?: string }) {
        await Promise.all([
            writeFile(join(run, `${stage}.stdout.log`), result.stdout ?? ''),
            writeFile(join(run, `${stage}.stderr.log`), result.stderr ?? ''),
        ]);
    }

    try {
        await mkdir(cwd);
        await mkdir(bin);
        await symlink(cli, join(bin, 'calm'));
        await execute('git', ['init', '-q'], commandOptions);
        await log(await execute(process.execPath, [cli, 'init-ai', '-p', assistant.provider], commandOptions));

        stage = 'assistant execution';
        const skillPrompt = `Use the CALM skill installed at ${assistant.skillPath}.\n\n${prompt}`;
        await log(await assistant.run(skillPrompt, { cwd, env, timeout: 300_000 }));

        stage = 'CALM validation';
        await log(await execute(process.execPath, [cli, 'validate', '--architecture', filename, '--strict'], commandOptions));

        stage = 'structural assertions';
        await assertArtifact(join(cwd, filename));
    } catch (error) {
        const commandFailed = error && typeof error === 'object' && ('stdout' in error || 'stderr' in error);
        if (commandFailed) {
            await log(error as { stdout?: string; stderr?: string });
            const code = 'code' in error ? error.code : undefined;
            const status = code ?? ('signal' in error ? error.signal : undefined);
            if (stage === 'assistant execution' && code === 'ENOENT') {
                throw new Error(`assistant execution failed: "${assistant.provider}" executable not found on PATH. Artifacts and logs: ${run}`);
            }
            throw new Error(`${stage} failed (command status ${status ?? 'unknown'}). Artifacts and logs: ${run}`);
        }
        const detail = error instanceof Error ? error.message.split('\n')[0] : String(error);
        throw new Error(`${stage} failed: ${detail}. Artifacts and logs: ${run}`, { cause: error });
    }
}
