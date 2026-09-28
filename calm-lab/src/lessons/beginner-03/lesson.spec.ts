import { describe, it, expect } from 'vitest';
import { BEGINNER_03 } from './lesson';
import type { CommandOutcome } from '../../cli/outcome';
import type { LessonState } from '../types';

const seedDoc = JSON.parse(BEGINNER_03.seedFiles[BEGINNER_03.editorFile]);

const node = (id: string, type: string) => ({ 'unique-id': id, 'node-type': type, name: id, description: 'y' });

const connects = (id: string, source: string, destination: string) => ({
    'unique-id': id,
    'relationship-type': { connects: { source: { node: source }, destination: { node: destination } } },
});
const interacts = (id: string, actor: string, nodes: string[]) => ({
    'unique-id': id,
    'relationship-type': { interacts: { actor, nodes } },
});
const composedOfRel = (id: string, container: string, nodes: string[]) => ({
    'unique-id': id,
    'relationship-type': { 'composed-of': { container, nodes } },
});

// Step 1: service + database, connected.
const withDatabase = {
    ...seedDoc,
    nodes: [...seedDoc.nodes, node('payment-database', 'database')],
    relationships: [connects('service-to-database', 'payment-service', 'payment-database')],
};
const withDatabaseDifferentNames = {
    ...seedDoc,
    nodes: [node('checkout-service', 'service'), node('orders-db', 'database')],
    relationships: [connects('checkout-to-orders', 'checkout-service', 'orders-db')],
};
const wrongDirection = {
    ...seedDoc,
    nodes: [...seedDoc.nodes, node('payment-database', 'database')],
    relationships: [connects('database-to-service', 'payment-database', 'payment-service')],
};

// Step 2: adds an actor interacting with the service.
const withActor = {
    ...withDatabase,
    nodes: [...withDatabase.nodes, node('customer', 'actor')],
    relationships: [...withDatabase.relationships, interacts('customer-to-service', 'customer', ['payment-service'])],
};
const withActorDifferentNames = {
    ...withDatabaseDifferentNames,
    nodes: [...withDatabaseDifferentNames.nodes, node('end-user', 'actor')],
    relationships: [...withDatabaseDifferentNames.relationships, interacts('user-to-checkout', 'end-user', ['checkout-service'])],
};
// A service used as the "actor" of an interacts relationship: wrong node type.
const serviceAsActor = {
    ...withDatabase,
    relationships: [...withDatabase.relationships, interacts('service-to-database-interacts', 'payment-service', ['payment-database'])],
};

// Step 3: adds a system composed of the service and the database.
const withSystem = {
    ...withActor,
    nodes: [...withActor.nodes, node('payment-system', 'system')],
    relationships: [...withActor.relationships, composedOfRel('system-composition', 'payment-system', ['payment-service', 'payment-database'])],
};
const withSystemDifferentNames = {
    ...withActorDifferentNames,
    nodes: [...withActorDifferentNames.nodes, node('checkout-system', 'system')],
    relationships: [
        ...withActorDifferentNames.relationships,
        composedOfRel('checkout-composition', 'checkout-system', ['checkout-service', 'orders-db']),
    ],
};
// composed-of the service only: the database is missing from the members.
const composedMissingDatabase = {
    ...withActor,
    nodes: [...withActor.nodes, node('payment-system', 'system')],
    relationships: [...withActor.relationships, composedOfRel('system-composition', 'payment-system', ['payment-service'])],
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
    editorFile: BEGINNER_03.editorFile,
    ...over,
});

describe('beginner-03 lesson', () => {
    const [connectDatabase, addActor, composeSystem, validate] = BEGINNER_03.steps;

    it('has four steps with unique ids', () => {
        expect(BEGINNER_03.steps.map((step) => step.id)).toHaveLength(4);
        expect(new Set(BEGINNER_03.steps.map((step) => step.id)).size).toBe(4);
    });

    it('chains from beginner-02, seeded with its single node', () => {
        expect(BEGINNER_03.chainsFrom).toBe('beginner-02');
        expect(seedDoc.nodes).toHaveLength(1);
        expect(seedDoc.nodes[0]['node-type']).toBe('service');
    });

    it('connect-database needs a connects from a service to a database, in a valid document', () => {
        expect(connectDatabase.check(state({ doc: seedDoc, validation: { ok: true } }))).toBe(false);
        expect(connectDatabase.check(state({ doc: withDatabase, validation: { ok: true } }))).toBe(true);
        // Different names, same shape: still passes.
        expect(connectDatabase.check(state({ doc: withDatabaseDifferentNames, validation: { ok: true } }))).toBe(true);
        // Right shape, invalid document: must not tick.
        expect(connectDatabase.check(state({ doc: withDatabase, validation: { ok: false } }))).toBe(false);
        // Wrong direction (database connects to service): must not tick.
        expect(connectDatabase.check(state({ doc: wrongDirection, validation: { ok: true } }))).toBe(false);
    });

    it('add-actor needs an actor interacting with the service, in a valid document', () => {
        expect(addActor.check(state({ doc: withDatabase, validation: { ok: true } }))).toBe(false);
        expect(addActor.check(state({ doc: withActor, validation: { ok: true } }))).toBe(true);
        // Different names, same shape: still passes.
        expect(addActor.check(state({ doc: withActorDifferentNames, validation: { ok: true } }))).toBe(true);
        // Right shape, invalid document: must not tick.
        expect(addActor.check(state({ doc: withActor, validation: { ok: false } }))).toBe(false);
        // A service used as the interacts "actor": wrong node type, must not tick.
        expect(addActor.check(state({ doc: serviceAsActor, validation: { ok: true } }))).toBe(false);
    });

    it('compose-system needs a system composed of the service and the database, in a valid document', () => {
        expect(composeSystem.check(state({ doc: withActor, validation: { ok: true } }))).toBe(false);
        expect(composeSystem.check(state({ doc: withSystem, validation: { ok: true } }))).toBe(true);
        // Different names, same shape: still passes.
        expect(composeSystem.check(state({ doc: withSystemDifferentNames, validation: { ok: true } }))).toBe(true);
        // Right shape, invalid document: must not tick.
        expect(composeSystem.check(state({ doc: withSystem, validation: { ok: false } }))).toBe(false);
        // composed-of missing the database: must not tick.
        expect(composeSystem.check(state({ doc: composedMissingDatabase, validation: { ok: true } }))).toBe(false);
    });

    it('validate needs the composition AND a fresh validate of the lesson file', () => {
        expect(validate.check(state({ doc: withSystem, commands: [] }))).toBe(false);
        expect(validate.check(state({ doc: withSystem, commands: [validateOutcome(BEGINNER_03.editorFile, true)] }))).toBe(true);
        // Different names, same shape: still passes.
        expect(validate.check(state({ doc: withSystemDifferentNames, commands: [validateOutcome(BEGINNER_03.editorFile, true)] }))).toBe(true);
        // A stale/other-file validate does not count.
        expect(validate.check(state({ doc: withSystem, commands: [validateOutcome('/workspace/other.json', true)] }))).toBe(false);
        // No composition yet: must not tick even with a fresh validate.
        expect(validate.check(state({ doc: withActor, commands: [validateOutcome(BEGINNER_03.editorFile, true)] }))).toBe(false);
    });

    it('links to the next lesson', () => {
        expect(BEGINNER_03.completion.links).toContainEqual({
            to: '?lesson=beginner-05',
            label: 'Next lesson: Add interfaces',
        });
    });
});
