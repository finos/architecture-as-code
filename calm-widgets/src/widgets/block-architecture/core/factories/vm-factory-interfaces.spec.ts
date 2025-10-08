import { describe, it, expect } from 'vitest';
import * as mod from './vm-factory-interfaces';

describe('vm-factory-interfaces module', () => {
    it('exports something (compile-time interfaces are present for TS)', () => {
        expect(mod).toBeDefined();
    });
});

