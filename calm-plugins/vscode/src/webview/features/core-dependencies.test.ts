import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');

describe('core App feature dependencies', () => {
    it('imports only generic feature infrastructure, not feature implementations', () => {
        expect(appSource).not.toMatch(/from\s+['"]\.\/features\/[^'"]+\/[^'"]+['"]/);
        expect(appSource).not.toMatch(/enabledCanvasFeatures\.has\s*\(/);
    });
});