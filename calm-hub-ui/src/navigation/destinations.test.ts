import { describe, expect, it } from 'vitest';
import type { Destination } from '../model/extensions.js';
import { destinationLocation, isDestination, isTableStateEntry, readScreenQuery, resourceContext } from './destinations.js';
import { MAX_RETURN_POINTS, readReturnPoints, returnPointLocation } from './returnPoints.js';

const resource = { namespace: 'northstar.payments', type: 'architectures', id: 'payments', version: '2.4.0' };
const where = (destination: unknown) => {
    const to = destinationLocation(destination as Destination);
    return to && `${to.pathname}${to.search}`;
};

describe('destinationLocation', () => {
    it('keeps the namespace and version exact, so the same id in two namespaces opens two pages', () => {
        expect(where({ hub: resource })).toBe('/northstar.payments/architectures/payments/2.4.0?exact=1');
        expect(where({ hub: { ...resource, namespace: 'northstar.treasury', version: '1.0.0' } })).toBe(
            '/northstar.treasury/architectures/payments/1.0.0?exact=1'
        );
    });

    it('names the element and the extension view of a resource', () => {
        expect(where({ hub: { ...resource, element: 'payments api', extension: 'assurance' } })).toBe(
            '/northstar.payments/architectures/payments/2.4.0?node=payments+api&tab=extensions&extension=assurance&exact=1'
        );
    });

    it('encodes each part, so a value cannot add a path segment', () => {
        expect(where({ hub: { ...resource, namespace: 'a/b', id: '..x' } })).toBe('/a%2Fb/architectures/..x/2.4.0?exact=1');
    });

    it('opens a screen with its resource context and view state, in the order of the link', () => {
        expect(
            where({
                screen: {
                    extension: 'assurance',
                    screen: 'reviews',
                    context: { ...resource, element: 'api' },
                    params: { sort: 'due', 'reviews.filter': 'needs-review', 'reviews.page': '3' },
                },
            })
        ).toBe(
            '/extensions/assurance/reviews?namespace=northstar.payments&resourceType=architectures&resourceId=payments' +
                '&version=2.4.0&selectedElement=api&sort=due&reviews.filter=needs-review&reviews.page=3'
        );
    });

    it('has no Hub location for an external link', () => {
        expect(isDestination({ href: 'https://example.org' })).toBe(true);
        expect(where({ href: 'https://example.org' })).toBeUndefined();
    });

    it.each([
        ['two kinds', { href: 'https://example.org', hub: resource }],
        ['no kind', { label: 'x' }],
        ['a script URL', { href: 'javascript:alert(1)' }],
        ['a missing version', { hub: { ...resource, version: undefined } }],
        ['a dot segment', { hub: { ...resource, id: '..' } }],
        ['an extension id that is not an id', { hub: { ...resource, extension: '../admin' } }],
        ['an empty element', { hub: { ...resource, element: '' } }],
        ['a control character in an element', { hub: { ...resource, element: 'a\u0000' } }],
        ['a screen id that is not an id', { screen: { extension: 'assurance', screen: 'Reviews' } }],
        ['an incomplete screen context', { screen: { extension: 'a', screen: 'b', context: { namespace: 'x' } } }],
        ['a context name as a param', { screen: { extension: 'a', screen: 'b', params: { namespace: 'other' } } }],
        ['a table page of 1', { screen: { extension: 'a', screen: 'b', params: { 't.page': '1' } } }],
        ['an unknown table key', { screen: { extension: 'a', screen: 'b', params: { 't.sort': 'x' } } }],
        [
            'nine screen params',
            { screen: { extension: 'a', screen: 'b', params: Object.fromEntries([...'abcdefghi'].map((p) => [p, '1'])) } },
        ],
        ['a segment of 257 characters', { hub: { ...resource, id: 'x'.repeat(257) } }],
        // The router cannot encode it, so the link would throw as it renders.
        ['a lone surrogate in a segment', { hub: { ...resource, id: 'a\uD800' } }],
        ['an href of 2049 characters', { href: `https://example.org/${'x'.repeat(2049 - 20)}` }],
        ['an href with a port that is not a number', { href: 'https://example.org:bad' }],
        ['an href with a port above 65535', { href: 'https://example.org:99999' }],
        // "a=" and 228 '界' of nine characters each: 2054 characters to the screen route.
        ['a route query of 2054 characters', { screen: { extension: 'a', screen: 'b', params: { a: '界'.repeat(228) } } }],
        [
            'a context that takes the route query over 2048 characters',
            {
                screen: {
                    extension: 'a',
                    screen: 'b',
                    context: { ...resource, element: '界'.repeat(200) },
                    params: { a: '界'.repeat(100) },
                },
            },
        ],
    ])('refuses %s', (_, destination) => {
        expect(isDestination(destination)).toBe(false);
        expect(where(destination)).toBeUndefined();
    });

    it('allows eight screen params and twelve table keys together', () => {
        const params = Object.fromEntries([
            ...[...'abcdefgh'].map((name) => [name, '1']),
            ...['one', 'two', 'three', 'four'].flatMap((table) =>
                [`${table}.filter`, `${table}.q`, `${table}.page`].map((key) => [key, '2'])
            ),
        ]);
        expect(isDestination({ screen: { extension: 'a', screen: 'b', params } })).toBe(true);
        expect(isDestination({ screen: { extension: 'a', screen: 'b', params: { ...params, 'five.q': 'x' } } })).toBe(false);
    });

    it('allows a route query of 2048 characters, counted as the browser encodes it', () => {
        expect(isDestination({ screen: { extension: 'a', screen: 'b', params: { a: '界'.repeat(227) } } })).toBe(true);
        expect(isDestination({ href: `https://example.org/${'x'.repeat(2048 - 20)}` })).toBe(true);
        expect(isDestination({ hub: { ...resource, id: 'x'.repeat(256) } })).toBe(true);
    });

    // As JSON Schema maxLength and ExtensionDestinations count: '𝄞' is one character and two UTF-16 units.
    it('counts a length in characters, not UTF-16 units', () => {
        const at = (n: number) => '𝄞'.repeat(n);
        expect(isDestination({ hub: { ...resource, id: at(256), element: at(256) } })).toBe(true);
        expect(isDestination({ hub: { ...resource, id: at(257) } })).toBe(false);
        expect(isDestination({ hub: { ...resource, element: at(257) } })).toBe(false);
        expect(isDestination({ href: `https://example.org/${at(2048 - 20)}` })).toBe(true);
        expect(isDestination({ href: `https://example.org/${at(2049 - 20)}` })).toBe(false);
        expect(isTableStateEntry('t.filter', at(100))).toBe(true);
        expect(isTableStateEntry('t.filter', at(101))).toBe(false);
        expect(isTableStateEntry('t.q', at(200))).toBe(true);
        expect(isTableStateEntry('t.q', at(201))).toBe(false);
    });
});

describe('isTableStateEntry', () => {
    it.each([
        ['reviews.page', '2', true],
        ['reviews.page', '10000', true],
        ['reviews.page', '10001', false],
        ['reviews.page', '02', false],
        ['reviews.filter', 'x'.repeat(100), true],
        ['reviews.filter', 'x'.repeat(101), false],
        ['reviews.q', 'x'.repeat(200), true],
        ['reviews.q', 'x'.repeat(201), false],
        ['Reviews.q', 'x', false],
    ])('%s=%s is %s', (name, value, valid) => {
        expect(isTableStateEntry(name, value)).toBe(valid);
    });
});

describe('readScreenQuery', () => {
    it('reads the context and the screen params, and leaves the table keys in the URL', () => {
        const query = new URLSearchParams(
            'reviews.filter=needs-review&namespace=n&resourceType=architectures&resourceId=1&version=1.0.0&sort=due'
        );
        expect(readScreenQuery(query)).toEqual({
            context: { namespace: 'n', type: 'architectures', id: '1', version: '1.0.0' },
            params: { sort: 'due' },
        });
    });

    it('refuses an incomplete context rather than call the screen for another target', () => {
        expect(readScreenQuery(new URLSearchParams('namespace=n&resourceId=1')).problem).toMatch(/incomplete/);
    });

    it('refuses more than eight screen params', () => {
        const query = new URLSearchParams([...'abcdefghi'].map((name) => [name, '1']));
        expect(readScreenQuery(query).problem).toMatch(/more than 8/);
    });

    it('refuses eight screen params that are too long for the screen route once encoded', () => {
        const query = new URLSearchParams([...'abcdefgh'].map((name) => [name, '界'.repeat(256)]));
        expect(readScreenQuery(query).problem).toMatch(/too long for the screen/);
    });
});

it('maps a resource target to the context names that routes and form targets use', () => {
    expect(resourceContext({ ...resource, element: 'api' })).toEqual({
        namespace: 'northstar.payments',
        resource: 'architectures/payments',
        resourceType: 'architectures',
        resourceId: 'payments',
        version: '2.4.0',
        selectedElement: 'api',
    });
});

describe('readReturnPoints', () => {
    const point = (label: string) => ({ page: { kind: 'search' }, search: '?q=pay', label });

    it('keeps valid points and drops what history state from elsewhere holds', () => {
        const state = {
            returnTo: [
                point('a'),
                null,
                { page: { kind: 'admin' }, search: '', label: 'x' },
                { page: { kind: 'search' }, search: 'no-question-mark', label: 'x' },
                { page: { kind: 'resource', namespace: 'n', type: 'architectures', id: '..', version: '1' }, search: '', label: 'x' },
                point('b'),
            ],
        };
        expect(readReturnPoints(state).map((entry) => entry.label)).toEqual(['a', 'b']);
        expect(readReturnPoints(null)).toEqual([]);
    });

    it('counts a label in characters, and shortens a long one rather than drop the point', () => {
        const withLabel = (label: string) => readReturnPoints({ returnTo: [point(label)] }).map((entry) => entry.label);
        expect(withLabel('𝄞'.repeat(200))).toEqual(['𝄞'.repeat(200)]);
        expect(withLabel('A'.repeat(201))).toEqual([`${'A'.repeat(199)}…`]);
        expect(withLabel('𝄞'.repeat(5000))).toEqual([`${'𝄞'.repeat(199)}…`]);
    });

    it(`keeps the last ${MAX_RETURN_POINTS}`, () => {
        const labels = ['1', '2', '3', '4', '5', '6'];
        expect(readReturnPoints({ returnTo: labels.map(point) }).map((entry) => entry.label)).toEqual(labels.slice(1));
    });

    it('maps each kind of page to its route, chat included', () => {
        expect(returnPointLocation({ page: { kind: 'chat' }, search: '', label: 'Chat' }).pathname).toBe('/chat');
        expect(returnPointLocation({ page: { kind: 'screen', extension: 'a', screen: 'b' }, search: '?x=1', label: 'B' })).toEqual({
            pathname: '/extensions/a/b',
            search: '?x=1',
            hash: '',
        });
    });

    it('opens the exact version of a resource page, with its view state', () => {
        const page = { kind: 'resource', namespace: 'finos', type: 'architectures', id: 'pay', version: '2.0.0' } as const;
        expect(returnPointLocation({ page, search: '?node=api&lens=c4', label: 'Pay' }).search).toBe('?node=api&lens=c4&exact=1');
        expect(returnPointLocation({ page, search: '?exact=1&node=api', label: 'Pay' }).search).toBe('?exact=1&node=api');
        expect(returnPointLocation({ page, search: '', label: 'Pay' }).search).toBe('?exact=1');
    });
});
