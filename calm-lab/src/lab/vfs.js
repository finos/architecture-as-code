/**
 * Tiny in-memory virtual filesystem for the learning lab.
 * Files are absolute path -> string content; directories are implied
 * by the paths of the files they contain. State is persisted to
 * localStorage so a refresh keeps the learner's work.
 *
 * The lab is a standalone single-page app, so this always runs in a
 * browser; storage access is guarded anyway for private-browsing mode.
 */

const STORAGE_KEY = 'calm-lab-workspace-v1';
const HOME = '/workspace';

function getStorage() {
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            return window.localStorage;
        }
    } catch {
        // Storage disabled (private mode, etc.) — run in-memory only.
    }
    return null;
}

export function resolvePath(cwd, path) {
    const raw = path && path.length ? path : '.';
    const base = raw.startsWith('/') ? [] : (cwd || '/').split('/').filter(Boolean);
    for (const segment of raw.split('/')) {
        if (!segment || segment === '.') {
            continue;
        }
        if (segment === '..') {
            base.pop();
        } else {
            base.push(segment);
        }
    }
    return '/' + base.join('/');
}

export function createVfs(seedFiles) {
    let files = {...seedFiles};
    let cwd = HOME;

    const persist = () => {
        const storage = getStorage();
        if (storage) {
            try {
                storage.setItem(STORAGE_KEY, JSON.stringify({files, cwd}));
            } catch {
                // Quota/security errors are non-fatal; keep working in memory.
            }
        }
    };

    const vfs = {
        seed(nextFiles) {
            files = {...nextFiles};
            cwd = HOME;
            persist();
        },
        read(path) {
            return Object.prototype.hasOwnProperty.call(files, path) ? files[path] : null;
        },
        write(path, content) {
            files[path] = content;
            persist();
        },
        exists(path) {
            return Object.prototype.hasOwnProperty.call(files, path);
        },
        isDir(path) {
            if (path === '/' || path === HOME) {
                return true;
            }
            const prefix = path.endsWith('/') ? path : path + '/';
            return Object.keys(files).some((file) => file.startsWith(prefix));
        },
        list(dir) {
            const prefix = dir === '/' ? '/' : dir + '/';
            const names = new Map();
            for (const file of Object.keys(files)) {
                if (!file.startsWith(prefix)) {
                    continue;
                }
                const rest = file.slice(prefix.length);
                const slash = rest.indexOf('/');
                if (slash === -1) {
                    if (!names.has(rest)) {
                        names.set(rest, false);
                    }
                } else {
                    names.set(rest.slice(0, slash), true);
                }
            }
            return [...names.entries()]
                .map(([name, isDir]) => ({name, isDir}))
                .sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));
        },
        resolve(fromCwd, path) {
            return resolvePath(fromCwd, path);
        },
        getCwd() {
            return cwd;
        },
        setCwd(dir) {
            cwd = dir;
            persist();
        },
        toJSON() {
            return {files: {...files}, cwd};
        },
        fromJSON(data) {
            if (data && data.files) {
                files = {...data.files};
                cwd = data.cwd || HOME;
            }
        },
    };

    const storage = getStorage();
    if (storage) {
        try {
            const raw = storage.getItem(STORAGE_KEY);
            if (raw) {
                vfs.fromJSON(JSON.parse(raw));
            }
        } catch {
            // Corrupt persisted state — fall back to the seed.
        }
    }

    return vfs;
}
