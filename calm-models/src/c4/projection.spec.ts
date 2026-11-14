import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CALM_DEFAULT_C4_MAPPING_URL, defaultC4Mapping, resolveC4Mapping } from './mapping.js';
import { C4_IMPLICIT_SYSTEM_ID, projectC4, type C4ArchitectureInput, type C4Model } from './projection.js';
import { c4Scopes, c4View } from './view.js';
import { withDetailedArchitectures } from './detailed-architecture.js';

type Relationship = NonNullable<C4ArchitectureInput['relationships']>[number];

const node = (id: string, type: string, details?: { 'detailed-architecture': string }) => ({
    'unique-id': id,
    'node-type': type,
    name: id,
    description: '',
    details,
});
const composed = (container: string, ...nodes: string[]): Relationship => ({
    'unique-id': `${container}-composed-of`,
    'relationship-type': { 'composed-of': { container, nodes } },
});
const connects = (source: string, target: string, description?: string, protocol?: string): Relationship => ({
    'unique-id': `${source}-${target}-${description}`,
    description,
    protocol,
    'relationship-type': { connects: { source: { node: source }, destination: { node: target } } },
});

const kinds = (model: C4Model) => Object.fromEntries([...model.elements.values()].map((e) => [e.id, e.kind]));
const element = (model: C4Model, id: string) => model.elements.get(id)!;
const rules = (model: C4Model) => model.conflicts.map((c) => [c.element, c.rule]);

describe('projectC4', () => {
    describe('structural rules', () => {
        it('gives unmapped types their kind from the composed-of hierarchy', () => {
            const model = projectC4({
                nodes: [node('platform', 'x:platform'), node('engine', 'x:engine'), node('module', 'x:module'), node('lone', 'x:lone')],
                relationships: [composed('platform', 'engine'), composed('engine', 'module')],
            });

            expect(kinds(model)).toEqual({ platform: 'software-system', engine: 'container', module: 'component', lone: 'software-system' });
            expect(element(model, 'engine').source).toBe('structure');
            expect(element(model, 'engine').parent).toBe('platform');
        });

        it('skips enterprise boundaries, deployment nodes and hidden nodes when it finds a parent', () => {
            const mapping = defaultC4Mapping();
            mapping['node-types']['acme:folder'] = { kind: 'hidden', external: false, source: 'mapping' };
            const model = projectC4(
                {
                    nodes: [
                        node('bank', 'ecosystem'),
                        node('platform', 'x:platform'),
                        node('folder', 'acme:folder'),
                        node('engine', 'x:engine'),
                        node('net', 'network'),
                        node('box', 'x:box'),
                    ],
                    relationships: [composed('bank', 'platform', 'net'), composed('platform', 'folder'), composed('folder', 'engine'), composed('net', 'box')],
                },
                mapping
            );

            expect(element(model, 'platform')).toMatchObject({ kind: 'software-system', parent: undefined });
            expect(element(model, 'engine')).toMatchObject({ kind: 'container', parent: 'platform' });
            expect(element(model, 'box')).toMatchObject({ kind: 'software-system', parent: undefined });
        });

        it('does not take a C4 level from deployed-in', () => {
            const model = projectC4({
                nodes: [node('host', 'x:host'), node('app', 'x:app')],
                relationships: [{ 'unique-id': 'd', 'relationship-type': { 'deployed-in': { container: 'host', nodes: ['app'] } } }],
            });

            expect(kinds(model)).toEqual({ host: 'software-system', app: 'software-system' });
            expect(model.deployedIn.get('app')).toBe('host');
        });

        it('puts containers that no software system holds in one implicit system named after the architecture', () => {
            const architecture = { title: 'Payments', nodes: [node('api', 'service'), node('db', 'database'), node('user', 'actor')] };

            const model = projectC4(architecture);

            expect(element(model, C4_IMPLICIT_SYSTEM_ID)).toMatchObject({ name: 'Payments', kind: 'software-system', source: 'implicit' });
            expect(element(model, 'api').parent).toBe(C4_IMPLICIT_SYSTEM_ID);
            expect(element(model, 'db').parent).toBe(C4_IMPLICIT_SYSTEM_ID);
            expect(element(model, 'user').parent).toBeUndefined();
            expect(element(projectC4({ nodes: architecture.nodes }, undefined, { architectureName: 'pay-v2' }), C4_IMPLICIT_SYSTEM_ID).name).toBe('pay-v2');
            expect(projectC4({ nodes: [node('user', 'actor')] }).elements.has(C4_IMPLICIT_SYSTEM_ID)).toBe(false);
        });
    });

    describe('nesting', () => {
        const nested: C4ArchitectureInput = {
            nodes: [node('sys', 'system'), node('inner-sys', 'system'), node('api', 'service'), node('module', 'service'), node('deep', 'service')],
            relationships: [composed('sys', 'inner-sys', 'api'), composed('api', 'module'), composed('module', 'deep')],
        };

        it('demotes a mapped node to one level below its parent', () => {
            const model = projectC4(nested);

            expect(kinds(model)).toMatchObject({ sys: 'software-system', 'inner-sys': 'container', api: 'container', module: 'component' });
            expect(element(model, 'inner-sys').notes).toEqual(['Mapped as software-system, shown as container because it is inside software-system "sys"']);
            expect(element(model, 'deep').kind).toBe('container');
            expect(rules(model)).toEqual([['deep', 'inside-component']]);
        });

        it('keeps the mapped kind and reports a conflict with strict nesting', async () => {
            const mapping = await resolveC4Mapping({ 'unique-id': 'strict', extends: CALM_DEFAULT_C4_MAPPING_URL, nesting: 'strict' });

            const model = projectC4(nested, mapping);

            expect(kinds(model)).toMatchObject({ 'inner-sys': 'software-system', api: 'container', module: 'container', deep: 'container' });
            expect(rules(model)).toEqual([['inner-sys', 'strict-nesting'], ['module', 'strict-nesting'], ['deep', 'strict-nesting']]);
        });
    });

    it('reports a person inside a system and a component with no container above it', async () => {
        const mapping = await resolveC4Mapping({ 'unique-id': 'm', extends: CALM_DEFAULT_C4_MAPPING_URL, 'node-types': { 'acme:module': 'component' } });

        const model = projectC4(
            {
                nodes: [node('sys', 'system'), node('clerk', 'actor'), node('in-system', 'acme:module'), node('top', 'acme:module')],
                relationships: [composed('sys', 'clerk', 'in-system')],
            },
            mapping
        );

        expect(rules(model)).toEqual([
            ['clerk', 'person-inside'],
            ['in-system', 'component-without-container'],
            ['top', 'component-without-container'],
        ]);
    });

    describe('external rules', () => {
        it('marks nodes outside every enterprise boundary, and the implicit system only when all its containers are outside', () => {
            const model = projectC4({
                nodes: [node('bank', 'ecosystem'), node('teller', 'actor'), node('core', 'system'), node('api', 'service'), node('vendor', 'system'), node('customer', 'actor')],
                relationships: [composed('bank', 'teller', 'core', 'api')],
            });

            expect(element(model, 'vendor').external).toEqual(['outside-enterprise']);
            expect(element(model, 'customer').external).toEqual(['outside-enterprise']);
            expect(element(model, 'core').external).toEqual([]);
            expect(element(model, 'teller').external).toEqual([]);
            expect(element(model, C4_IMPLICIT_SYSTEM_ID).external).toEqual([]);
            expect(model.hasEnterpriseBoundary).toBe(true);
        });

        it('marks nothing outside the enterprise when there is no enterprise boundary', () => {
            const model = projectC4({ nodes: [node('vendor', 'system'), node('customer', 'actor')] });

            expect([...model.elements.values()].flatMap((e) => e.external)).toEqual([]);
        });

        it('marks every node of a type mapped as external', async () => {
            const mapping = await resolveC4Mapping({
                'unique-id': 'm',
                extends: CALM_DEFAULT_C4_MAPPING_URL,
                'node-types': { 'aws:s3': { kind: 'container', external: true } },
            });

            const model = projectC4({ nodes: [node('bucket', 'aws:s3'), node('api', 'service')] }, mapping);

            expect(element(model, 'bucket').external).toEqual(['mapped-external']);
            expect(element(model, 'api').external).toEqual([]);
        });

        it('shows a node whose detailed architecture is in another namespace as another team\'s software system', () => {
            const hub = (ns: string) => `https://hub.example.com/calm/namespaces/${ns}/architectures/1/versions/1.0.0`;
            const architecture = {
                nodes: [
                    node('sys', 'system'),
                    node('payments', 'service', { 'detailed-architecture': hub('finos') }),
                    node('ledger', 'service', { 'detailed-architecture': hub('finos.calmx') }),
                    node('ledger-db', 'database'),
                ],
                relationships: [composed('sys', 'payments', 'ledger'), composed('ledger', 'ledger-db')],
            };

            const model = projectC4(architecture, undefined, { namespace: 'finos.calm' });

            expect(element(model, 'payments')).toMatchObject({ kind: 'container', external: [] });
            expect(element(model, 'ledger')).toMatchObject({ kind: 'software-system', external: ['other-team'] });
            expect(element(model, 'ledger').notes).toEqual(['Owned by namespace finos.calmx, so it is shown as a software system, not a container']);
            expect(element(model, 'ledger-db').kind).toBe('component');
            expect(element(projectC4(architecture), 'ledger').external).toEqual([]);
        });
    });

    it('labels relationships, merges duplicates and drops those of hidden nodes', async () => {
        const mapping = await resolveC4Mapping({ 'unique-id': 'm', extends: CALM_DEFAULT_C4_MAPPING_URL, 'node-types': { 'x:sidecar': 'hidden' } });

        const model = projectC4(
            {
                nodes: [node('user', 'actor'), node('api', 'service'), node('db', 'database'), node('sidecar', 'x:sidecar')],
                relationships: [
                    { 'unique-id': 'i', 'relationship-type': { interacts: { actor: 'user', nodes: ['api'] } } },
                    connects('api', 'db', 'Reads orders', 'JDBC'),
                    connects('api', 'db', 'Writes orders', 'JDBC'),
                    connects('api', 'sidecar', 'Sends logs'),
                    connects('api', 'missing', 'Dangling'),
                ],
            },
            mapping
        );

        expect(model.relationships).toEqual([
            { source: 'user', target: 'api', label: 'Uses', technology: undefined, count: 1 },
            { source: 'api', target: 'db', label: 'Reads orders', technology: 'JDBC', count: 2 },
        ]);
    });
});

describe('c4View', () => {
    // Two systems with containers, a person, and a container of another team inside the shop.
    const otherTeam = 'https://hub.example.com/calm/namespaces/payments/architectures/7/versions/1.0.0';
    const model = projectC4(
        {
            nodes: [
                node('buyer', 'actor'),
                node('shop', 'system'),
                node('web', 'webclient'),
                node('orders', 'service'),
                node('orders-db', 'database'),
                node('pay', 'service', { 'detailed-architecture': otherTeam }),
                node('pay-api', 'service'),
                node('crm', 'system'),
                node('crm-api', 'service'),
                node('crm-db', 'database'),
                node('handler', 'service'),
                node('repo', 'service'),
            ],
            relationships: [
                composed('shop', 'web', 'orders', 'orders-db', 'pay'),
                composed('pay', 'pay-api'),
                composed('crm', 'crm-api', 'crm-db'),
                composed('orders', 'handler', 'repo'),
                { 'unique-id': 'i', 'relationship-type': { interacts: { actor: 'buyer', nodes: ['web'] } } },
                connects('web', 'orders', 'Places orders'),
                connects('handler', 'repo', 'Saves'),
                connects('repo', 'orders-db', 'Stores'),
                connects('orders', 'crm-api', 'Syncs customers'),
                connects('handler', 'crm-db', 'Reads customers'),
                connects('orders', 'pay-api', 'Takes payment'),
                connects('crm-api', 'crm-db', 'Stores'),
            ],
        },
        undefined,
        { namespace: 'shop' }
    );
    const ids = (elements: { id: string }[]) => elements.map((e) => e.id).sort();
    const edges = (view: ReturnType<typeof c4View>) => view.relationships.map((r) => `${r.source}->${r.target}x${r.count}`).sort();

    it('lists the scopes at each level', () => {
        expect(ids(c4Scopes(model, 'context'))).toEqual(['crm', 'shop']);
        expect(ids(c4Scopes(model, 'container'))).toEqual(['crm', 'shop']);
        expect(ids(c4Scopes(model, 'component'))).toEqual(['orders']);
        expect(c4Scopes(model, 'deployment')).toEqual([]);
    });

    it('lifts relationships to the top-level elements at context level', () => {
        const view = c4View(model, 'context', 'shop');

        expect(ids(view.outside)).toEqual(['buyer', 'crm', 'pay', 'shop']);
        expect(edges(view)).toEqual(['buyer->shopx1', 'shop->crmx2', 'shop->payx1']);
    });

    it('shows the children of a system and lifts the other end of each relationship to the highest element outside it', () => {
        const view = c4View(model, 'container', 'shop');

        expect(view.scope?.id).toBe('shop');
        expect(ids(view.inside)).toEqual(['orders', 'orders-db', 'web']);
        expect(ids(view.outside)).toEqual(['buyer', 'crm', 'pay']);
        expect(edges(view)).toEqual(['buyer->webx1', 'orders->crmx2', 'orders->orders-dbx1', 'orders->payx1', 'web->ordersx1']);
    });

    it('shows the components of a container', () => {
        const view = c4View(model, 'component', 'orders');

        expect(ids(view.inside)).toEqual(['handler', 'repo']);
        expect(edges(view)).toEqual(['handler->crmx1', 'handler->repox1', 'repo->orders-dbx1']);
    });

    it('groups deployed nodes by the node they are deployed in', () => {
        const deployed = projectC4({
            nodes: [node('k8s', 'network'), node('api', 'service'), node('db', 'database'), node('idle', 'network')],
            relationships: [
                { 'unique-id': 'd', 'relationship-type': { 'deployed-in': { container: 'k8s', nodes: ['api', 'db'] } } },
                connects('api', 'db', 'Reads'),
            ],
        });

        const view = c4View(deployed, 'deployment');

        expect(view.deployments?.map((d) => [d.node.id, ids(d.hosted)])).toEqual([['k8s', ['api', 'db']], ['idle', []]]);
        expect(edges(view)).toEqual(['api->dbx1']);
    });

    it('returns an empty view for an unknown scope', () => {
        expect(c4View(model, 'container', 'nope')).toEqual({ level: 'container', inside: [], outside: [], relationships: [] });
    });
});

describe('withDetailedArchitectures', () => {
    it('composes the detailed architecture into the node that links to it, with prefixed ids', () => {
        const detail: C4ArchitectureInput = {
            nodes: [node('user', 'actor'), node('api', 'service'), node('host', 'network')],
            relationships: [
                { 'unique-id': 'i', 'relationship-type': { interacts: { actor: 'user', nodes: ['api'] } } },
                { 'unique-id': 'd', 'relationship-type': { 'deployed-in': { container: 'host', nodes: ['api'] } } },
                connects('user', 'api', 'Calls'),
            ],
        };

        const expanded = withDetailedArchitectures({ nodes: [node('api', 'system')] }, { api: detail, unknown: detail });

        expect(expanded.nodes?.map((n) => n['unique-id'])).toEqual(['api', 'api/user', 'api/api', 'api/host']);
        expect(expanded.relationships?.map((r) => r['relationship-type'])).toEqual([
            { 'composed-of': { container: 'api', nodes: ['api/user', 'api/api', 'api/host'] } },
            { interacts: { actor: 'api/user', nodes: ['api/api'] } },
            { 'deployed-in': { container: 'api/host', nodes: ['api/api'] } },
            { connects: { source: { node: 'api/user' }, destination: { node: 'api/api' } } },
        ]);
    });
});

describe('C4 on the CALM architectures in this repository', () => {
    const read = (path: string) => JSON.parse(readFileSync(resolve(__dirname, '../../..', path), 'utf8'));

    it('zooms into CALM Hub through its detailed architecture', () => {
        const architecture = withDetailedArchitectures(read('calm/architecture/calm-4.json'), {
            'calm-hub': read('calm/architecture/calm-hub-detail.architecture.json'),
        });

        const model = projectC4(architecture, undefined, { architectureName: 'calm' });

        expect(element(model, 'calm-hub-ui').kind).toBe('container');
        expect(ids(c4Scopes(model, 'component'))).toEqual(['calm-hub']);
        expect(c4View(model, 'component', 'calm-hub').inside).toHaveLength(5);
        expect(element(model, 'calm-cli').parent).toBe(C4_IMPLICIT_SYSTEM_ID);
        expect(model.conflicts).toEqual([]);
    });

    it('maps every FluxNova type with a custom mapping that extends the default', async () => {
        const mapping = await resolveC4Mapping({
            'unique-id': 'fluxnova',
            extends: CALM_DEFAULT_C4_MAPPING_URL,
            'node-types': {
                'fluxnova:platform': 'software-system',
                'fluxnova:engine': 'container',
                'fluxnova:rest-api': 'container',
                'fluxnova:cockpit': 'container',
                'fluxnova:admin': 'container',
                'fluxnova:tasklist': 'container',
                'fluxnova:process-db': 'container',
            },
        });
        const architecture = read('examples/fluxnova/fluxnova-kyc-onboarding.architecture.json');

        const guessed = (model: C4Model) => [...model.elements.values()].filter((e) => e.source === 'structure').length;

        expect(guessed(projectC4(architecture))).toBe(7);
        expect(guessed(projectC4(architecture, mapping))).toBe(0);
    });

    function ids(elements: { id: string }[]) {
        return elements.map((e) => e.id).sort();
    }
});
