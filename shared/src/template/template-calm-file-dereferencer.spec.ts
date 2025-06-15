import { TemplateCalmFileDereferencer } from './template-calm-file-dereferencer';
import path from 'path';
import {InMemoryResolver} from '../resolver/calm-reference-resolver';
import {resolve as url_resolve, cwd as url_cwd} from '@apidevtools/json-schema-ref-parser/lib/util/url';


describe('TemplateCalmFileDereferencer', () => {
    let dereferencer: TemplateCalmFileDereferencer;
    let urlFileMapping: Map<string, string>;

    beforeEach(() => {
        urlFileMapping = new Map<string, string>([
            [
                'https://calm.finos.org/traderx/flow/add-update-account',
                path.resolve('data/add-update-account.json')
            ],
            [
                'https://calm.finos.org/traderx/flow/load-list-of-accounts',
                path.resolve('data/load-list-of-accounts.json')
            ]
        ]);

        const mockResolver = new InMemoryResolver({
            [url_resolve(url_cwd(), path.resolve('data/add-update-account.json'))]: { flow: 'Add Update Account Content' },
            [url_resolve(url_cwd(), path.resolve('data/load-list-of-accounts.json'))]: { flow: 'Load List of Accounts Content' }
        });

        dereferencer = new TemplateCalmFileDereferencer(urlFileMapping, mockResolver);
    });

    describe('replaceUrlsWithFilePaths', () => {
        it('should replace URLs with file content', async () => {
            const jsonDoc = `{
                "flows": [
                    "https://calm.finos.org/traderx/flow/add-update-account",
                    "https://calm.finos.org/traderx/flow/load-list-of-accounts"
                ]
            }`;

            const expected = `{
                "flows": [
                    { "flow": "Add Update Account Content" },
                    { "flow": "Load List of Accounts Content" }
                ]
            }`;

            const resolvedJson = await dereferencer.dereferenceCalmDoc(jsonDoc);
            expect(JSON.parse(resolvedJson)).toEqual(JSON.parse(expected));
        });

        it('should not modify non-mapped URLs', async () => {
            const jsonDoc = `{
                "flows": [
                    "https://calm.finos.org/traderx/flow/unknown-url"
                ]
            }`;

            const expected = jsonDoc; // No changes expected

            const resolvedJson = await dereferencer.dereferenceCalmDoc(jsonDoc);
            expect(JSON.parse(resolvedJson)).toEqual(JSON.parse(expected));
        });
    });

    describe('dereferenceCalmDoc', () => {
        it('should replace URLs and inline file contents', async () => {
            const jsonDoc = `{
                "flows": [
                    "https://calm.finos.org/traderx/flow/add-update-account",
                    "https://calm.finos.org/traderx/flow/load-list-of-accounts"
                ]
            }`;

            const expected = `{
                "flows": [
                    { "flow": "Add Update Account Content" },
                    { "flow": "Load List of Accounts Content" }
                ]
            }`;

            const resolvedJson = await dereferencer.dereferenceCalmDoc(jsonDoc);
            expect(JSON.parse(resolvedJson)).toEqual(JSON.parse(expected));
        });

        it('should replace URLs in nested structures', async () => {
            const jsonDoc = `{
                "system": {
                    "flow": "https://calm.finos.org/traderx/flow/add-update-account"
                }
            }`;

            const expected = `{
                "system": {
                    "flow": { "flow": "Add Update Account Content" }
                }
            }`;

            const resolvedJson = await dereferencer.dereferenceCalmDoc(jsonDoc);
            expect(JSON.parse(resolvedJson)).toEqual(JSON.parse(expected));
        });

        it('should not replace URLs that are not in the mapping', async () => {
            const jsonDoc = `{
                "flows": [
                    "https://calm.finos.org/traderx/flow/unknown-url"
                ]
            }`;

            const expected = jsonDoc; // No changes expected

            const resolvedJson = await dereferencer.dereferenceCalmDoc(jsonDoc);
            expect(JSON.parse(resolvedJson)).toEqual(JSON.parse(expected));
        });

        it('should handle empty JSON objects', async () => {
            const resolvedJson = await dereferencer.dereferenceCalmDoc('{}');
            expect(JSON.parse(resolvedJson)).toEqual({});
        });

        it('should handle empty JSON arrays', async () => {
            const resolvedJson = await dereferencer.dereferenceCalmDoc('[]');
            expect(JSON.parse(resolvedJson)).toEqual([]);
        });
    });
});
