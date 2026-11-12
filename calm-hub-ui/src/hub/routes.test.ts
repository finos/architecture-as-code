import { describe, expect, it } from 'vitest';
import { matchPath } from 'react-router-dom';
import { RESOURCE_ROUTE, resourcePath } from './routes.js';

describe('resourcePath', () => {
    it('encodes each part, so a value cannot add a path segment', () => {
        expect(resourcePath({ namespace: 'a b', type: 'architectures', id: 'x/y', version: '1.0.0' })).toBe(
            '/a%20b/architectures/x%2Fy/1.0.0'
        );
    });

    it('gives a path that the resource route matches', () => {
        const params = { namespace: 'finos', type: 'patterns', id: 'p', version: '2.0.0' };
        expect(matchPath(RESOURCE_ROUTE, resourcePath(params))?.params).toEqual(params);
    });
});
