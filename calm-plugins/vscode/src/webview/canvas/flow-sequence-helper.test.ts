import { describe, it, expect } from 'vitest';
import { getSourceNodeId, getTargetNodeId, getNodeName, orientEndpoints } from './flow-sequence-helper';
import type { CalmArchitecture } from '../transforms/calm-editor-transformer';

const arch: CalmArchitecture = {
    nodes: [
        { 'unique-id': 'svc-a', name: 'Service A', 'node-type': 'service' },
        { 'unique-id': 'svc-b', name: 'Service B', 'node-type': 'service' },
        { 'unique-id': 'actor-1', name: 'User', 'node-type': 'actor' },
        { 'unique-id': 'container-1', name: 'Platform', 'node-type': 'system' },
    ],
    relationships: [
        { 'unique-id': 'rel-connects', 'relationship-type': { connects: { source: { node: 'svc-a' }, destination: { node: 'svc-b' } } } },
        { 'unique-id': 'rel-interacts', 'relationship-type': { interacts: { actor: 'actor-1', nodes: ['svc-a', 'svc-b'] } } },
        { 'unique-id': 'rel-composed', 'relationship-type': { 'composed-of': { container: 'container-1', nodes: ['svc-a', 'svc-b'] } } },
        { 'unique-id': 'rel-deployed', 'relationship-type': { 'deployed-in': { container: 'container-1', nodes: ['svc-a'] } } },
    ],
};

describe('getSourceNodeId', () => {
    it('resolves connects source', () => {
        expect(getSourceNodeId('rel-connects', arch)).toBe('svc-a');
    });
    it('resolves interacts actor', () => {
        expect(getSourceNodeId('rel-interacts', arch)).toBe('actor-1');
    });
    it('resolves composed-of container', () => {
        expect(getSourceNodeId('rel-composed', arch)).toBe('container-1');
    });
    it('resolves deployed-in container', () => {
        expect(getSourceNodeId('rel-deployed', arch)).toBe('container-1');
    });
    it('returns unknown for missing relationship', () => {
        expect(getSourceNodeId('nonexistent', arch)).toBe('unknown');
    });
});

describe('getTargetNodeId', () => {
    it('resolves connects destination', () => {
        expect(getTargetNodeId('rel-connects', arch)).toBe('svc-b');
    });
    it('resolves interacts first node', () => {
        expect(getTargetNodeId('rel-interacts', arch)).toBe('svc-a');
    });
    it('resolves composed-of first node', () => {
        expect(getTargetNodeId('rel-composed', arch)).toBe('svc-a');
    });
    it('resolves deployed-in first node', () => {
        expect(getTargetNodeId('rel-deployed', arch)).toBe('svc-a');
    });
    it('returns unknown for missing relationship', () => {
        expect(getTargetNodeId('nonexistent', arch)).toBe('unknown');
    });
});

describe('getNodeName', () => {
    it('returns node name when found', () => {
        expect(getNodeName('svc-a', arch)).toBe('Service A');
    });
    it('falls back to node id when not found', () => {
        expect(getNodeName('missing-node', arch)).toBe('missing-node');
    });
    it('returns unknown for empty id', () => {
        expect(getNodeName('', arch)).toBe('unknown');
    });
});

describe('orientEndpoints', () => {
    it('returns source, target for forward direction', () => {
        expect(orientEndpoints('A', 'B', false)).toEqual(['A', 'B']);
    });
    it('swaps for return direction', () => {
        expect(orientEndpoints('A', 'B', true)).toEqual(['B', 'A']);
    });
});
