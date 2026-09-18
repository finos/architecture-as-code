import { describe, it, expect } from 'vitest';
import { STEPS, SEED_FILES, ARCHITECTURE_FILE, hasOrdersApiNode, hasConnectsRelationship } from './lesson';

const seedDoc = JSON.parse(SEED_FILES[ARCHITECTURE_FILE]);
const withOrders = {
    ...seedDoc,
    nodes: [
        ...seedDoc.nodes,
        { 'unique-id': 'orders-api', 'node-type': 'service', name: 'Orders API', description: 'x' },
    ],
};
const withRelationship = {
    ...withOrders,
    relationships: [
        {
            'unique-id': 'ui-to-orders',
            'relationship-type': {
                connects: { source: { node: 'trading-ui' }, destination: { node: 'orders-api' } },
            },
        },
    ],
};

describe('lesson steps', () => {
    it('has three steps with unique ids', () => {
        expect(STEPS.map((s) => s.id)).toHaveLength(3);
        expect(new Set(STEPS.map((s) => s.id)).size).toBe(3);
    });

    it('step 1 completes on a successful validate of the lesson file', () => {
        const [look] = STEPS;
        expect(look.check({ doc: seedDoc, validation: { ok: true }, hasValidatedOk: false })).toBe(false);
        expect(look.check({ doc: seedDoc, validation: { ok: true }, hasValidatedOk: true })).toBe(true);
    });

    it('step 2 needs the orders-api node AND a valid document', () => {
        const [, add] = STEPS;
        expect(hasOrdersApiNode(seedDoc)).toBe(false);
        expect(hasOrdersApiNode(withOrders)).toBe(true);
        expect(add.check({ doc: withOrders, validation: { ok: false }, hasValidatedOk: true })).toBe(false);
        expect(add.check({ doc: withOrders, validation: { ok: true }, hasValidatedOk: true })).toBe(true);
    });

    it('step 3 needs a connects relationship AND a valid document', () => {
        const [, , connect] = STEPS;
        expect(hasConnectsRelationship(withOrders)).toBe(false);
        expect(hasConnectsRelationship(withRelationship)).toBe(true);
        expect(connect.check({ doc: withRelationship, validation: { ok: true }, hasValidatedOk: true })).toBe(true);
    });
});
