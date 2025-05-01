import { loadPatternFromCalmHub } from "./calmhub-input";
import { CalmHubDocumentLoader } from "@finos/calm-shared/dist/document-loader/calmhub-document-loader";

const mocks = vi.hoisted(() => ({
    calmHubDocLoader: {
        initialise: vi.fn(),
        loadMissingDocument: vi.fn()
    }
}));

describe('calmhub-input', () => {
    it('loads a pattern from CalmHub', async () => {
        const patternId = 'https://example.com/pattern.json';
        const debug = true;

        const pattern = { '$id': patternId, 'type': 'object' };
        mocks.calmHubDocLoader.loadMissingDocument.mockResolvedValue(pattern);

        const result = await loadPatternFromCalmHub(patternId, mocks.calmHubDocLoader, debug);

        expect(result).toEqual(pattern);
    });

    it('throws error when docloader fails to load pattern', async () => {
        const patternId = 'https://example.com/pattern.json';
        const debug = true;

        mocks.calmHubDocLoader.loadMissingDocument.mockRejectedValue({
            response: { status: 404 },
            message: 'Not Found'
        });

        await expect(loadPatternFromCalmHub(patternId, mocks.calmHubDocLoader, debug)).rejects.toThrow();
    })
})