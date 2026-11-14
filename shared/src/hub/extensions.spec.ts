import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { buildExtensionRequest, extensionProxyPath, HubExtensionRoute, numberText } from './extensions';

// One list for the clients and Hub: TestExtensionToolsShould checks it against ExtensionPaths.
const PATH_VALUES: {
    refused: string[],
    accepted: string[],
    lookAlikes: string[],
    encoded: { value: string, path: string, query: string }[],
    otherRoute: { routes: HubExtensionRoute[], route: string, refused: string[], accepted: string[] },
} = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../calm-hub/src/test/resources/extensions-test/path-values.json'), 'utf-8'));
const REFUSED_PATH_VALUES = [...PATH_VALUES.refused, ...PATH_VALUES.lookAlikes.map(c => `a${c}b`)];
const PATH_RULE = 'must not be empty or ., or contain .., /, \\, %, @, a look-alike of /, \\, ., %, @ or ;, '
    + 'a control character or a lone surrogate';

const route = (method: string, path: string): HubExtensionRoute => ({ id: 'r', method, path, scope: 'read' });

describe('extensionProxyPath', () => {
    it('puts the route path under the proxy prefix of the extension', () => {
        expect(extensionProxyPath('example-services', '/search')).toBe('/api/calm/extensions/example-services/api/search');
    });

    it('encodes the extension id', () => {
        expect(extensionProxyPath('a/b', '/x')).toBe('/api/calm/extensions/a%2Fb/api/x');
    });
});

describe('buildExtensionRequest', () => {
    it('fills path parameters and sends the rest as the query for GET', () => {
        const request = buildExtensionRequest('ext', route('GET', '/namespaces/{namespace}/services'), {
            namespace: 'finos', limit: 10, tags: ['a', 'b'], filter: { kind: 'svc' }, skipped: undefined,
        });

        expect(request).toEqual({
            method: 'GET',
            path: '/api/calm/extensions/ext/api/namespaces/finos/services',
            query: [['limit', '10'], ['tags', 'a'], ['tags', 'b'], ['filter', '{"kind":"svc"}']],
        });
    });

    it('sends the rest as the query for DELETE', () => {
        const request = buildExtensionRequest('ext', route('delete', '/items/{id}'), { id: 7, force: true });

        expect(request).toEqual({ method: 'DELETE', path: '/api/calm/extensions/ext/api/items/7', query: [['force', 'true']] });
    });

    it('sends the rest as the JSON body for other methods', () => {
        const request = buildExtensionRequest('ext', route('POST', '/namespaces/{namespace}/services'), {
            namespace: 'finos', name: 'payments', tags: ['a'],
        });

        expect(request).toEqual({
            method: 'POST',
            path: '/api/calm/extensions/ext/api/namespaces/finos/services',
            query: [],
            body: { name: 'payments', tags: ['a'] },
        });
    });

    it('sends an empty body when every property fills the path', () => {
        const request = buildExtensionRequest('ext', route('PUT', '/items/{id}'), { id: 'x' });

        expect(request.body).toEqual({});
    });

    it('encodes path parameter values', () => {
        const request = buildExtensionRequest('ext', route('GET', '/namespaces/{namespace}'), { namespace: '.admin?x=1 é' });

        expect(request.path).toBe('/api/calm/extensions/ext/api/namespaces/.admin%3Fx%3D1%20%C3%A9');
    });

    // Some JSON parsers refuse a lone surrogate, so the shared list has none.
    it.each([...REFUSED_PATH_VALUES, '\ud800', 'a\udc00b'])('fails when a path parameter has a part that Hub refuses: %j', (value) => {
        expect(() => buildExtensionRequest('ext', route('GET', '/namespaces/{namespace}'), { namespace: value }))
            .toThrow(`Input property 'namespace' ${PATH_RULE}, because it fills the path /namespaces/{namespace}`);
    });

    it('lists each code point whose NFKC form contains / or \\, or is only ., %, @ or ;', () => {
        const refused = new Set('/\\.%@;');
        const onlyRefused = new Set('.%@;');
        const nfkc: string[] = [];
        for (let code = 0; code <= 0x10ffff; code++) {
            if (code >= 0xd800 && code <= 0xdfff) continue;
            const c = String.fromCodePoint(code);
            if (refused.has(c)) continue;
            const normal = c.normalize('NFKC');
            if (/[/\\]/.test(normal) || (normal !== '' && [...normal].every(n => onlyRefused.has(n)))) nfkc.push(c);
        }

        expect(nfkc).toEqual(expect.arrayContaining(['\u2025', '\u2100', '\uff0f']));
        expect(PATH_VALUES.lookAlikes).toEqual(expect.arrayContaining(nfkc));
    });

    it.each(PATH_VALUES.encoded)('encodes $value in the path and the query as MCP does', ({ value, path, query }) => {
        const request = buildExtensionRequest('ext', route('DELETE', '/items/{id}'), { id: value, q: value });

        expect(request.path).toBe(`/api/calm/extensions/ext/api/items/${path}`);
        expect(new URLSearchParams(request.query).toString()).toBe(`q=${query}`);
    });

    describe('when the filled path matches another route', () => {
        const { routes, route: routeId, refused, accepted } = PATH_VALUES.otherRoute;
        const own = routes.find(r => r.id === routeId)!;

        it.each(refused)('fails for %j, because Hub would call the other route', (value) => {
            expect(() => buildExtensionRequest('ext', own, { name: value }, routes))
                .toThrow(`The input fills the path ${own.path} so that it matches route 'get-admin', not route '${routeId}' of this command`);
        });

        it.each(accepted)('accepts %j', (value) => {
            expect(buildExtensionRequest('ext', own, { name: value }, routes).path).toBe(`/api/calm/extensions/ext/api/services/${value}`);
        });

        it('accepts the value when the other route has another method', () => {
            const post = routes.map(r => r.id === routeId ? r : { ...r, method: 'POST' });

            expect(buildExtensionRequest('ext', own, { name: 'admin' }, post).path).toBe('/api/calm/extensions/ext/api/services/admin');
        });

        it('compares the method in any case', () => {
            const lower = routes.map(r => ({ ...r, method: r.method.toLowerCase() }));

            expect(() => buildExtensionRequest('ext', lower.find(r => r.id === routeId)!, { name: 'admin' }, lower)).toThrow('matches route');
        });
    });

    it.each(PATH_VALUES.accepted)('accepts the path parameter %j', (value) => {
        const request = buildExtensionRequest('ext', route('GET', '/namespaces/{namespace}'), { namespace: value });

        expect(request.path).toBe(`/api/calm/extensions/ext/api/namespaces/${encodeURIComponent(value)}`);
    });

    it('accepts a number that fills the path', () => {
        expect(buildExtensionRequest('ext', route('GET', '/items/{id}'), { id: 1.5 }).path).toBe('/api/calm/extensions/ext/api/items/1.5');
    });

    it.each([[1.0, '1'], [1e21, '1000000000000000000000'], [1.5e-7, '0.00000015'], [-0, '0']])(
        'writes the number %j in the path and the query in plain notation as MCP does', (value, text) => {
            const request = buildExtensionRequest('ext', route('GET', '/items/{id}'), { id: value, n: value });

            expect(request.path).toBe(`/api/calm/extensions/ext/api/items/${text}`);
            expect(request.query).toEqual([['n', text]]);
        });

    it.each(['a\nb', 'a\tb', 'a\u0000b', 'a\u007fb', '\ud800'])('fails when a query value has a character that Hub refuses: %j', (value) => {
        expect(() => buildExtensionRequest('ext', route('GET', '/search'), { q: value }))
            .toThrow('Input property \'q\' must not contain a control character or a lone surrogate, because it goes in the query');
        expect(() => buildExtensionRequest('ext', route('DELETE', '/search'), { tags: ['ok', value] }))
            .toThrow('Input property \'tags\'');
    });

    it('fails when a query name has a control character', () => {
        expect(() => buildExtensionRequest('ext', route('GET', '/search'), { 'a\nb': 'x' }))
            .toThrow('Input property \'a\nb\' must not contain a control character');
    });

    it('sends a control character in an object query value as JSON escapes', () => {
        expect(buildExtensionRequest('ext', route('GET', '/search'), { q: { text: 'a\nb' } }).query).toEqual([['q', '{"text":"a\\nb"}']]);
    });

    it('sends a control character in the body of a write', () => {
        expect(buildExtensionRequest('ext', route('POST', '/search'), { q: 'a\nb' }).body).toEqual({ q: 'a\nb' });
    });

    it('fills a parameter that the path uses twice', () => {
        const request = buildExtensionRequest('ext', route('GET', '/{ns}/copy/{ns}'), { ns: 'finos' });

        expect(request.path).toBe('/api/calm/extensions/ext/api/finos/copy/finos');
        expect(request.query).toEqual([]);
    });

    it('does not change the input object', () => {
        const input = { namespace: 'finos', name: 'payments' };
        buildExtensionRequest('ext', route('POST', '/namespaces/{namespace}'), input);

        expect(input).toEqual({ namespace: 'finos', name: 'payments' });
    });

    it.each([undefined, null])('fails when a path parameter is %j', (value) => {
        expect(() => buildExtensionRequest('ext', route('GET', '/namespaces/{namespace}'), { namespace: value }))
            .toThrow('Input property \'namespace\' is required, because it fills the path /namespaces/{namespace}');
        expect(() => buildExtensionRequest('ext', route('GET', '/namespaces/{namespace}'), {}))
            .toThrow('Input property \'namespace\' is required');
    });

    it('fails when a path parameter is an object', () => {
        expect(() => buildExtensionRequest('ext', route('GET', '/namespaces/{namespace}'), { namespace: { a: 1 } }))
            .toThrow('Input property \'namespace\' must be a string, number or boolean');
    });

    describe('path parameters', () => {
        it('fills each parameter of an ordinary path', () => {
            const request = buildExtensionRequest('ext', route('GET', '/a/{first}/b/{second}/{third}'),
                { first: 'x', second: 2, third: true });

            expect(request.path).toBe('/api/calm/extensions/ext/api/a/x/b/2/true');
            expect(request.query).toEqual([]);
        });

        it('fills nothing, and quickly, in a long path of opening braces with no closing brace', () => {
            const longPath = '/{{' + '{{|'.repeat(16_666);
            const longRoute = route('GET', longPath);
            const start = performance.now();

            const request = buildExtensionRequest('ext', longRoute, {}, [longRoute, { ...longRoute, id: 'other' }]);

            expect(performance.now() - start).toBeLessThan(1000);
            expect(longPath.length).toBeGreaterThanOrEqual(50_000);
            expect(request.path).toBe(extensionProxyPath('ext', longPath));
        });
    });
});

describe('numberText', () => {
    it.each([[0, '0'], [42, '42'], [-1.25, '-1.25'], [1e21, '1000000000000000000000'], [1.5e21, '1500000000000000000000'],
        [1.2345e22, '12345000000000000000000'], [1e-7, '0.0000001'], [-1.23e-7, '-0.000000123'], [0.000001, '0.000001']])(
        'writes %j as %j', (value, text) => {
            expect(numberText(value)).toBe(text);
        });
});
