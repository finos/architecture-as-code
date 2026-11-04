/**
 * Canonical directory names used by CALM Hub GitHub storage mode to classify documents.
 * Kept in sync with `org.finos.calm.store.github.registry.CalmContentDetector`.
 */
export const GITHUB_RESOURCE_DIRECTORIES = [
    'architectures',
    'patterns',
    'standards',
    'flows',
    'interfaces',
    'controls',
    'adrs',
    'timelines',
    'decorators',
] as const;

export type GitHubResourceDirectory = (typeof GITHUB_RESOURCE_DIRECTORIES)[number];

/**
 * Directory aliases accepted by CALM Hub GitHub storage mode.
 * For example, `standard-nodes/` is aliased to `standards/`.
 */
export const GITHUB_DIRECTORY_ALIASES: Readonly<Record<string, GitHubResourceDirectory>> = {
    'standard-nodes': 'standards',
};

/**
 * Check whether a directory name is recognized by CALM Hub GitHub storage mode.
 */
export function isKnownGitHubDirectory(name: string): boolean {
    const lower = name.toLowerCase();
    return (GITHUB_RESOURCE_DIRECTORIES as readonly string[]).includes(lower) || lower in GITHUB_DIRECTORY_ALIASES;
}

/**
 * Resolve an alias or canonical directory name to its canonical CALM Hub GitHub directory.
 */
export function canonicalGitHubDirectory(name: string): GitHubResourceDirectory | undefined {
    const lower = name.toLowerCase();
    if ((GITHUB_RESOURCE_DIRECTORIES as readonly string[]).includes(lower)) {
        return lower as GitHubResourceDirectory;
    }
    return GITHUB_DIRECTORY_ALIASES[lower];
}

/**
 * Detect the CALM Hub GitHub directory segment from a repository-relative file path.
 * Mirrors `CalmContentDetector.getParentDirectoryName`.
 * Returns the first recognized directory segment among ancestors, or the immediate
 * parent directory name, or undefined if the file is in the root directory.
 */
export function detectDirectorySegment(relativePath: string): string | undefined {
    const normalized = relativePath.replace(/\\/g, '/');
    const segments = normalized.split('/').filter((s) => s && s !== '.');
    if (segments.length <= 1) {
        return undefined;
    }
    const dirSegments = segments.slice(0, segments.length - 1);
    for (const segment of dirSegments) {
        const lower = segment.toLowerCase();
        if (isKnownGitHubDirectory(lower)) {
            return lower;
        }
    }
    return dirSegments[dirSegments.length - 1].toLowerCase();
}
