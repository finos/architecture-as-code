import { afterEach, describe, expect, it } from 'vitest';
import AxiosMockAdapter from 'axios-mock-adapter';
import { AdrService } from './adr-service.js';
import axios from 'axios';
import fs from 'fs';

const ax = axios.create();
const mock = new AxiosMockAdapter(ax as never);

const namespace = 'test-namespace';
const adrId = '1';
const revision = '1';
const expectedAdr = JSON.parse(fs.readFileSync('./src/fixtures/adr.json', 'utf8'));

const errorStatusCodes = [400, 401, 403, 404, 500];

describe('Adr Service ', () => {
    const adrService = new AdrService(ax);

    afterEach(() => {
        mock.reset();
    });

    it('should retrieve all the ADR summaries for a given namespace', async () => {
        const expectedAdrSummaries = [{ id: 1, title: 'Use CALM', status: 'accepted' }, { id: 2, title: 'Use React', status: 'proposed' }];
        mock.onGet(`/calm/namespaces/${namespace}/adrs`).reply(200, {
            values: expectedAdrSummaries,
        });
        const actualAdrSummaries = await adrService.fetchAdrSummaries(namespace);
        expect(actualAdrSummaries).toEqual(expectedAdrSummaries);
    });

    it.each(errorStatusCodes)(
        'should throw an error when backend service returns an unsuccessful status code while retrieving all the ADR summaries',
        async (errorStatusCode) => {
            const errorMessage = `
        {
            "message": "An Error Occurred",
        }`;
            mock.onGet(`/calm/namespaces/${namespace}/adrs`).reply(errorStatusCode, errorMessage);
            expect(async () => await adrService.fetchAdrSummaries(namespace)).rejects.toThrowError();
        }
    );

    it('should retrieve all the revisions for an ADR in a given namespace', async () => {
        const expectedRevisions = [1, 2];
        mock.onGet(`/calm/namespaces/${namespace}/adrs/${adrId}/revisions`).reply(200, {
            values: expectedRevisions,
        });
        const actualRevisions = await adrService.fetchAdrRevisions(namespace, adrId);
        expect(actualRevisions).toEqual(expectedRevisions);
    });

    it.each(errorStatusCodes)(
        'should throw an error when backend service returns an unsuccessful status code while retrieving all the revisions for an ADR',
        async (errorStatusCode) => {
            const errorMessage = `
        {
            "message": "An Error Occurred",
        }`;
            mock.onGet(`/calm/namespaces/${namespace}/adrs`).reply(errorStatusCode, errorMessage);
            expect(
                async () => await adrService.fetchAdrRevisions(namespace, adrId)
            ).rejects.toThrowError();
        }
    );

    it('should retrieve an adr revision', async () => {
        mock.onGet(`/calm/namespaces/${namespace}/adrs/${adrId}/revisions/${revision}`).reply(
            200,
            expectedAdr
        );
        const actualAdr = await adrService.fetchAdr(namespace, adrId, revision);
        expect(actualAdr).toEqual(expectedAdr);
    });

    it.each(errorStatusCodes)(
        'should throw an error when backend service returns an unsuccessful status code while retrieving a specific revision of an ADR',
        async (errorStatusCode) => {
            const errorMessage = `
        {
            "message": "An Error Occurred",
        }`;
            mock.onGet(`/calm/namespaces/${namespace}/adrs/${adrId}/revisions/${revision}`).reply(
                errorStatusCode,
                errorMessage
            );
            expect(
                async () => await adrService.fetchAdr(namespace, adrId, revision)
            ).rejects.toThrowError();
        }
    );
});
