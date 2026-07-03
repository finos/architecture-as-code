import path from 'path';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import type { ResourceChangeType } from '@finos/calm-shared/src/hub/calm-hub-client';

/**
 * Central, repo-level workspace configuration. Committed at
 * `<gitRoot>/.calm-workspace/config.json` so it applies to every workspace in the repo and is
 * visible to CI.
 */
export interface WorkspaceConfig {
    push: {
        /**
         * How push handles a version that already exists in CalmHub:
         *  - `false` (default): a version that already exists is skipped (idempotent local pushes).
         *  - `true`: a version that already exists but whose on-disk content has *changed* fails the
         *    push (strict merge-time CI). An existing version that is unchanged is still skipped.
         */
        failIfModified: boolean;
    };
    bump: {
        defaultIncrement: ResourceChangeType;
    };
}

export const DEFAULT_WORKSPACE_CONFIG: WorkspaceConfig = {
    push: { failIfModified: false },
    bump: { defaultIncrement: 'MINOR' },
};

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

        const failIfModified = parsed?.push?.failIfModified;
        const defaultIncrement = parsed?.bump?.defaultIncrement;

        return {
            push: {
                failIfModified: typeof failIfModified === 'boolean'
                    ? failIfModified
                    : DEFAULT_WORKSPACE_CONFIG.push.failIfModified,
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
