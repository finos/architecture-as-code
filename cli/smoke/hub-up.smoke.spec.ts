import { describe, expect, test } from 'vitest';
import { SMOKE_HUB_URL } from './global-setup';

describe('CalmHub is up', () => {
    test('swagger UI responds', async () => {
        const res = await fetch(`${SMOKE_HUB_URL}/q/swagger-ui`);
        expect(res.status).toBe(200);
    });

    test('namespaces endpoint responds', async () => {
        const res = await fetch(`${SMOKE_HUB_URL}/api/calm/namespaces`);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(Array.isArray(body.values)).toBe(true);
    });
});
