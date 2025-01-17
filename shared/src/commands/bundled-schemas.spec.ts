import { checkCoreSchemaVersion } from './bundled-schemas';

jest.mock('./helper.js', () => {
    return {
        initLogger: () => {
            return {
                info: jest.fn(),
                debug: jest.fn(),
                error: jest.fn(),
                warn: jest.fn()
            };
        }
    };
});

describe('checkCoreSchemaVersion', () => {
    it('Return true for non-core schema URLs', () => {
        expect(checkCoreSchemaVersion('https://not-calm.org/spec.json', '2024-10', false))
            .toBeTruthy();
    });
    
    it('Return true for core schema URLs matching loaded version', () => {
        expect(checkCoreSchemaVersion('https://calm.finos.org/calm/draft/2024-10/meta/core.json', '2024-10', false))
            .toBeTruthy();
    });
    
    it('Return false for core schema URLs that dont match loaded version', () => {
        expect(checkCoreSchemaVersion('https://calm.finos.org/calm/draft/2020-01/meta/core.json', '2024-10', false))
            .toBeFalsy();
    });
});