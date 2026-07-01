import { SchemaDirectory } from '../schema-directory';
import { fs, vol } from 'memfs';
import { WorkspaceDocumentLoader, stripVersionSuffix } from './workspace-document-loader';
import { DocumentLoadError } from './document-loader';

vi.mock('fs/promises', async () => {
    const memfs: { fs: typeof fs } = await vi.importActual('memfs');
    return memfs.fs.promises;
});

vi.mock('fs', async () => {
    const memfs: { fs: typeof fs } = await vi.importActual('memfs');
    return memfs.fs;
});

const mocks = vi.hoisted(() => {
    return {
        schemaDirectory: {
            storeDocument: vi.fn()
        },
    };
});

const BUNDLE = '/ws';
const PATTERN_ID = 'https://hub.example.com/calm/namespaces/ws/patterns/workshop/versions/1.0.0';
const patternDoc = { '$id': PATTERN_ID, title: 'Workshop Pattern' };
// A document whose $id is a host-less CalmHub path, so a full URL can match it by path.
const STANDARD_ID = '/calm/namespaces/ws/standards/security/versions/1.0.0';
const standardDoc = { '$id': STANDARD_ID, title: 'Security Standard' };
const noIdDoc = { title: 'No Id Document' };

function setupBundle(extra: Record<string, string> = {}) {
    vol.fromJSON({
        '/ws/workspace-manifest.json': JSON.stringify({
            'workshop-pattern': { path: 'files/workshop-pattern.json', type: 'pattern' },
            'security-standard': { path: 'files/security-standard.json', type: 'standard' },
            'no-id-doc': { path: 'files/no-id.json', type: 'architecture' },
        }),
        '/ws/files/workshop-pattern.json': JSON.stringify(patternDoc),
        '/ws/files/security-standard.json': JSON.stringify(standardDoc),
        '/ws/files/no-id.json': JSON.stringify(noIdDoc),
        ...extra,
    });
}

describe('WorkspaceDocumentLoader', () => {
    beforeEach(() => {
        vol.reset();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vol.reset();
    });

    describe('resolvePath', () => {
        beforeEach(() => setupBundle());

        it('resolves a reference by its bare manifest id', () => {
            const loader = new WorkspaceDocumentLoader(BUNDLE);
            expect(loader.resolvePath('workshop-pattern')).toBe('/ws/files/workshop-pattern.json');
        });

        it('resolves a reference by its exact $id', () => {
            const loader = new WorkspaceDocumentLoader(BUNDLE);
            expect(loader.resolvePath(PATTERN_ID)).toBe('/ws/files/workshop-pattern.json');
        });

        it('resolves a reference at a different version of the same $id', () => {
            const loader = new WorkspaceDocumentLoader(BUNDLE);
            const otherVersion = 'https://hub.example.com/calm/namespaces/ws/patterns/workshop/versions/9.9.9';
            expect(loader.resolvePath(otherVersion)).toBe('/ws/files/workshop-pattern.json');
        });

        it('does not resolve a full URL to a host-less $id (cross-host false positive)', () => {
            // A host-less $id should not match a ref from an arbitrary host — the ref may
            // point to a completely different service on the same CalmHub path.
            const loader = new WorkspaceDocumentLoader(BUNDLE);
            const url = 'https://any-host.example.com/calm/namespaces/ws/standards/security/versions/3.0.0';
            expect(loader.resolvePath(url)).toBeUndefined();
        });

        it('resolves a full URL to a full-URL $id when origins match', () => {
            const loader = new WorkspaceDocumentLoader(BUNDLE);
            // Same host as PATTERN_ID (hub.example.com), different version
            const otherVersion = 'https://hub.example.com/calm/namespaces/ws/patterns/workshop/versions/2.0.0';
            expect(loader.resolvePath(otherVersion)).toBe('/ws/files/workshop-pattern.json');
        });

        it('does not resolve a full URL to a full-URL $id when origins differ', () => {
            const loader = new WorkspaceDocumentLoader(BUNDLE);
            const differentHost = 'https://other.example.com/calm/namespaces/ws/patterns/workshop/versions/1.0.0';
            expect(loader.resolvePath(differentHost)).toBeUndefined();
        });

        it('resolves an unversioned path ref that equals the $id base path', () => {
            // A $ref with no /versions/<v> segment should still resolve locally.
            const loader = new WorkspaceDocumentLoader(BUNDLE);
            const unversioned = '/calm/namespaces/ws/standards/security';
            expect(loader.resolvePath(unversioned)).toBe('/ws/files/security-standard.json');
        });

        it('ignores a #/... fragment when matching', () => {
            const loader = new WorkspaceDocumentLoader(BUNDLE);
            expect(loader.resolvePath('workshop-pattern#/nodes/0')).toBe('/ws/files/workshop-pattern.json');
        });

        it('resolves a document without an $id by bare id only', () => {
            const loader = new WorkspaceDocumentLoader(BUNDLE);
            expect(loader.resolvePath('no-id-doc')).toBe('/ws/files/no-id.json');
        });

        it('returns undefined for an untracked reference', () => {
            const loader = new WorkspaceDocumentLoader(BUNDLE);
            expect(loader.resolvePath('https://hub.example.com/calm/namespaces/other/patterns/x/versions/1.0.0')).toBeUndefined();
        });
    });

    describe('loadMissingDocument', () => {
        beforeEach(() => setupBundle());

        it('returns the local document when a reference matches by $id', async () => {
            const loader = new WorkspaceDocumentLoader(BUNDLE);
            await expect(loader.loadMissingDocument(PATTERN_ID, 'pattern')).resolves.toEqual(patternDoc);
        });

        it('throws a recoverable error for an untracked reference so other loaders try', async () => {
            const loader = new WorkspaceDocumentLoader(BUNDLE);
            let thrown: unknown;
            try {
                await loader.loadMissingDocument('https://hub.example.com/calm/namespaces/other/x/versions/1.0.0', 'pattern');
            } catch (err) {
                thrown = err;
            }
            expect(thrown).toBeInstanceOf(DocumentLoadError);
            expect((thrown as DocumentLoadError).recoverable).toBe(true);
        });

        it('throws a fatal error when a matched document file is missing', async () => {
            const loader = new WorkspaceDocumentLoader(BUNDLE);
            vol.unlinkSync('/ws/files/workshop-pattern.json');
            let thrown: unknown;
            try {
                await loader.loadMissingDocument('workshop-pattern', 'pattern');
            } catch (err) {
                thrown = err;
            }
            expect(thrown).toBeInstanceOf(DocumentLoadError);
            expect((thrown as DocumentLoadError).recoverable).toBe(false);
        });
    });

    describe('initialise', () => {
        it('pre-loads each tracked document by both $id and bare id', async () => {
            setupBundle();
            const loader = new WorkspaceDocumentLoader(BUNDLE);
            await loader.initialise(mocks.schemaDirectory as unknown as SchemaDirectory);

            expect(mocks.schemaDirectory.storeDocument).toHaveBeenCalledWith(PATTERN_ID, 'schema', patternDoc);
            expect(mocks.schemaDirectory.storeDocument).toHaveBeenCalledWith('workshop-pattern', 'schema', patternDoc);
            // Document without an $id is stored only by its bare id.
            expect(mocks.schemaDirectory.storeDocument).toHaveBeenCalledWith('no-id-doc', 'schema', noIdDoc);
        });
    });

    describe('with no usable manifest', () => {
        it('resolves nothing when the manifest is absent', () => {
            const loader = new WorkspaceDocumentLoader(BUNDLE);
            expect(loader.resolvePath('workshop-pattern')).toBeUndefined();
        });

        it('falls through (recoverable) for every reference when there is no manifest', async () => {
            const loader = new WorkspaceDocumentLoader(BUNDLE);
            let thrown: unknown;
            try {
                await loader.loadMissingDocument('workshop-pattern', 'pattern');
            } catch (err) {
                thrown = err;
            }
            expect(thrown).toBeInstanceOf(DocumentLoadError);
            expect((thrown as DocumentLoadError).recoverable).toBe(true);
        });
    });
});

describe('stripVersionSuffix', () => {
    it('strips a trailing /versions/<version> segment', () => {
        expect(stripVersionSuffix('https://h/calm/namespaces/ws/patterns/p/versions/1.0.0')).toBe('https://h/calm/namespaces/ws/patterns/p');
    });

    it('returns null when there is no version segment', () => {
        expect(stripVersionSuffix('https://h/calm/namespaces/ws/patterns/p')).toBeNull();
    });
});
