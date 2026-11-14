import { afterEach, describe, expect, it } from 'vitest';
import { CALM_DEFAULT_C4_MAPPING_URL, resolveC4Mapping } from '@finos/calm-models/c4';
import { C4DiagramWidget, setC4Mapping } from './index';

const node = (id: string, type: string, name = id, description = '') => ({ 'unique-id': id, 'node-type': type, name, description });
const composed = (container: string, ...nodes: string[]) => ({
    'unique-id': `${container}-c`,
    'relationship-type': { 'composed-of': { container, nodes } },
});
const connects = (source: string, target: string, description: string, protocol?: string) => ({
    'unique-id': `${source}-${target}-${description}`,
    description,
    protocol,
    'relationship-type': { connects: { source: { node: source }, destination: { node: target } } },
});

const shop = {
    title: 'Shop',
    nodes: [
        node('buyer', 'actor', 'Buyer', 'Buys "things"'),
        node('shop', 'system', 'Shop System'),
        node('web', 'webclient', 'Web'),
        node('orders', 'service', 'Orders'),
        node('orders-db', 'database', 'Orders DB'),
        node('worker', 'acme:worker', 'Worker'),
        node('vendor', 'system', 'Vendor'),
    ],
    relationships: [
        composed('shop', 'web', 'orders', 'orders-db', 'worker'),
        { 'unique-id': 'i', description: 'Browses', 'relationship-type': { interacts: { actor: 'buyer', nodes: ['web'] } } },
        connects('web', 'orders', 'Places orders', 'HTTPS'),
        connects('orders', 'orders-db', 'Stores orders', 'JDBC'),
        connects('orders', 'vendor', 'Pays'),
        connects('worker', 'vendor', 'Settles'),
    ],
};

const render = (context: unknown, options: Record<string, unknown> = {}) => C4DiagramWidget.transformToViewModel!(context as never, options).lines;

afterEach(() => setC4Mapping(undefined));

describe('C4DiagramWidget', () => {
    it('draws a context diagram of the first system, with relationships lifted to systems and merged', () => {
        expect(render(shop)).toEqual([
            'C4Context',
            '    System(shop, "Shop System", "")',
            '    Person(buyer, "Buyer", "Buys \'things\'")',
            '    System(vendor, "Vendor", "")',
            '    Rel(buyer, shop, "Browses")',
            '    Rel(shop, vendor, "Pays (2 relationships)")',
        ]);
    });

    it('draws the containers of a system inside its boundary, with technology and database shapes', () => {
        const lines = render(shop, { level: 'container', scope: 'shop', title: 'Shop containers' });

        expect(lines.slice(0, 3)).toEqual(['C4Container', '    title Shop containers', '    System_Boundary(shop, "Shop System") {']);
        expect(lines).toContain('        ContainerDb(orders_db, "Orders DB", "database", "")');
        expect(lines).toContain('        Container(worker, "Worker", "acme:worker", "")');
        expect(lines).toContain('    }');
        expect(lines).toContain('    Rel(web, orders, "Places orders", "HTTPS")');
        expect(lines).toContain('    Rel(worker, vendor, "Settles")');
    });

    it('draws an enterprise boundary at context level and puts external systems outside it', () => {
        const bank = {
            nodes: [node('bank', 'ecosystem', 'Bank'), node('core', 'system', 'Core'), node('vendor', 'system', 'Vendor')],
            relationships: [composed('bank', 'core'), connects('core', 'vendor', 'Calls')],
        };

        expect(render(bank, { scope: 'core' })).toEqual([
            'C4Context',
            '    Enterprise_Boundary(bank, "Bank") {',
            '        System(core, "Core", "")',
            '    }',
            '    System_Ext(vendor, "Vendor", "")',
            '    Rel(core, vendor, "Calls")',
        ]);
    });

    it('zooms through the dereferenced detailed architecture of a node', () => {
        const withDetail = {
            ...shop,
            nodes: shop.nodes.map((n) =>
                n['unique-id'] === 'orders'
                    ? { ...n, details: { nodes: [node('api', 'service', 'API'), node('repo', 'service', 'Repo')], relationships: [connects('api', 'repo', 'Saves')] } }
                    : n,
            ),
        };

        const lines = render(withDetail, { level: 'component', scope: 'orders' });

        expect(lines).toContain('    Container_Boundary(orders, "Orders") {');
        expect(lines).toContain('        Component(orders_api, "API", "service", "")');
        expect(lines).toContain('    Rel(orders_api, orders_repo, "Saves")');
    });

    it('groups deployed nodes by deployment node', () => {
        const deployed = {
            nodes: [node('k8s', 'network', 'Cluster'), node('api', 'service', 'API')],
            relationships: [{ 'unique-id': 'd', 'relationship-type': { 'deployed-in': { container: 'k8s', nodes: ['api'] } } }],
        };

        expect(render(deployed, { level: 'deployment' })).toEqual([
            'C4Deployment',
            '    Deployment_Node(k8s, "Cluster", "network") {',
            '        Container(api, "API", "service", "")',
            '    }',
        ]);
    });

    it('uses the mapping set with setC4Mapping', async () => {
        setC4Mapping(
            await resolveC4Mapping({
                'unique-id': 'acme',
                extends: CALM_DEFAULT_C4_MAPPING_URL,
                'node-types': { 'acme:worker': { kind: 'container', external: true } },
            }),
        );

        expect(render(shop, { level: 'container', scope: 'shop' })).toContain('        Container_Ext(worker, "Worker", "acme:worker", "")');
    });

    it('gives each element a distinct alias when ids differ only in punctuation', () => {
        const lines = render({ nodes: [node('a-b', 'system', 'One'), node('a_b', 'system', 'Two')], relationships: [connects('a-b', 'a_b', 'Calls')] }, { scope: 'a-b' });

        expect(lines).toContain('    Rel(a_b, a_b_2, "Calls")');
    });

    it('names the scopes it knows when the scope is unknown', () => {
        expect(() => render(shop, { level: 'container', scope: 'nope' })).toThrow('c4-diagram has no container diagram for scope \'nope\'. Scopes at this level: shop');
    });

    it('rejects an unknown level', () => {
        expect(() => render(shop, { level: 'code' })).toThrow('c4-diagram level must be one of context, container, component, deployment, not \'code\'');
    });

    it('accepts only an architecture as context', () => {
        expect(C4DiagramWidget.validateContext(shop)).toBe(true);
        expect(C4DiagramWidget.validateContext(shop.nodes[0])).toBe(false);
        expect(C4DiagramWidget.validateContext(undefined)).toBe(false);
    });
});
