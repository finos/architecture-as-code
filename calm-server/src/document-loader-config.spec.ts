import { parseDocumentLoaderConfig } from './document-loader-config';

describe('parseDocumentLoaderConfig', () => {
    it('never lets the loader read a file that a request references', () => {
        expect(parseDocumentLoaderConfig({}).readReferencedFiles).toBe(false);
    });

    it('takes the allowed remote hosts from the option, as a list', () => {
        expect(parseDocumentLoaderConfig({ allowedRemoteHosts: 'a.example, b.example' }).allowedRemoteHosts)
            .toEqual(['a.example', 'b.example']);
    });
});
