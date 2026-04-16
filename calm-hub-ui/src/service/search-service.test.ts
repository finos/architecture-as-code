import { afterEach, describe, expect, it } from 'vitest';
import AxiosMockAdapter from 'axios-mock-adapter';
import { SearchService } from './search-service.js';
import axios from 'axios';

const ax = axios.create();
const mock = new AxiosMockAdapter(ax as never);

describe('SearchService', () => {
    const searchService = new SearchService(ax);

    afterEach(() => {
        mock.reset();
    });

    describe('search', () => {
        it('should return grouped search results', async () => {
            const expectedResults = {
                architectures: [
                    { namespace: 'finos', id: 1, name: 'Test Arch', description: 'desc' },
                ],
                patterns: [],
                flows: [],
                standards: [],
                interfaces: [],
                controls: [],
                adrs: [],
            };

            mock.onGet('/calm/search?q=test').reply(200, expectedResults);
            const actual = await searchService.search('test');
            expect(actual).toEqual(expectedResults);
        });

        it('should encode special characters in query', async () => {
            const expectedResults = {
                architectures: [],
                patterns: [],
                flows: [],
                standards: [],
                interfaces: [],
                controls: [],
                adrs: [],
            };

            mock.onGet('/calm/search?q=hello%20world').reply(200, expectedResults);
            const actual = await searchService.search('hello world');
            expect(actual).toEqual(expectedResults);
        });

        it('should throw an error when backend returns error status', async () => {
            mock.onGet('/calm/search?q=test').reply(500, { message: 'Error' });
            await expect(searchService.search('test')).rejects.toThrowError();
        });

        it('should return results with multiple types populated', async () => {
            const expectedResults = {
                architectures: [
                    { namespace: 'finos', id: 1, name: 'Demo Arch', description: 'demo' },
                ],
                patterns: [
                    { namespace: 'finos', id: 2, name: 'Demo Pattern', description: 'demo' },
                ],
                flows: [],
                standards: [],
                interfaces: [],
                controls: [
                    {
                        namespace: 'api-threats',
                        id: 1,
                        name: 'Demo Control',
                        description: 'demo',
                    },
                ],
                adrs: [],
            };

            mock.onGet('/calm/search?q=demo').reply(200, expectedResults);
            const actual = await searchService.search('demo');
            expect(actual).toEqual(expectedResults);
        });
    });
});
