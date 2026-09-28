import { describe, it, expect } from 'vitest';
import { BEGINNER_06 } from './lesson';
import type { CommandOutcome } from '../../cli/outcome';
import type { LessonState } from '../types';

const seedDoc = JSON.parse(BEGINNER_06.seedFiles[BEGINNER_06.editorFile]);

const node = (id: string, type: string) => ({ 'unique-id': id, 'node-type': type, name: id, description: 'y' });
const withMetadata = (item: Record<string, unknown>, metadata: unknown) => ({ ...item, metadata });

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

// Step 1: top-level architecture metadata.
const withArchitectureMetadata = { ...seedDoc, metadata: { owner: 'payments-team@example.com', version: '1.0.0', description: 'Payment processing' } };
const withArchitectureMetadataDifferentNames = { ...differentNamesBase, metadata: { owner: 'checkout-team@example.com', version: '2.0.0', description: 'Checkout' } };
// Keys unrelated to the hint's: the step asks for metadata, not for these exact keys.
const withArchitectureMetadataOtherKeys = { ...differentNamesBase, metadata: { 'cost-centre': 'CC-42', region: 'eu-west-1' } };
// An empty metadata object: does not count.
const emptyArchitectureMetadata = { ...seedDoc, metadata: {} };

// Step 2: metadata on the service node.
const withServiceMetadata = {
    ...withArchitectureMetadata,
    nodes: [withMetadata(serviceNode, { owner: 'payments-team@example.com', 'tech-stack': ['Java'] }), databaseNode, ...otherNodes],
};
const withServiceMetadataDifferentNames = {
    ...withArchitectureMetadataDifferentNames,
    nodes: [
        withMetadata(differentNamesBase.nodes[0], { owner: 'checkout-team@example.com', 'tech-stack': ['Go'] }),
        ...differentNamesBase.nodes.slice(1),
    ],
};
const withServiceMetadataOtherKeys = {
    ...withArchitectureMetadataOtherKeys,
    nodes: [withMetadata(differentNamesBase.nodes[0], { runtime: 'node', 'on-call': 'checkout-oncall' }), ...differentNamesBase.nodes.slice(1)],
};
// Metadata on the database instead of the service: must not tick step 2.
const withDatabaseMetadataInstead = {
    ...withArchitectureMetadata,
    nodes: [serviceNode, withMetadata(databaseNode, { owner: 'payments-team@example.com' }), ...otherNodes],
};

// Step 3: metadata on the connects relationship.
const withConnectMetadata = {
    ...withServiceMetadata,
    relationships: [withMetadata(baseConnects, { latency: '< 50ms', encryption: 'TLS' }), ...otherRelationships],
};
const withConnectMetadataDifferentNames = {
    ...withServiceMetadataDifferentNames,
    relationships: [
        withMetadata(connects('checkout-to-orders', 'checkout-service', 'orders-db'), { latency: '< 100ms', encryption: 'mTLS' }),
        differentNamesBase.relationships[1],
        differentNamesBase.relationships[2],
    ],
};
const withConnectMetadataOtherKeys = {
    ...withServiceMetadataOtherKeys,
    relationships: [
        withMetadata(differentNamesBase.relationships[0], { sla: '99.9%', 'data-classification': 'internal' }),
        ...differentNamesBase.relationships.slice(1),
    ],
};
// Metadata on the interacts relationship instead of connects: must not tick step 3.
const withInteractsMetadataInstead = {
    ...withServiceMetadata,
    relationships: [
        baseConnects,
        withMetadata(otherRelationships[0], { note: 'not a connects relationship' }),
        otherRelationships[1],
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
    editorFile: BEGINNER_06.editorFile,
    files: {},
    ...over,
});

describe('beginner-06 lesson', () => {
    const [architectureMetadata, nodeMetadata, relationshipMetadata, validate] = BEGINNER_06.steps;

    it('has four steps with unique ids', () => {
        expect(BEGINNER_06.steps.map((step) => step.id)).toHaveLength(4);
        expect(new Set(BEGINNER_06.steps.map((step) => step.id)).size).toBe(4);
    });

    it('chains from beginner-05', () => {
        expect(BEGINNER_06.chainsFrom).toBe('beginner-05');
        expect(seedDoc.nodes.some((n: Record<string, unknown>) => n['node-type'] === 'service')).toBe(true);
        expect(seedDoc.nodes.some((n: Record<string, unknown>) => n['node-type'] === 'database')).toBe(true);
    });

    it('architecture-metadata needs top-level metadata, in a valid document', () => {
        expect(architectureMetadata.check(state({ doc: seedDoc, validation: { ok: true } }))).toBe(false);
        expect(architectureMetadata.check(state({ doc: withArchitectureMetadata, validation: { ok: true } }))).toBe(true);
        // Different names, same shape: still passes.
        expect(architectureMetadata.check(state({ doc: withArchitectureMetadataDifferentNames, validation: { ok: true } }))).toBe(true);
        // Keys unrelated to the hint's: still passes.
        expect(architectureMetadata.check(state({ doc: withArchitectureMetadataOtherKeys, validation: { ok: true } }))).toBe(true);
        // Right shape, invalid document: must not tick.
        expect(architectureMetadata.check(state({ doc: withArchitectureMetadata, validation: { ok: false } }))).toBe(false);
        // An empty metadata object does not count: must not tick.
        expect(architectureMetadata.check(state({ doc: emptyArchitectureMetadata, validation: { ok: true } }))).toBe(false);
    });

    it('node-metadata needs metadata on a service node, in a valid document', () => {
        expect(nodeMetadata.check(state({ doc: withArchitectureMetadata, validation: { ok: true } }))).toBe(false);
        expect(nodeMetadata.check(state({ doc: withServiceMetadata, validation: { ok: true } }))).toBe(true);
        // Different names, same shape: still passes.
        expect(nodeMetadata.check(state({ doc: withServiceMetadataDifferentNames, validation: { ok: true } }))).toBe(true);
        // Keys unrelated to the hint's: still passes.
        expect(nodeMetadata.check(state({ doc: withServiceMetadataOtherKeys, validation: { ok: true } }))).toBe(true);
        // Right shape, invalid document: must not tick.
        expect(nodeMetadata.check(state({ doc: withServiceMetadata, validation: { ok: false } }))).toBe(false);
        // Metadata on the database instead of the service: must not tick.
        expect(nodeMetadata.check(state({ doc: withDatabaseMetadataInstead, validation: { ok: true } }))).toBe(false);
    });

    it('relationship-metadata needs metadata on the connects relationship, in a valid document', () => {
        expect(relationshipMetadata.check(state({ doc: withServiceMetadata, validation: { ok: true } }))).toBe(false);
        expect(relationshipMetadata.check(state({ doc: withConnectMetadata, validation: { ok: true } }))).toBe(true);
        // Different names, same shape: still passes.
        expect(relationshipMetadata.check(state({ doc: withConnectMetadataDifferentNames, validation: { ok: true } }))).toBe(true);
        // Keys unrelated to the hint's: still passes.
        expect(relationshipMetadata.check(state({ doc: withConnectMetadataOtherKeys, validation: { ok: true } }))).toBe(true);
        // Right shape, invalid document: must not tick.
        expect(relationshipMetadata.check(state({ doc: withConnectMetadata, validation: { ok: false } }))).toBe(false);
        // Metadata on a different relationship (interacts, not connects): must not tick.
        expect(relationshipMetadata.check(state({ doc: withInteractsMetadataInstead, validation: { ok: true } }))).toBe(false);
        // Metadata on a second connects that is not service -> database: must not tick.
        const otherConnects = withMetadata(connects('service-to-service', serviceNode['unique-id'], serviceNode['unique-id']), { latency: '1ms', encryption: 'none' });
        expect(relationshipMetadata.check(state({ doc: { ...withServiceMetadata, relationships: [...withServiceMetadata.relationships, otherConnects] }, validation: { ok: true } }))).toBe(false);
    });

    it('validate needs all three metadata additions AND a fresh validate of the lesson file', () => {
        expect(validate.check(state({ doc: withConnectMetadata, commands: [] }))).toBe(false);
        expect(validate.check(state({ doc: withConnectMetadata, commands: [validateOutcome(BEGINNER_06.editorFile, true)] }))).toBe(true);
        // Different names, same shape: still passes.
        expect(validate.check(state({ doc: withConnectMetadataDifferentNames, commands: [validateOutcome(BEGINNER_06.editorFile, true)] }))).toBe(true);
        // A stale/other-file validate does not count.
        expect(validate.check(state({ doc: withConnectMetadata, commands: [validateOutcome('/workspace/other.json', true)] }))).toBe(false);
        // Missing relationship metadata: must not tick even with a fresh validate.
        expect(validate.check(state({ doc: withServiceMetadata, commands: [validateOutcome(BEGINNER_06.editorFile, true)] }))).toBe(false);
    });

    it('links to the next lesson', () => {
        expect(BEGINNER_06.completion.links).toContainEqual({
            to: '?lesson=beginner-07',
            label: 'Next lesson: Build a complete e-commerce architecture',
        });
    });
});
