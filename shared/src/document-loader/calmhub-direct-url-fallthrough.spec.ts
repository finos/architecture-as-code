import axios from 'axios';
import AxiosMockAdapter from 'axios-mock-adapter';
import { CalmHubDocumentLoader } from './calmhub-document-loader';
import { DirectUrlDocumentLoader } from './direct-url-document-loader';
import { MultiStrategyDocumentLoader } from './multi-strategy-document-loader';

// Regression test for a bug where CalmHubDocumentLoader claimed ownership of *any* http(s)
// reference (not just ones actually hosted on CalmHub), tried to load it from CalmHub, failed
// fatally, and short-circuited MultiStrategyDocumentLoader before DirectUrlDocumentLoader ever got
// a turn — even when the URL's host was allowlisted for direct loading.
describe('CalmHubDocumentLoader + DirectUrlDocumentLoader fall-through', () => {
    const calmHubBaseUrl = 'http://local-calmhub';
    const allowedHost = 'schemas.example.com';

    it('falls through to DirectUrlDocumentLoader for an allowlisted host not hosted on CalmHub', async () => {
        const hubAx = axios.create({ baseURL: calmHubBaseUrl });
        new AxiosMockAdapter(hubAx); // no handlers registered: any request 404s

        const directAx = axios.create({});
        const directMock = new AxiosMockAdapter(directAx);
        const externalUrl = `https://${allowedHost}/core.json`;
        directMock.onGet('/core.json').reply(200, { '$id': externalUrl, 'title': 'schema' });

        const calmHubLoader = new CalmHubDocumentLoader(calmHubBaseUrl, false, undefined, hubAx);
        const directLoader = new DirectUrlDocumentLoader(false, directAx, [allowedHost]);
        const multi = new MultiStrategyDocumentLoader([calmHubLoader, directLoader]);

        const document = await multi.loadMissingDocument(externalUrl, 'schema');

        expect(document).toEqual({ '$id': externalUrl, 'title': 'schema' });
    });

    it('still surfaces a fatal error when the URL host is not allowlisted anywhere', async () => {
        const hubAx = axios.create({ baseURL: calmHubBaseUrl });
        new AxiosMockAdapter(hubAx);

        const directAx = axios.create({});
        new AxiosMockAdapter(directAx);

        const calmHubLoader = new CalmHubDocumentLoader(calmHubBaseUrl, false, undefined, hubAx);
        const directLoader = new DirectUrlDocumentLoader(false, directAx, [allowedHost]);
        const multi = new MultiStrategyDocumentLoader([calmHubLoader, directLoader]);

        await expect(multi.loadMissingDocument('https://not-allowed.example.com/core.json', 'schema'))
            .rejects.toThrow('is not allowlisted');
    });
});
