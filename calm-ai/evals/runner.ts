import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const sandbox = fileURLToPath(new URL('../../sandbox/calm-ai-evals/', import.meta.url));
const cli = fileURLToPath(new URL('../../cli/dist/index.js', import.meta.url));

interface RunOptions {
    cwd: string;
    env: NodeJS.ProcessEnv;
    timeout: number;
}

interface Assistant {
    provider: string;
    run(prompt: string, options: RunOptions): Promise<{ stdout: string; stderr: string }>;
}

export const codex: Assistant = {
    provider: 'codex',
    run(prompt, options) {
        const model = process.env.CALM_EVAL_MODEL;
        const execution = execute('codex', [
            '--ask-for-approval', 'never', 'exec', '--sandbox', 'workspace-write',
            '--ignore-user-config', '--ephemeral', '--json',
            ...(model ? ['--model', model] : []),
            '--', prompt,
        ], { ...options, maxBuffer: 16 * 1024 * 1024 });
        execution.child.stdin?.end();
        return execution;
    },
};

export async function runEval(
    assistant: Assistant,
    prompt: string,
    filename: string,
    assertArtifact: (path: string) => Promise<void>,
): Promise<void> {
    await mkdir(sandbox, { recursive: true });
    const run = await mkdtemp(join(sandbox, `${assistant.provider}-`));
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
        await log(await assistant.run(prompt, { cwd, env, timeout: 300_000 }));

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
            throw new Error(`${stage} failed (command status ${status ?? 'unknown'}). Artifacts and logs: ${run}`);
        }
        const detail = error instanceof Error ? error.message.split('\n')[0] : String(error);
        throw new Error(`${stage} failed: ${detail}. Artifacts and logs: ${run}`, { cause: error });
    }

    await rm(run, { recursive: true, force: true });
}
