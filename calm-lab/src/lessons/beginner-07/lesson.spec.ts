import { describe, it, expect } from 'vitest';
import { BEGINNER_07 } from './lesson';
import { BEGINNER_06 } from '../beginner-06/lesson';
import { endFiles } from '../chain';
import { startReplay } from '../replay';
import type { CommandOutcome } from '../../cli/outcome';
import type { LessonState } from '../types';

const FIRST_ARCHITECTURE = '/workspace/architectures/my-first-architecture.json';
const SCHEMA = 'https://calm.finos.org/release/1.2/meta/calm.json';

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
const doc = (nodes: unknown[], relationships: unknown[]) => ({ $schema: SCHEMA, nodes, relationships });

// Step 1: actors that interact with a gateway service.
const frontDoorNodes = [node('shopper', 'actor'), node('edge-gateway', 'service')];
const frontDoorRels = [interacts('shopper-to-edge', 'shopper', ['edge-gateway'])];
const frontDoor = doc(frontDoorNodes, frontDoorRels);
// The actor interacts with a database instead of a service: must not tick.
const actorToDatabase = doc([node('shopper', 'actor'), node('orders-db', 'database')], [interacts('shopper-to-db', 'shopper', ['orders-db'])]);

// Step 2: three more services, connected from the gateway.
const serviceNodes = [...frontDoorNodes, node('checkout-service', 'service'), node('stock-service', 'service'), node('billing-service', 'service')];
const serviceRels = [
    ...frontDoorRels,
    connects('edge-to-checkout', 'edge-gateway', 'checkout-service'),
    connects('edge-to-stock', 'edge-gateway', 'stock-service'),
    connects('checkout-to-billing', 'checkout-service', 'billing-service'),
];
const services = doc(serviceNodes, serviceRels);
// Four services, but none connected to another service: must not tick.
const unconnectedServices = doc([...serviceNodes, node('orders-db', 'database')], [...frontDoorRels, connects('checkout-to-db', 'checkout-service', 'orders-db')]);
// Only the gateway and one other service: must not tick.
const tooFewServices = doc(serviceNodes.slice(0, 3), [...frontDoorRels, connects('edge-to-checkout', 'edge-gateway', 'checkout-service')]);

// Step 3: databases connected from services, inside a system.
const dataNodes = [...serviceNodes, node('checkout-db', 'database'), node('stock-db', 'database'), node('shop-platform', 'system')];
const composition = composedOfRel('shop-composition', 'shop-platform', ['edge-gateway', 'checkout-service', 'checkout-db']);
const data = doc(dataNodes, [
    ...serviceRels,
    connects('checkout-to-db', 'checkout-service', 'checkout-db'),
    connects('stock-to-db', 'stock-service', 'stock-db'),
    composition,
]);
// The connects points from the database to the service: must not tick.
const databaseToService = doc(dataNodes, [...serviceRels, connects('db-to-checkout', 'checkout-db', 'checkout-service'), composition]);
// No system that contains the services and databases: must not tick.
const noComposition = doc(dataNodes, [...serviceRels, connects('checkout-to-db', 'checkout-service', 'checkout-db')]);

const validateOutcome = (architecture: string, ok: boolean): CommandOutcome => ({
    command: 'validate',
    files: { architecture },
    ok,
    errorCount: ok ? 0 : 1,
    warningCount: 0,
    snapshot: {},
});
const diffOutcome = (documentA: string, documentB: string, ok: boolean): CommandOutcome => ({
    command: 'diff',
    files: { documentA, documentB },
    ok,
    errorCount: 0,
    warningCount: 0,
    snapshot: {},
});

const state = (over: Partial<LessonState>): LessonState => ({
    doc: null,
    validation: { ok: true },
    commands: [],
    editorFile: BEGINNER_07.editorFile,
    ...over,
});

describe('beginner-07 lesson', () => {
    const [frontDoorStep, servicesStep, dataStep, validate, compare] = BEGINNER_07.steps;

    it('has five steps with unique ids', () => {
        expect(BEGINNER_07.steps).toHaveLength(5);
        expect(new Set(BEGINNER_07.steps.map((step) => step.id)).size).toBe(5);
    });

    it('chains from beginner-06 and opens a new, empty e-commerce file', () => {
        expect(BEGINNER_07.chainsFrom).toBe('beginner-06');
        expect(BEGINNER_07.editorFile).toBe('/workspace/architectures/ecommerce-platform.json');
        expect(BEGINNER_07.editorFile).not.toBe(BEGINNER_06.editorFile);
        expect(BEGINNER_07.seedFiles[FIRST_ARCHITECTURE]).toBe(endFiles(BEGINNER_06)[FIRST_ARCHITECTURE]);
        const seed = JSON.parse(BEGINNER_07.seedFiles[BEGINNER_07.editorFile]);
        expect(seed).toEqual({ $schema: SCHEMA, nodes: [], relationships: [] });
    });

    it('front-door needs an actor that interacts with a service, in a valid document', () => {
        expect(frontDoorStep.check(state({ doc: doc([], []) }))).toBe(false);
        // Different names from the hint: still passes.
        expect(frontDoorStep.check(state({ doc: frontDoor }))).toBe(true);
        // Right shape, invalid document: must not tick.
        expect(frontDoorStep.check(state({ doc: frontDoor, validation: { ok: false } }))).toBe(false);
        expect(frontDoorStep.check(state({ doc: actorToDatabase }))).toBe(false);
    });

    it('services needs four services with a service-to-service connects, in a valid document', () => {
        expect(servicesStep.check(state({ doc: frontDoor }))).toBe(false);
        // Different names from the hint: still passes.
        expect(servicesStep.check(state({ doc: services }))).toBe(true);
        // Right shape, invalid document: must not tick.
        expect(servicesStep.check(state({ doc: services, validation: { ok: false } }))).toBe(false);
        expect(servicesStep.check(state({ doc: unconnectedServices }))).toBe(false);
        expect(servicesStep.check(state({ doc: tooFewServices }))).toBe(false);
    });

    it('data needs a service-to-database connects and a system composed of them, in a valid document', () => {
        expect(dataStep.check(state({ doc: services }))).toBe(false);
        // Different names from the hint: still passes.
        expect(dataStep.check(state({ doc: data }))).toBe(true);
        // Right shape, invalid document: must not tick.
        expect(dataStep.check(state({ doc: data, validation: { ok: false } }))).toBe(false);
        expect(dataStep.check(state({ doc: databaseToService }))).toBe(false);
        expect(dataStep.check(state({ doc: noComposition }))).toBe(false);
    });

    it('validate needs the complete architecture AND a fresh validate of the e-commerce file', () => {
        const editorValidate = validateOutcome(BEGINNER_07.editorFile, true);
        expect(validate.check(state({ doc: data }))).toBe(false);
        expect(validate.check(state({ doc: data, commands: [editorValidate] }))).toBe(true);
        // Validating the first architecture does not count.
        expect(validate.check(state({ doc: data, commands: [validateOutcome(FIRST_ARCHITECTURE, true)] }))).toBe(false);
        expect(validate.check(state({ doc: data, commands: [validateOutcome(BEGINNER_07.editorFile, false)] }))).toBe(false);
        expect(validate.check(state({ doc: services, commands: [editorValidate] }))).toBe(false);
    });

    it('compare needs a successful diff from the first architecture to the e-commerce file', () => {
        expect(compare.check(state({ doc: data }))).toBe(false);
        expect(compare.check(state({ doc: data, commands: [diffOutcome(FIRST_ARCHITECTURE, BEGINNER_07.editorFile, true)] }))).toBe(true);
        // The documents swapped: must not tick.
        expect(compare.check(state({ doc: data, commands: [diffOutcome(BEGINNER_07.editorFile, FIRST_ARCHITECTURE, true)] }))).toBe(false);
        expect(compare.check(state({ doc: data, commands: [diffOutcome(FIRST_ARCHITECTURE, BEGINNER_07.editorFile, false)] }))).toBe(false);
    });

    it('compare needs a fresh diff after the last save of the e-commerce file', async () => {
        const replay = startReplay(BEGINNER_07);
        for (const step of BEGINNER_07.steps) {
            await replay.runHint(step);
        }
        expect(compare.check(await replay.stateFor())).toBe(true);
        expect(replay.outcomes.at(-1)?.files).toEqual({ documentA: FIRST_ARCHITECTURE, documentB: BEGINNER_07.editorFile });
        const edited = JSON.parse(replay.vfs.read(BEGINNER_07.editorFile)!);
        edited.metadata.version = '1.1.0';
        replay.vfs.write(BEGINNER_07.editorFile, JSON.stringify(edited, null, 4));
        expect(compare.check(await replay.stateFor())).toBe(false);
    });

    it('says the beginner track is complete', () => {
        expect(BEGINNER_07.completion.message).toContain('beginner track');
    });
});
