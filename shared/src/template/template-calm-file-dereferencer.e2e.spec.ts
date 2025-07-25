import { TemplateCalmFileDereferencer } from './template-calm-file-dereferencer';
import fs from 'fs';
import path from 'path';
import { CompositeReferenceResolver } from '../resolver/calm-reference-resolver';

describe('End-to-End Dereferencing Test with Per-Test Mapping', () => {
    const basePath = path.resolve(
        __dirname,
        '../../test_fixtures/samples/2024-12/'
    );
    let traderxJson: string;

    beforeAll(() => {
        traderxJson = fs.readFileSync(
            path.join(basePath, 'traderx.json'),
            'utf-8'
        );
    });

    it('fully dereferences when all flows are mapped', async () => {
        const urlFileMapping = new Map<string, string>([
            [
                'https://calm.finos.org/traderx/flow/add-update-account',
                path.join(
                    basePath,
                    'flows/add-update-account/add-update-account.json'
                ),
            ],
            [
                'https://calm.finos.org/traderx/flow/load-list-of-accounts',
                path.join(
                    basePath,
                    'flows/load-list-of-accounts/load-list-of-accounts.json'
                ),
            ],
            [
                'https://calm.finos.org/traderx/flow/load-positions',
                path.join(basePath, 'flows/load-positions/load-positions.json'),
            ],
            [
                'https://calm.finos.org/traderx/flow/submit-trade-ticket/submit-trade-ticket',
                path.join(
                    basePath,
                    'flows/submit-trade-ticket/submit-trade-ticket.json'
                ),
            ],
            [
                'https://calm.finos.org/traderx/flow/new-trade',
                path.join(
                    basePath,
                    'flows/trade-processing/trade-processing-new-trade.json'
                ),
            ],
            [
                'https://calm.finos.org/traderx/flow/update-trade',
                path.join(
                    basePath,
                    'flows/trade-processing/trade-processing-update-trade.json'
                ),
            ],
        ]);
        const dereferencer = new TemplateCalmFileDereferencer(
            urlFileMapping,
            new CompositeReferenceResolver()
        );

        const resolved = await dereferencer.dereferenceCalmDoc(traderxJson);
        const parsed = JSON.parse(resolved);

        expect(Array.isArray(parsed.flows)).toBe(true);
        expect(parsed.flows).toHaveLength(6);
        parsed.flows.forEach((flow: object) => {
            expect(flow).toHaveProperty('unique-id');
        });
    });

    it('dereferences only the mapped flows and leaves others untouched', async () => {
        const urlFileMapping = new Map<string, string>([
            [
                'https://calm.finos.org/traderx/flow/add-update-account',
                path.join(
                    basePath,
                    'flows/add-update-account/add-update-account.json'
                ),
            ],
            [
                'https://calm.finos.org/traderx/flow/load-list-of-accounts',
                path.join(
                    basePath,
                    'flows/load-list-of-accounts/load-list-of-accounts.json'
                ),
            ],
            // deliberately omit the 'load-positions' mapping
        ]);
        const dereferencer = new TemplateCalmFileDereferencer(
            urlFileMapping,
            new CompositeReferenceResolver()
        );

        const resolved = await dereferencer.dereferenceCalmDoc(traderxJson);
        const parsed = JSON.parse(resolved);

        expect(Array.isArray(parsed.flows)).toBe(true);
        // two flows mapped → two objects
        const inlined = parsed.flows.filter(
            (f: object) => typeof f === 'object' && f['unique-id']
        );
        expect(inlined).toHaveLength(2);

        // unmapped flows remain as plain URLs
        const unmappedUrls = [
            'https://calm.finos.org/traderx/flow/load-positions',
            'https://calm.finos.org/traderx/flow/submit-trade-ticket/submit-trade-ticket',
            'https://calm.finos.org/traderx/flow/new-trade',
            'https://calm.finos.org/traderx/flow/update-trade',
        ];
        unmappedUrls.forEach((u) => {
            expect(parsed.flows).toContain(u);
        });
    });
});
