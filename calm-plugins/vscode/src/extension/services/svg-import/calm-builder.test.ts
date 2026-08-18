import { describe, it, expect } from 'vitest';
import { buildCalmJson } from './calm-builder';
import type { ParsedSvgGraph } from './types';

describe('buildCalmJson', () => {
    it('produces valid CALM JSON for a simple graph', () => {
        const graph: ParsedSvgGraph = {
            sourceFormat: 'drawio',
            nodes: [
                { id: 'v1', label: 'API Gateway', shapeHint: 'rounded-rectangle', geometry: { x: 100, y: 50, width: 200, height: 60 }, styleProps: {} },
                { id: 'v2', label: 'User DB', shapeHint: 'cylinder', geometry: { x: 400, y: 50, width: 120, height: 80 }, styleProps: {} },
            ],
            edges: [
                { id: 'e1', sourceId: 'v1', targetId: 'v2', label: 'JDBC' },
            ],
        };

        const result = buildCalmJson(graph);
        const doc = JSON.parse(result.json);

        expect(doc.$schema).toBe('https://calm.finos.org/release/1.2/meta/calm.json');
        expect(doc.nodes).toHaveLength(2);
        expect(doc.relationships).toHaveLength(1);
        expect(result.nodeCount).toBe(2);
        expect(result.relationshipCount).toBe(1);
        expect(result.warnings).toHaveLength(0);
    });

    it('generates correct node types from shape hints', () => {
        const graph: ParsedSvgGraph = {
            sourceFormat: 'drawio',
            nodes: [
                { id: 'v1', label: 'Admin', shapeHint: 'person', geometry: { x: 0, y: 0, width: 40, height: 60 }, styleProps: {} },
                { id: 'v2', label: 'Orders', shapeHint: 'cylinder', geometry: { x: 200, y: 0, width: 80, height: 80 }, styleProps: {} },
            ],
            edges: [],
        };

        const result = buildCalmJson(graph);
        const doc = JSON.parse(result.json);

        expect(doc.nodes[0]['node-type']).toBe('actor');
        expect(doc.nodes[1]['node-type']).toBe('database');
    });

    it('generates connects relationships from edges', () => {
        const graph: ParsedSvgGraph = {
            sourceFormat: 'drawio',
            nodes: [
                { id: 'a', label: 'Source', shapeHint: 'rectangle', geometry: { x: 0, y: 0, width: 100, height: 50 }, styleProps: {} },
                { id: 'b', label: 'Target', shapeHint: 'rectangle', geometry: { x: 200, y: 0, width: 100, height: 50 }, styleProps: {} },
            ],
            edges: [
                { id: 'e1', sourceId: 'a', targetId: 'b', label: 'HTTP' },
            ],
        };

        const result = buildCalmJson(graph);
        const doc = JSON.parse(result.json);
        const rel = doc.relationships[0];

        expect(rel['relationship-type'].connects.source.node).toBe('system-source');
        expect(rel['relationship-type'].connects.destination.node).toBe('system-target');
        expect(rel.description).toBe('HTTP');
    });

    it('generates deployed-in relationships from containment', () => {
        const graph: ParsedSvgGraph = {
            sourceFormat: 'drawio',
            nodes: [
                { id: 'container', label: 'VPC', shapeHint: 'rectangle', geometry: { x: 0, y: 0, width: 500, height: 400 }, styleProps: {} },
                { id: 'child1', label: 'Service A', shapeHint: 'rounded-rectangle', geometry: { x: 50, y: 50, width: 150, height: 60 }, parentId: 'container', styleProps: {} },
                { id: 'child2', label: 'Service B', shapeHint: 'rounded-rectangle', geometry: { x: 250, y: 50, width: 150, height: 60 }, parentId: 'container', styleProps: {} },
            ],
            edges: [],
        };

        const result = buildCalmJson(graph);
        const doc = JSON.parse(result.json);
        const deployedIn = doc.relationships.find((r: any) => r['relationship-type']['deployed-in']);

        expect(deployedIn).toBeDefined();
        expect(deployedIn['relationship-type']['deployed-in'].container).toBe('network-vpc');
        expect(deployedIn['relationship-type']['deployed-in'].nodes).toHaveLength(2);
    });

    it('preserves layout in metadata._layout', () => {
        const graph: ParsedSvgGraph = {
            sourceFormat: 'drawio',
            nodes: [
                { id: 'v1', label: 'Node', shapeHint: 'rectangle', geometry: { x: 123.5, y: 456.7, width: 200, height: 60 }, styleProps: {} },
            ],
            edges: [],
        };

        const result = buildCalmJson(graph);
        const doc = JSON.parse(result.json);

        expect(doc.metadata._layout['system-node']).toEqual({ x: 124, y: 457, w: 200, h: 60 });
    });

    it('warns about unresolved edges', () => {
        const graph: ParsedSvgGraph = {
            sourceFormat: 'drawio',
            nodes: [
                { id: 'v1', label: 'Only Node', shapeHint: 'rectangle', geometry: { x: 0, y: 0, width: 100, height: 50 }, styleProps: {} },
            ],
            edges: [
                { id: 'e1', sourceId: 'v1', targetId: 'missing' },
            ],
        };

        const result = buildCalmJson(graph);
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0]).toContain('could not resolve');
    });

    it('generates unique IDs from labels', () => {
        const graph: ParsedSvgGraph = {
            sourceFormat: 'drawio',
            nodes: [
                { id: 'v1', label: 'My Great Service!', shapeHint: 'rounded-rectangle', geometry: { x: 0, y: 0, width: 100, height: 50 }, styleProps: {} },
            ],
            edges: [],
        };

        const result = buildCalmJson(graph);
        const doc = JSON.parse(result.json);
        expect(doc.nodes[0]['unique-id']).toBe('service-my-great-service');
    });

    it('handles nodes with empty labels', () => {
        const graph: ParsedSvgGraph = {
            sourceFormat: 'drawio',
            nodes: [
                { id: 'v1', label: '', shapeHint: 'rectangle', geometry: { x: 0, y: 0, width: 100, height: 50 }, styleProps: {} },
            ],
            edges: [],
        };

        const result = buildCalmJson(graph);
        const doc = JSON.parse(result.json);
        expect(doc.nodes[0]['unique-id']).toBe('system-1');
        expect(doc.nodes[0].name).toBe('Unnamed system 1');
    });

    it('preserves fill and font colors as fidelity-style metadata', () => {
        const graph: ParsedSvgGraph = {
            sourceFormat: 'drawio',
            nodes: [
                { id: 'v1', label: 'Styled', shapeHint: 'rounded-rectangle', geometry: { x: 0, y: 0, width: 100, height: 50 }, styleProps: { fillColor: '#1c4587', fontColor: '#ffffff' } },
            ],
            edges: [],
        };

        const result = buildCalmJson(graph);
        const doc = JSON.parse(result.json);
        expect(doc.nodes[0].metadata).toEqual({
            'fidelity-style': { background: '#1c4587', text: '#ffffff' },
        });
    });

    it('omits fidelity-style when no colors are set', () => {
        const graph: ParsedSvgGraph = {
            sourceFormat: 'drawio',
            nodes: [
                { id: 'v1', label: 'Plain', shapeHint: 'rectangle', geometry: { x: 0, y: 0, width: 100, height: 50 }, styleProps: {} },
            ],
            edges: [],
        };

        const result = buildCalmJson(graph);
        const doc = JSON.parse(result.json);
        expect(doc.nodes[0].metadata).toBeUndefined();
    });

    it('detects containers by geometry when no explicit parentId', () => {
        const graph: ParsedSvgGraph = {
            sourceFormat: 'drawio',
            nodes: [
                { id: 'c1', label: 'ECTA Zone', shapeHint: 'rounded-rectangle', geometry: { x: 0, y: 0, width: 600, height: 400 }, styleProps: { dashed: '1', fillColor: 'none' } },
                { id: 'n1', label: 'API', shapeHint: 'rounded-rectangle', geometry: { x: 50, y: 50, width: 150, height: 60 }, styleProps: { fillColor: '#38761d' } },
                { id: 'n2', label: 'DB', shapeHint: 'cylinder', geometry: { x: 300, y: 50, width: 100, height: 80 }, styleProps: { fillColor: '#1c4587' } },
            ],
            edges: [],
        };

        const result = buildCalmJson(graph);
        const doc = JSON.parse(result.json);
        const deployedIn = doc.relationships.find((r: any) => r['relationship-type']['deployed-in']);

        expect(deployedIn).toBeDefined();
        expect(deployedIn['relationship-type']['deployed-in'].container).toBe('network-ecta-zone');
        expect(deployedIn['relationship-type']['deployed-in'].nodes).toContain('service-api');
        expect(deployedIn['relationship-type']['deployed-in'].nodes).toContain('database-db');
    });

    it('splits multi-line labels into name and description', () => {
        const graph: ParsedSvgGraph = {
            sourceFormat: 'drawio',
            nodes: [
                { id: 'v1', label: 'ECTA\nEnterprise Click to Agree [AP167757]', shapeHint: 'rounded-rectangle', geometry: { x: 0, y: 0, width: 100, height: 50 }, styleProps: {} },
            ],
            edges: [],
        };

        const result = buildCalmJson(graph);
        const doc = JSON.parse(result.json);
        expect(doc.nodes[0].name).toBe('ECTA');
        expect(doc.nodes[0].description).toBe('Enterprise Click to Agree [AP167757]');
        expect(doc.nodes[0]['unique-id']).toBe('service-ecta');
    });
});
