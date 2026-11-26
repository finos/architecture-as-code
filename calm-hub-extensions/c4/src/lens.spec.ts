import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import { defaultC4Mapping, projectC4 } from '@finos/calm-models/c4';
import { describe, expect, it } from 'vitest';
import { c4LensReply, parseLensLevel, type LensReply } from './lens.js';
import { SHOP, calmNode, connects } from './testing.js';

const schema = JSON.parse(readFileSync(new URL('../../../calm-hub/src/main/resources/META-INF/calm-extensions/schema/0/lens.schema.json', import.meta.url), 'utf8'));
const validate = new Ajv2020({ strict: false }).compile(schema);
const model = projectC4(SHOP, defaultC4Mapping(), { namespace: 'finos' });
const source = { id: 'calm-default-c4-mapping' };
const reply = (level: Parameters<typeof c4LensReply>[1], scope: string | null = null) => {
    const value = c4LensReply(model, level, scope, source);
    // Each reply is a reply that Hub accepts: the schema is the contract.
    expect(validate(value), JSON.stringify(validate.errors)).toBe(true);
    return value;
};
const node = (value: LensReply, id: string) => value.graph.nodes.find((entry) => entry.id === id);

describe('c4LensReply', () => {
    it('draws the context diagram of the first system, with a link into it', () => {
        const value = reply('context');
        expect(value.title).toBe('Context diagram: shop');
        expect(value.graph.nodes.map((entry) => entry.id).sort()).toEqual(['customer', 'payments', 'shop']);
        expect(node(value, 'customer')).toMatchObject({ tags: ['Element', 'Person'], metadata: '[Person: actor]', calm: ['customer'] });
        expect(node(value, 'shop')?.link).toEqual({ params: { level: 'container', scope: 'shop' } });
        expect(node(value, 'payments')?.link).toBeUndefined();
        expect(value.graph.edges.map((edge) => edge.id).sort()).toEqual(['customer->shop', 'shop->payments']);
    });

    it('draws the containers of a system inside its boundary, with the shape tags of their node types', () => {
        const value = reply('container', 'shop');
        expect(value.graph.groups).toEqual([{ id: 'boundary:shop', label: 'shop [Software System]', tags: ['Software System Boundary'], calm: ['shop'] }]);
        expect(node(value, 'db')).toMatchObject({ group: 'boundary:shop', tags: ['Element', 'Container', 'Database'] });
        expect(node(value, 'web')?.tags).toContain('Web Browser');
        expect(node(value, 'customer')?.group).toBeUndefined();
        expect(value.graph.edges.find((edge) => edge.id === 'api->db')).toMatchObject({ label: 'Reads and writes', technology: 'JDBC' });
    });

    it('marks a kind that the lens guessed, and says so in the notes', () => {
        const value = reply('container', 'shop');
        expect(node(value, 'mailer')).toMatchObject({ tags: expect.arrayContaining(['Guessed']), badges: [{ text: 'Guessed', tone: 'warning' }] });
        expect(JSON.stringify(value.panels)).toContain('1 element with a node type that the mapping does not name');
    });

    it('falls back to the first scope and to the context level for values it does not know', () => {
        expect(reply('container', 'nothing').graph.groups[0].id).toBe('boundary:shop');
        expect(parseLensLevel('blueprint')).toBe('context');
        expect(parseLensLevel('deployment')).toBe('deployment');
    });

    it('draws each deployment node as a group around what is deployed in it', () => {
        const value = reply('deployment');
        expect(value.graph.groups).toEqual([{ id: 'deployment:cluster', label: 'cluster [Deployment Node: network]', tags: ['Deployment Node'], calm: ['cluster'] }]);
        expect(value.graph.nodes.map((entry) => [entry.id, entry.group])).toEqual([['api', 'deployment:cluster'], ['db', 'deployment:cluster']]);
    });

    it('draws what a hidden top-level node holds with no deployment node around it', () => {
        const base = defaultC4Mapping();
        const mapping = { ...base, 'node-types': { ...base['node-types'], 'x:pod': { ...base['node-types'].network, kind: 'hidden' as const } } };
        const hiddenHost = projectC4({
            nodes: [calmNode('pod', 'x:pod'), calmNode('api', 'service'), calmNode('db', 'database')],
            relationships: [{ 'unique-id': 'd', 'relationship-type': { 'deployed-in': { container: 'pod', nodes: ['api', 'db'] } } }, connects('api', 'db')],
        }, mapping);

        const value = c4LensReply(hiddenHost, 'deployment', null, source);

        expect(validate(value), JSON.stringify(validate.errors)).toBe(true);
        expect(value.graph.groups).toEqual([]);
        expect(value.graph.nodes.map((entry) => [entry.id, entry.group])).toEqual([['api', undefined], ['db', undefined]]);
        expect(value.graph.edges.map((edge) => edge.id)).toEqual(['api->db']);
    });

    it('keeps long CALM text and ids inside the limits of the lens schema', () => {
        const longId = `svc-${'x'.repeat(150)}`;
        const longModel = projectC4({
            title: 'T'.repeat(300),
            nodes: [
                calmNode('shop', 'system', { name: 'S'.repeat(300) }),
                calmNode('api', 'service', { description: 'd'.repeat(600) }),
                calmNode(longId, 'service'),
                calmNode('k8s', 'network'),
            ],
            relationships: [
                { 'unique-id': 'c', 'relationship-type': { 'composed-of': { container: 'shop', nodes: ['api', longId] } } },
                { 'unique-id': 'd', 'relationship-type': { 'deployed-in': { container: 'k8s', nodes: ['api', longId] } } },
                connects('api', longId, 'r'.repeat(600), 'p'.repeat(300)),
            ],
        }, defaultC4Mapping());

        for (const level of ['context', 'container', 'deployment'] as const) {
            const value = c4LensReply(longModel, level, null, source);
            expect(validate(value), `${level}: ${JSON.stringify(validate.errors)}`).toBe(true);
            expect(value.graph.edges.every((edge) => value.graph.nodes.some((n) => n.id === edge.source) && value.graph.nodes.some((n) => n.id === edge.target))).toBe(true);
        }
        const container = c4LensReply(longModel, 'container', 'shop', source);
        expect(node(container, 'api')?.description).toBe(`${'d'.repeat(499)}…`);
        expect(container.graph.edges[0]).toMatchObject({ label: `${'r'.repeat(499)}…`, technology: `${'p'.repeat(199)}…` });
        expect(container.graph.nodes.find((n) => n.calm?.[0] === longId)?.id).toHaveLength(117);
    });

    it('declares a scope that takes any CALM unique-id up to 128 characters, so each drill-down link opens', () => {
        const manifest = JSON.parse(readFileSync(new URL('../extension.json', import.meta.url), 'utf8'));
        // Hub checks the pattern in Unicode mode, as here.
        const scope = new RegExp(manifest.contributes['diagram-lens'][0].params.scope.pattern, 'u');
        expect(['order service', 'café', 'a/b:c'].every((id) => scope.test(id))).toBe(true);
        expect(['', 'a\nb', 'x'.repeat(129)].some((id) => scope.test(id))).toBe(false);
    });

    it('says why a level has nothing to draw', () => {
        const value = reply('component');
        expect(value.graph.nodes).toEqual([]);
        expect(JSON.stringify(value.panels)).toContain('No component diagram');
    });

    it('offers each level, and a choice of scope where the level has more than one', () => {
        const context = reply('context');
        expect(context.controls.map((control) => [control.param, control.items.map((item) => item.value)])).toEqual([
            ['level', ['context', 'container', 'component', 'deployment']],
            ['scope', ['shop', 'payments']],
        ]);
        expect(context.controls[1]).toMatchObject({ value: 'shop' });
        expect(reply('context', 'payments').controls[1]).toMatchObject({ value: 'payments' });
        expect(reply('container').controls.map((control) => control.param)).toEqual(['level']);
    });

    it('draws the enterprise boundary around what is inside it, and marks what is outside', () => {
        const enterprise = projectC4({
            ...SHOP,
            nodes: [...SHOP.nodes!, calmNode('company', 'ecosystem')],
            relationships: [
                ...SHOP.relationships!,
                { 'unique-id': 'company-composed-of', 'relationship-type': { 'composed-of': { container: 'company', nodes: ['customer', 'shop'] } } },
                connects('web', 'payments', 'Checks a card'),
            ],
        }, defaultC4Mapping(), { namespace: 'finos' });
        const value = c4LensReply(enterprise, 'context', 'shop', source);
        expect(validate(value), JSON.stringify(validate.errors)).toBe(true);
        expect(value.graph.groups).toEqual([{ id: 'enterprise:company', label: 'company', tags: ['Enterprise Boundary'], calm: ['company'] }]);
        expect(node(value, 'shop')?.group).toBe('enterprise:company');
        expect(node(value, 'payments')).toMatchObject({ tags: expect.arrayContaining(['External']), badges: [{ text: 'Outside the enterprise', tone: 'neutral' }] });
        expect(node(value, 'payments')?.group).toBeUndefined();
        expect(value.graph.edges.find((edge) => edge.id === 'shop->payments')?.tooltip).toBe('2 CALM relationships');
    });

    it('names on each edge the CALM relationships that it merges or lifts, so Hub draws their decorators on it', () => {
        const merged = projectC4({
            ...SHOP,
            relationships: [...SHOP.relationships!, connects('mailer', 'payments', 'Sends receipts'), connects('api', 'payments', 'Refunds')],
        }, defaultC4Mapping(), { namespace: 'finos' });
        const edge = (value: LensReply, id: string) => value.graph.edges.find((entry) => entry.id === id);

        const context = c4LensReply(merged, 'context', 'shop', source);
        expect(edge(context, 'customer->shop')?.calm).toEqual(['customer-web']);
        expect(edge(context, 'shop->payments')?.calm?.sort()).toEqual(['api-payments', 'mailer-payments']);
        const container = c4LensReply(merged, 'container', 'shop', source);
        expect(edge(container, 'api->db')?.calm).toEqual(['api-db']);
        // A relationship that is not in the open architecture, such as one of a detailed architecture, is not named.
        const own = c4LensReply(merged, 'container', 'shop', source, new Set(['api', 'api-db']));
        expect(edge(own, 'api->db')?.calm).toEqual(['api-db']);
        expect(edge(own, 'web->api')?.calm).toBeUndefined();
    });

    it('names at most 32 CALM relationships on an edge, as the lens schema allows', () => {
        const many = projectC4({
            nodes: [calmNode('a', 'system'), calmNode('b', 'system')],
            relationships: Array.from({ length: 40 }, (_, index) => ({ ...connects('a', 'b'), 'unique-id': `r${index}` })),
        }, defaultC4Mapping());
        const value = c4LensReply(many, 'context', 'a', source);
        expect(validate(value), JSON.stringify(validate.errors)).toBe(true);
        expect(value.graph.edges[0].calm).toEqual(Array.from({ length: 32 }, (_, index) => `r${index}`));
    });

    it('selects only the nodes of the open architecture', () => {
        const value = c4LensReply(model, 'container', 'shop', source, new Set(['api']));
        expect(node(value, 'api')?.calm).toEqual(['api']);
        expect(node(value, 'db')?.calm).toBeUndefined();
        expect(value.graph.groups[0].calm).toBeUndefined();
    });
});
