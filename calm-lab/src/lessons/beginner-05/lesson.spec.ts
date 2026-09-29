import { describe, it, expect } from 'vitest';
import { BEGINNER_05 } from './lesson';
import type { CommandOutcome } from '../../cli/outcome';
import type { LessonState } from '../types';

const seedDoc = JSON.parse(BEGINNER_05.seedFiles[BEGINNER_05.editorFile]);

const node = (id: string, type: string) => ({ 'unique-id': id, 'node-type': type, name: id, description: 'y' });
const withInterface = (n: Record<string, unknown>, iface: Record<string, unknown>) => ({ ...n, interfaces: [iface] });

const connects = (id: string, source: string, destination: string) => ({
    'unique-id': id,
    'relationship-type': { connects: { source: { node: source }, destination: { node: destination } } },
});
const connectsWithInterfaces = (id: string, source: string, sourceIfaces: string[], destination: string, destIfaces: string[]) => ({
    'unique-id': id,
    'relationship-type': {
        connects: {
            source: { node: source, interfaces: sourceIfaces },
            destination: { node: destination, interfaces: destIfaces },
        },
    },
});
const interacts = (id: string, actor: string, nodes: string[]) => ({
    'unique-id': id,
    'relationship-type': { interacts: { actor, nodes } },
});
const composedOfRel = (id: string, container: string, nodes: string[]) => ({
    'unique-id': id,
    'relationship-type': { 'composed-of': { container, nodes } },
});

const serviceNode = seedDoc.nodes.find((n: Record<string, unknown>) => n['node-type'] === 'service');
const databaseNode = seedDoc.nodes.find((n: Record<string, unknown>) => n['node-type'] === 'database');
const otherNodes = seedDoc.nodes.filter((n: Record<string, unknown>) => n !== serviceNode && n !== databaseNode);
const baseConnects = seedDoc.relationships.find((rel: Record<string, unknown>) => (rel['relationship-type'] as Record<string, unknown>)['connects']);
const otherRelationships = seedDoc.relationships.filter((rel: Record<string, unknown>) => rel !== baseConnects);

// A seed shaped the same way, but every node uses different names from the hint.
const differentNamesBase = {
    ...seedDoc,
    nodes: [node('checkout-service', 'service'), node('orders-db', 'database'), node('end-user', 'actor'), node('checkout-system', 'system')],
    relationships: [
        connects('checkout-to-orders', 'checkout-service', 'orders-db'),
        interacts('user-to-checkout', 'end-user', ['checkout-service']),
        composedOfRel('checkout-composition', 'checkout-system', ['checkout-service', 'orders-db']),
    ],
};

// Step 1: an inline interface on the service.
const withServiceInterface = {
    ...seedDoc,
    nodes: [withInterface(serviceNode, { 'unique-id': 'payment-service-api', protocol: 'HTTPS', host: 'api.example.com', port: 443, path: '/api/v1' }), databaseNode, ...otherNodes],
};
const withServiceInterfaceDifferentNames = {
    ...differentNamesBase,
    nodes: [
        withInterface(differentNamesBase.nodes[0], { 'unique-id': 'checkout-api', protocol: 'HTTPS', host: 'checkout.example.com', port: 443, path: '/v2' }),
        ...differentNamesBase.nodes.slice(1),
    ],
};
// Interface item with no unique-id: not a usable interface.
const serviceInterfaceMissingId = {
    ...seedDoc,
    nodes: [withInterface(serviceNode, { protocol: 'HTTPS', host: 'api.example.com', port: 443, path: '/api/v1' }), databaseNode, ...otherNodes],
};

// Step 2: an inline interface on the database too.
const withBothInterfaces = {
    ...withServiceInterface,
    nodes: withServiceInterface.nodes.map((n: Record<string, unknown>) =>
        n['unique-id'] === databaseNode['unique-id']
            ? withInterface(n, { 'unique-id': 'payment-database-jdbc', protocol: 'JDBC', host: 'db.example.com', port: 5432, database: 'payments' })
            : n),
};
const withBothInterfacesDifferentNames = {
    ...withServiceInterfaceDifferentNames,
    nodes: withServiceInterfaceDifferentNames.nodes.map((n: Record<string, unknown>) =>
        n['unique-id'] === 'orders-db'
            ? withInterface(n, { 'unique-id': 'orders-jdbc', protocol: 'JDBC', host: 'orders-db.example.com', port: 3306, database: 'orders' })
            : n),
};

// Step 3: the connects relationship names both interfaces.
const withConnectInterfaces = {
    ...withBothInterfaces,
    relationships: [
        connectsWithInterfaces(baseConnects['unique-id'], serviceNode['unique-id'], ['payment-service-api'], databaseNode['unique-id'], ['payment-database-jdbc']),
        ...otherRelationships,
    ],
};
const withConnectInterfacesDifferentNames = {
    ...withBothInterfacesDifferentNames,
    relationships: [
        connectsWithInterfaces('checkout-to-orders', 'checkout-service', ['checkout-api'], 'orders-db', ['orders-jdbc']),
        differentNamesBase.relationships[1],
        differentNamesBase.relationships[2],
    ],
};
// The relationship names an interface id that does not exist on the node: dangling reference.
const danglingInterfaceId = {
    ...withBothInterfaces,
    relationships: [
        connectsWithInterfaces(baseConnects['unique-id'], serviceNode['unique-id'], ['does-not-exist'], databaseNode['unique-id'], ['payment-database-jdbc']),
        ...otherRelationships,
    ],
};
// The connects points the wrong way: database as source, service as destination.
const wrongDirectionInterfaces = {
    ...withBothInterfaces,
    relationships: [
        connectsWithInterfaces(baseConnects['unique-id'], databaseNode['unique-id'], ['payment-database-jdbc'], serviceNode['unique-id'], ['payment-service-api']),
        ...otherRelationships,
    ],
};
// One end names an interface, the other has none at all.
const oneSidedInterfaces = {
    ...withBothInterfaces,
    relationships: [
        {
            'unique-id': baseConnects['unique-id'],
            'relationship-type': {
                connects: {
                    source: { node: serviceNode['unique-id'], interfaces: ['payment-service-api'] },
                    destination: { node: databaseNode['unique-id'] },
                },
            },
        },
        ...otherRelationships,
    ],
};

const validateOutcome = (architecture: string, ok: boolean): CommandOutcome => ({
    command: 'validate',
    files: { architecture },
    ok,
    errorCount: ok ? 0 : 1,
    warningCount: 0,
    snapshot: {},
});

const state = (over: Partial<LessonState>): LessonState => ({
    doc: null,
    validation: { ok: true },
    commands: [],
    editorFile: BEGINNER_05.editorFile,
    files: {},
    ...over,
});

describe('beginner-05 lesson', () => {
    const [serviceInterface, databaseInterface, connectInterfaces, validate] = BEGINNER_05.steps;

    it('has four steps with unique ids', () => {
        expect(BEGINNER_05.steps.map((step) => step.id)).toHaveLength(4);
        expect(new Set(BEGINNER_05.steps.map((step) => step.id)).size).toBe(4);
    });

    it('chains from beginner-03', () => {
        expect(BEGINNER_05.chainsFrom).toBe('beginner-03');
        expect(seedDoc.nodes.some((n: Record<string, unknown>) => n['node-type'] === 'service')).toBe(true);
        expect(seedDoc.nodes.some((n: Record<string, unknown>) => n['node-type'] === 'database')).toBe(true);
    });

    it('service-interface needs an inline interface on a service node, in a valid document', () => {
        expect(serviceInterface.check(state({ doc: seedDoc, validation: { ok: true } }))).toBe(false);
        expect(serviceInterface.check(state({ doc: withServiceInterface, validation: { ok: true } }))).toBe(true);
        // Different names, same shape: still passes.
        expect(serviceInterface.check(state({ doc: withServiceInterfaceDifferentNames, validation: { ok: true } }))).toBe(true);
        // Right shape, invalid document: must not tick.
        expect(serviceInterface.check(state({ doc: withServiceInterface, validation: { ok: false } }))).toBe(false);
        // An interface item with no unique-id does not count: must not tick.
        expect(serviceInterface.check(state({ doc: serviceInterfaceMissingId, validation: { ok: true } }))).toBe(false);
        // A schema-valid interface without the fields the step names: must not tick.
        for (const partial of [{ 'unique-id': 'api' }, { 'unique-id': 'api', protocol: 'HTTP', host: 'h', port: 443, path: '/' }, { 'unique-id': 'api', protocol: 'HTTPS', host: 'h', port: 8443, path: '/' }, { 'unique-id': 'api', protocol: 'HTTPS', host: 'h', port: 443 }]) {
            const doc = { ...seedDoc, nodes: [withInterface(serviceNode, partial), databaseNode, ...otherNodes] };
            expect(serviceInterface.check(state({ doc, validation: { ok: true } })), JSON.stringify(partial)).toBe(false);
        }
    });

    it('database-interface needs an inline interface on a database node, in a valid document', () => {
        expect(databaseInterface.check(state({ doc: withServiceInterface, validation: { ok: true } }))).toBe(false);
        expect(databaseInterface.check(state({ doc: withBothInterfaces, validation: { ok: true } }))).toBe(true);
        // Different names, same shape: still passes.
        expect(databaseInterface.check(state({ doc: withBothInterfacesDifferentNames, validation: { ok: true } }))).toBe(true);
        // Right shape, invalid document: must not tick.
        expect(databaseInterface.check(state({ doc: withBothInterfaces, validation: { ok: false } }))).toBe(false);
        for (const partial of [{ 'unique-id': 'db' }, { 'unique-id': 'db', protocol: 'JDBC', host: 'h', port: 5432 }, { 'unique-id': 'db', protocol: 'HTTPS', host: 'h', port: 5432, database: 'd' }]) {
            const doc = { ...withServiceInterface, nodes: withServiceInterface.nodes.map((n: Record<string, unknown>) => n['unique-id'] === databaseNode['unique-id'] ? withInterface(n, partial) : n) };
            expect(databaseInterface.check(state({ doc, validation: { ok: true } })), JSON.stringify(partial)).toBe(false);
        }
    });

    it('connect-interfaces needs the connects relationship to name both interfaces, in a valid document', () => {
        expect(connectInterfaces.check(state({ doc: withBothInterfaces, validation: { ok: true } }))).toBe(false);
        expect(connectInterfaces.check(state({ doc: withConnectInterfaces, validation: { ok: true } }))).toBe(true);
        // Different names, same shape: still passes.
        expect(connectInterfaces.check(state({ doc: withConnectInterfacesDifferentNames, validation: { ok: true } }))).toBe(true);
        // Right shape, invalid document: must not tick.
        expect(connectInterfaces.check(state({ doc: withConnectInterfaces, validation: { ok: false } }))).toBe(false);
        // An interface id the relationship names but the node does not have: must not tick, even
        // though the document may still be schema-valid.
        expect(connectInterfaces.check(state({ doc: danglingInterfaceId, validation: { ok: true } }))).toBe(false);
        // Wrong direction: database as source, service as destination. Must not tick.
        expect(connectInterfaces.check(state({ doc: wrongDirectionInterfaces, validation: { ok: true } }))).toBe(false);
        // Only one end names an interface: must not tick.
        expect(connectInterfaces.check(state({ doc: oneSidedInterfaces, validation: { ok: true } }))).toBe(false);
    });

    it('validate needs the interface references AND a fresh validate of the lesson file', () => {
        expect(validate.check(state({ doc: withConnectInterfaces, commands: [] }))).toBe(false);
        expect(validate.check(state({ doc: withConnectInterfaces, commands: [validateOutcome(BEGINNER_05.editorFile, true)] }))).toBe(true);
        // Different names, same shape: still passes.
        expect(validate.check(state({ doc: withConnectInterfacesDifferentNames, commands: [validateOutcome(BEGINNER_05.editorFile, true)] }))).toBe(true);
        // A stale/other-file validate does not count.
        expect(validate.check(state({ doc: withConnectInterfaces, commands: [validateOutcome('/workspace/other.json', true)] }))).toBe(false);
        // No interface references yet: must not tick even with a fresh validate.
        expect(validate.check(state({ doc: withBothInterfaces, commands: [validateOutcome(BEGINNER_05.editorFile, true)] }))).toBe(false);
    });

    it('links to the next lesson', () => {
        expect(BEGINNER_05.completion.links).toEqual([
            { to: '?lesson=beginner-06', label: 'Next lesson: Document with metadata' },
        ]);
    });
});
