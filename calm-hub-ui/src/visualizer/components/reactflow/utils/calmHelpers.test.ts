import { extractId, extractNodeType, extractRelationshipType, getRelationshipTypeDisplayString } from "./calmHelpers.js";
import { describe, expect, it } from "vitest";

describe('calmHelpers', () => {

    describe('extractId', () => {
        it('should extract unique-id from a node', () => {
            const node = { 'unique-id': 'node-1', 'node-type': 'Component' };
            expect(extractId(node)).toBe('node-1');
        });

        it('should extract unique-id from a relationship', () => {
            const relationship = { 'unique-id': 'rel-1', 'relationship-type': { connects: {} } };
            expect(extractId(relationship)).toBe('rel-1');
        });

        it('should return undefined if unique-id is missing', () => {
            const node = { 'node-type': 'Component' };
            expect(extractId(node)).toBeUndefined();
        });

        it('should return undefined for null input', () => {
            expect(extractId(null)).toBeUndefined();
        });

        it('should return undefined for undefined input', () => {
            expect(extractId(undefined)).toBeUndefined();
        });
    });

    describe('extractNodeType', () => {
        it('should extract node-type from a node', () => {
            const node = { 'unique-id': 'node-1', 'node-type': 'Component' };
            expect(extractNodeType(node)).toBe('Component');
        });

        it('should return undefined if node-type is missing', () => {
            const node = { 'unique-id': 'node-1' };
            expect(extractNodeType(node)).toBeUndefined();
        });

        it('should return undefined for null input', () => {
            expect(extractNodeType(null)).toBeUndefined();
        });

        it('should return undefined for undefined input', () => {
            expect(extractNodeType(undefined)).toBeUndefined();
        });
    });

    describe('extractRelationshipType', () => {
        it('should return correct relationship type for connects', () => {
            const rel = {
                'relationship-type': { connects: { source: {}, destination: {} } },
            };
            expect(extractRelationshipType(rel)).toEqual({ connects: { source: {}, destination: {} } });
        });

        it('should return correct relationship type for interacts', () => {
            const rel = {
                'relationship-type': { interacts: { actor: 'ActorA', nodes: ['Node1', 'Node2'] } },
            };
            expect(extractRelationshipType(rel)).toEqual({ interacts: { actor: 'ActorA', nodes: ['Node1', 'Node2'] } });
        });   

        it('should return correct relationship type for deployed-in', () => {
            const rel = {
                'relationship-type': { 'deployed-in': { container: 'ContainerA', nodes: ['Node1', 'Node2'] } },
            };
            expect(extractRelationshipType(rel)).toEqual({ 'deployed-in': { container: 'ContainerA', nodes: ['Node1', 'Node2'] } });
        });

        it('should return correct relationship type for composed-of', () => {
            const rel = {
                'relationship-type': { 'composed-of': { container: 'ContainerA', nodes: ['Node1', 'Node2'] } },
            };
            expect(extractRelationshipType(rel)).toEqual({ 'composed-of': { container: 'ContainerA', nodes: ['Node1', 'Node2'] } });
        });

        it('should return correct relationship type for options', () => {
            const rel = {
                'relationship-type': { options: { option1: 'OptionA', option2: 'OptionB' } },
            };
            expect(extractRelationshipType(rel)).toEqual({ options: { option1: 'OptionA', option2: 'OptionB' } });
        });

        it('should return undefined for unknown relationship type', () => {
            const rel = {
                'relationship-type': { unknownType: {} },
            };
            expect(extractRelationshipType(rel)).toEqual({ unknownType: {} });
        });

        it('should return undefined if relationship-type is missing', () => {
            const rel = {};
            expect(extractRelationshipType(rel)).toBeUndefined();
        });

        it('should return undefined for null input', () => {
            expect(extractRelationshipType(null)).toBeUndefined();
        });

        it('should return undefined for undefined input', () => {
            expect(extractRelationshipType(undefined)).toBeUndefined();
        });
    });

    describe('getRelationshipTypeDisplayString', () => {
        it('should return "connects" for connects relationship type', () => {
            const relType = { connects: { source: {}, destination: {} } };
            expect(getRelationshipTypeDisplayString(relType)).toBe('connects');
        });

        it('should return "interacts" for interacts relationship type', () => {
            const relType = { interacts: { actor: 'ActorA', nodes: ['Node1', 'Node2'] } };
            expect(getRelationshipTypeDisplayString(relType)).toBe('interacts');
        });

        it('should return "deployed-in" for deployed-in relationship type', () => {
            const relType = { 'deployed-in': { container: 'ContainerA', nodes: ['Node1', 'Node2'] } };
            expect(getRelationshipTypeDisplayString(relType)).toBe('deployed-in');
        });

        it('should return "composed-of" for composed-of relationship type', () => {
            const relType = { 'composed-of': { container: 'ContainerA', nodes: ['Node1', 'Node2'] } };
            expect(getRelationshipTypeDisplayString(relType)).toBe('composed-of');
        });

        it('should return "options" for options relationship type', () => {
            const relType = { options: { option1: 'OptionA', option2: 'OptionB' } };
            expect(getRelationshipTypeDisplayString(relType)).toBe('options');
        });

        it('should return "unknown" for unknown relationship type', () => {
            const relType = { unknownType: {} };
            expect(getRelationshipTypeDisplayString(relType)).toBe('unknown');
        });

        it('should return "unknown" for null input', () => {
            expect(getRelationshipTypeDisplayString(null)).toBe('unknown');
        });

        it('should return "unknown" for undefined input', () => {
            expect(getRelationshipTypeDisplayString(undefined)).toBe('unknown');
        });
    });
});
        