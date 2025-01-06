import { checkCoreSchemaVersion } from "./bundled-schemas";

jest.mock('./helper.js', () => {
    return {
        initLogger: () => {
            return {
                info: jest.fn(),
                debug: jest.fn(),
                error: jest.fn()
            };
        }
    };
});

describe('checkCoreSchemaVersion', () => {
    it('Return false for non-core schema URLs', () => {
        expect(checkCoreSchemaVersion('https://not-calm.org/spec.json', '2024-10', false))
            .toBeFalsy();
    })
    
    it('Return false for matching core schema URLs', () => {
        expect(checkCoreSchemaVersion('https://calm.finos.org/calm/draft/2024-10/core.json', '2024-10', false))
            .toBeFalsy();
    })
    
    it('Return true for non-matching core schema URLs', () => {
        expect(checkCoreSchemaVersion('https://calm.finos.org/calm/draft/2020-01/core.json', '2024-10', false))
            .toBeTruthy();
    })
})