import type { Vfs } from '../lab/vfs';
import type { Line } from '../shell';

export const CLI_DOCS = 'https://calm.finos.org/working-with-calm/cli';

/** The `validate -f` choices the lab can print; the parser still accepts the CLI's full list. */
export const VALIDATE_LAB_FORMATS: readonly string[] = ['json', 'pretty'];

/** The lab-specific text the `calm` command prints for what only the CLI can do. */
export function unsupportedInLab(command: string, what: string): Line {
    return { text: `The browser lab doesn't support \`${what}\` for \`calm ${command}\` yet. Use the CLI — ${CLI_DOCS}`, kind: 'dim' };
}

/** A reference with a URI scheme (`https:`, `urn:`, `calm:`): the CLI's file loader leaves it to the URL loaders. */
export function isUrl(reference: string): boolean {
    return /^[a-z][a-z0-9+.-]+:/i.test(reference);
}

/** The Node error the CLI's file loader reports when `path` is not a readable file. */
export function readError(vfs: Vfs, path: string): string {
    return vfs.isDir(path) ? 'EISDIR: illegal operation on a directory, read' : `ENOENT: no such file or directory, open '${path}'`;
}
