import { describe, expect, it } from 'vitest';
import { c4View, projectC4, type C4ArchitectureInput } from '@finos/calm-models/c4';
import { layoutC4View } from './c4Layout.js';

const node = (id: string, type: string) => ({ 'unique-id': id, 'node-type': type, name: id, description: '' });
const composed = (container: string, ...nodes: string[]) => ({
    'unique-id': `${container}-c`,
    'relationship-type': { 'composed-of': { container, nodes } },
});
const connects = (source: string, target: string) => ({
    'unique-id': `${source}-${target}`,
    'relationship-type': { connects: { source: { node: source }, destination: { node: target } } },
});

const architecture: C4ArchitectureInput = {
    nodes: [node('bank', 'ecosystem'), node('core', 'system'), node('api', 'service'), node('db', 'database'), node('vendor', 'system')],
    relationships: [composed('bank', 'core'), composed('core', 'api', 'db'), connects('api', 'db'), connects('api', 'vendor')],
};
const model = projectC4(architecture);
const layout = (level: 'context' | 'container', scope: string) => layoutC4View(c4View(model, level, scope), model, (id) => id === 'core');
const byId = (nodes: ReturnType<typeof layout>['nodes'], id: string) => nodes.find((n) => n.id === id)!;
const inside = (box: { position: { x: number; y: number }; width?: number; height?: number }, point: { x: number; y: number }) =>
    point.x >= box.position.x && point.y >= box.position.y && point.x <= box.position.x + box.width! && point.y <= box.position.y + box.height!;

describe('layoutC4View', () => {
    it('draws the enterprise boundary around the elements inside it at context level', () => {
        const { nodes, edges } = layout('context', 'core');

        const boundary = byId(nodes, 'group:bank');
        expect(boundary.data).toEqual({ label: 'bank', kind: 'Enterprise' });
        expect(inside(boundary, byId(nodes, 'core').position)).toBe(true);
        expect(inside(boundary, byId(nodes, 'vendor').position)).toBe(false);
        expect(edges.map((e) => e.id)).toEqual(['core->vendor']);
        expect(byId(nodes, 'core').data).toMatchObject({ canOpen: true });
        expect(byId(nodes, 'vendor').data).toMatchObject({ canOpen: false });
    });

    it('draws the scope as a boundary around its containers at container level', () => {
        const { nodes, edges } = layout('container', 'core');

        const boundary = byId(nodes, 'group:core');
        expect(boundary.data).toEqual({ label: 'core', kind: 'Software System' });
        expect(inside(boundary, byId(nodes, 'api').position)).toBe(true);
        expect(inside(boundary, byId(nodes, 'db').position)).toBe(true);
        expect(inside(boundary, byId(nodes, 'vendor').position)).toBe(false);
        expect(edges.map((e) => e.id).sort()).toEqual(['api->db', 'api->vendor']);
    });

    it('leaves room for the boundary label below the lowest member', () => {
        const { nodes } = layout('container', 'core');

        const boundary = byId(nodes, 'group:core');
        const lowest = Math.max(byId(nodes, 'api').position.y, byId(nodes, 'db').position.y) + 140;
        expect(boundary.position.y + boundary.height!).toBeGreaterThanOrEqual(lowest + 40);
    });

    it('lays out top to bottom for a narrow screen', () => {
        const { nodes } = layoutC4View(c4View(model, 'container', 'core'), model, () => false, 'TB');

        expect(byId(nodes, 'db').position.y).toBeGreaterThan(byId(nodes, 'api').position.y + 140);
    });
});
