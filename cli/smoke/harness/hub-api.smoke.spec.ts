import { describe, expect, test } from 'vitest';
import { hubApi } from './hub-api';

describe('hub-api probe', () => {
    test('listNamespaces returns an array of names', async () => {
        const names = await hubApi().listNamespaces();
        expect(Array.isArray(names)).toBe(true);
        // A fresh hub may have zero namespaces; the call must still succeed.
        names.forEach((n) => expect(typeof n).toBe('string'));
    });
});
