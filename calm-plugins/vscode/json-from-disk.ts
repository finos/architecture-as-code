import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const VIRTUAL_PREFIX = '\0json-from-disk:';

/**
 * Load JSON from disk, following Git symlink pointers.
 *
 * Schema files under `src/core/schemas/` are git mode-120000 symlinks.
 * On Windows without `core.symlinks=true` they check out as text files
 * containing the relative target path. Vite's JSON plugin then fails to
 * parse them. This plugin intercepts those pointer files as a virtual
 * module (so the builtin JSON plugin does not re-parse the result) and
 * inlines the real JSON.
 */
export function jsonFromDisk(): Plugin {
    return {
        name: 'json-from-disk',
        enforce: 'pre',
        async resolveId(source, importer, options) {
            if (!source.includes('.json')) return;
            const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
            if (!resolved) return;
            const filePath = toFsPath(resolved.id.split('?')[0]);
            if (!filePath.endsWith('.json') || filePath.includes('node_modules')) {
                return;
            }
            try {
                const peek = readFileSync(filePath, 'utf8').trim();
                if (!peek.startsWith('{') && !peek.startsWith('[')) {
                    return VIRTUAL_PREFIX + filePath.replace(/\.json$/i, '');
                }
            } catch {
                return;
            }
        },
        load(id) {
            if (!id.startsWith(VIRTUAL_PREFIX)) return;
            const filePath = id.slice(VIRTUAL_PREFIX.length) + '.json';
            let source = readFileSync(filePath, 'utf8').trim();
            if (!source.startsWith('{') && !source.startsWith('[')) {
                source = readFileSync(resolve(dirname(filePath), source), 'utf8');
            }
            JSON.parse(source);
            return { code: `export default ${source}`, map: null };
        },
    };
}

function toFsPath(id: string): string {
    if (id.startsWith('file:')) {
        return fileURLToPath(id);
    }
    return id;
}
