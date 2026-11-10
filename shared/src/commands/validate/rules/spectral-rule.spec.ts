import * as fs from 'fs';
import os from 'os';
import path from 'path';
import validationRulesForArchitecture from '../../../spectral/rules-architecture';
import { SpectralValidationRule } from './spectral-rule';
import { ValidationContext } from '../validation-rule';
import { SchemaDirectory } from '../../../schema-directory';
import { ValidationEngine } from '../validation-engine';
import { CachingTrackingResolver } from '../../../resolver/caching-tracking-resolver';
import { FileSystemDocumentLoader } from '../../../document-loader/file-system-document-loader';
import { DocumentLoader } from '../../../document-loader/document-loader';
import { DirectUrlDocumentLoader } from '../../../document-loader/direct-url-document-loader';
import { Axios } from 'axios';

const architectureRule = new SpectralValidationRule(
    'spectral-architecture', 'architecture', validationRulesForArchitecture, 'architecture',
    c => JSON.stringify(c.architecture),
    () => true
);

function run(architecture: object, schemaDirectory: SchemaDirectory) {
    const context: ValidationContext = {
        mode: 'architecture-only',
        architecture,
        schemaDirectory,
        references: new CachingTrackingResolver({ canResolve: () => false, resolve: () => Promise.reject(new Error('unused')) }),
        debug: false,
        engine: undefined as unknown as ValidationEngine,
    };
    return architectureRule.run(context);
}

describe('SpectralValidationRule $ref resolution', () => {
    let secret: string;

    beforeEach(() => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spectral-ref-'));
        secret = path.join(dir, 'secret.json');
        fs.writeFileSync(secret, JSON.stringify({ nodes: [{ 'unique-id': 'SECRET-NODE', 'node-type': 'service', name: 's', description: 's' }] }));
    });

    const architectureWithRef = (ref: string) => ({ nodes: [{ $ref: ref }], relationships: [] });

    it('reads a referenced local file through the document loader', async () => {
        const directory = new SchemaDirectory(new FileSystemDocumentLoader([], false));

        const result = await run(architectureWithRef(`${secret}#/nodes/0`), directory);

        expect(JSON.stringify(result.spectralOutputs)).toContain('SECRET-NODE');
    });

    it('reads no local file when the document loader does not read referenced files', async () => {
        const directory = new SchemaDirectory(new FileSystemDocumentLoader([], false, undefined, false));

        const result = await run(architectureWithRef(`${secret}#/nodes/0`), directory);

        expect(JSON.stringify(result.spectralOutputs)).not.toContain('SECRET');
    });

    it('fetches a remote $ref through the document loader, not by itself', async () => {
        const loader: DocumentLoader = {
            initialise: async () => {},
            loadMissingDocument: vi.fn(async () => ({ nodes: [{ 'unique-id': 'REMOTE-NODE', 'node-type': 'service', name: 'r', description: 'r' }] })),
        };

        const result = await run(architectureWithRef('https://calm.example.com/remote.json#/nodes/0'), new SchemaDirectory(loader));

        expect(loader.loadMissingDocument).toHaveBeenCalledWith('https://calm.example.com/remote.json', expect.anything());
        expect(JSON.stringify(result.spectralOutputs)).toContain('REMOTE-NODE');
    });

    it('refuses a remote $ref on a host outside the allowlist, without a request', async () => {
        const http = { get: vi.fn() } as unknown as Axios;
        const directory = new SchemaDirectory(new DirectUrlDocumentLoader(false, http, ['calm.finos.org']));

        const result = await run(architectureWithRef('https://example.com/remote.json#/nodes/0'), directory);

        expect(http.get).not.toHaveBeenCalled();
        expect(JSON.stringify(result.spectralOutputs)).toContain('not allowlisted');
    });
});
