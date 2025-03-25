import {
    TemplateCalmFileDereferencer
} from './template-calm-file-dereferencer';
import fs from 'fs';
import path from 'path';
import {CompositeReferenceResolver} from '../resolver/calm-reference-resolver';


describe('End-to-End Dereferencing Test', () => {
    let dereferencer: TemplateCalmFileDereferencer;
    let urlFileMapping: Map<string, string>;
    let basePath: string;

    beforeEach(() => {
        basePath = path.resolve(__dirname, '../../../calm/samples/2024-12/traderx'); // Root folder for JSON files

        urlFileMapping = new Map<string, string>([
            ['https://calm.finos.org/traderx/flow/add-update-account', path.join(basePath, 'flows/add-update-account/add-update-account.json')],
            ['https://calm.finos.org/traderx/flow/load-list-of-accounts', path.join(basePath, 'flows/load-list-of-accounts/load-list-of-accounts.json')],
            ['https://calm.finos.org/traderx/flow/load-positions', path.join(basePath, 'flows/load-positions/load-positions.json')],
            ['https://calm.finos.org/traderx/flow/submit-trade-ticket/submit-trade-ticket', path.join(basePath, 'flows/submit-trade-ticket/submit-trade-ticket.json')],
            ['https://calm.finos.org/traderx/flow/new-trade', path.join(basePath, 'flows/trade-processing/trade-processing-new-trade.json')],
            ['https://calm.finos.org/traderx/flow/update-trade', path.join(basePath, 'flows/trade-processing/trade-processing-update-trade.json')]
        ]);

        dereferencer = new TemplateCalmFileDereferencer(urlFileMapping, new CompositeReferenceResolver());
    });

    it('should fully dereference the traderx.json document', async () => {

        const traderxJsonPath = path.join(basePath, 'traderx.json');
        const traderxJson = fs.readFileSync(traderxJsonPath, 'utf-8');

        const resolvedJson = await dereferencer.dereferenceCalmDoc(traderxJson);

        const parsed = JSON.parse(resolvedJson);

        expect(parsed.flows).toBeInstanceOf(Array);
        expect(parsed.flows).toHaveLength(6);

        parsed.flows.forEach(flow => {
            expect(typeof flow).toBe('object');
            expect(flow).toHaveProperty('unique-id');
        });
    });
});
