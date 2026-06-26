import path from 'path';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import type { ResourceChangeType } from '@finos/calm-shared/src/hub/calm-hub-client';

/**
 * What push should do when the version it is about to create already exists in CalmHub.
 *  - `skip`: log and move on (idempotent; good for local dev and re-runnable pushes)
 *  - `fail`: treat it as an error and fail the push (strict; good for merge-time CI)
 */
export type OnExisting = 'skip' | 'fail';

/**
 * Central, repo-level workspace configuration. Committed at
 * `<gitRoot>/.calm-workspace/config.json` so it applies to every workspace in the repo and is
 * visible to CI.
 */
export interface WorkspaceConfig {
    push: {
        onExisting: OnExisting;
    };
    bump: {
        defaultIncrement: ResourceChangeType;
    };
}

export const DEFAULT_WORKSPACE_CONFIG: WorkspaceConfig = {
    push: { onExisting: 'skip' },
    bump: { defaultIncrement: 'MINOR' },
};

const VALID_ON_EXISTING: OnExisting[] = ['skip', 'fail'];
const VALID_INCREMENTS: ResourceChangeType[] = ['MAJOR', 'MINOR', 'PATCH'];

/**
 * Absolute path to the central workspace config file for the given git root.
 */
export function getWorkspaceConfigPath(gitRoot: string): string {
    return path.join(gitRoot, '.calm-workspace', 'config.json');
}

/**
 * Load the central workspace config, falling back to defaults for a missing file, invalid JSON,
 * or any individual field that is absent or invalid. Never throws — an unreadable config should
 * not break commands; it just behaves as the default.
 *
 * @param gitRoot Absolute path to the repository root containing `.calm-workspace`.
 */
export async function loadWorkspaceConfig(gitRoot: string): Promise<WorkspaceConfig> {
    const configPath = getWorkspaceConfigPath(gitRoot);
    if (!existsSync(configPath)) {
        return DEFAULT_WORKSPACE_CONFIG;
    }
    try {
        const raw = await readFile(configPath, 'utf8');
        const parsed = JSON.parse(raw) as Partial<WorkspaceConfig>;

        const onExisting = parsed?.push?.onExisting;
        const defaultIncrement = parsed?.bump?.defaultIncrement;

        return {
            push: {
                onExisting: VALID_ON_EXISTING.includes(onExisting as OnExisting)
                    ? (onExisting as OnExisting)
                    : DEFAULT_WORKSPACE_CONFIG.push.onExisting,
            },
            bump: {
                defaultIncrement: VALID_INCREMENTS.includes(defaultIncrement as ResourceChangeType)
                    ? (defaultIncrement as ResourceChangeType)
                    : DEFAULT_WORKSPACE_CONFIG.bump.defaultIncrement,
            },
        };
    } catch {
        return DEFAULT_WORKSPACE_CONFIG;
    }
}
