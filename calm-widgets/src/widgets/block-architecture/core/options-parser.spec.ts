import { describe, it, expect } from 'vitest';
import { parseOptions } from './options-parser';
import { BlockArchOptions } from '../types';

function raw(json: string): BlockArchOptions {
    return JSON.parse(json);
}

describe('options-parser', () => {
    it('returns defaults when no raw input', () => {
        const out = parseOptions();
        expect(out.includeContainers).toBe('all');
        expect(out.includeChildren).toBe('all');
        expect(out.edges).toBe('connected');
        expect(out.direction).toBe('both');
        expect(out.renderInterfaces).toBe(false);
        expect(out.edgeLabels).toBe('description');
    });

    it('parses CSV strings and trims whitespace', () => {
        const input: BlockArchOptions = {
            'focus-nodes': ' a, b , c ',
            'focus-relationships': 'r1',
            'focus-flows': 'f1,f2',
            'focus-interfaces': 'i1, i2',
            'focus-controls': 'ctrl1,ctrl2',
            'highlight-nodes': 'x, y',
            'node-types': 'db, service'
        };
        const out = parseOptions(input);
        expect(out.focusNodes).toEqual(['a', 'b', 'c']);
        expect(out.focusRelationships).toEqual(['r1']);
        expect(out.focusFlows).toEqual(['f1', 'f2']);
        expect(out.focusInterfaces).toEqual(['i1', 'i2']);
        expect(out.focusControls).toEqual(['ctrl1', 'ctrl2']);
        expect(out.highlightNodes).toEqual(['x', 'y']);
        expect(out.nodeTypes).toEqual(['db', 'service']);
    });

    it('treats empty/whitespace CSV as empty array', () => {
        const input: BlockArchOptions = { 'focus-nodes': ' ,  , ' };
        const out = parseOptions(input);
        expect(out.focusNodes).toEqual([]);
    });

    it('render-interfaces: false by default; true only when explicitly true', () => {
        expect(parseOptions().renderInterfaces).toBe(false);
        expect(parseOptions({ 'render-interfaces': false }).renderInterfaces).toBe(false);
        expect(parseOptions({ 'render-interfaces': true }).renderInterfaces).toBe(true);
    });

    it('passes through link-prefix', () => {
        const out = parseOptions({ 'link-prefix': '/docs/' });
        expect(out.linkPrefix).toBe('/docs/');
    });

    it('parses link-map when provided as object', () => {
        const out = parseOptions(
            raw('{ "link-map": { "a": "/a", "b": "/b" } }')
        );
        expect(out.linkMap).toEqual({ a: '/a', b: '/b' });
    });

    it('parses link-map when provided as JSON string', () => {
        const out = parseOptions({ 'link-map': JSON.stringify({ a: '/a' }) });
        expect(out.linkMap).toEqual({ a: '/a' });
    });

    it('ignores bad JSON for link-map', () => {
        const out = parseOptions({ 'link-map': '{bad json' });
        expect(out.linkMap).toBeUndefined();
    });

    it('accepts valid enum values verbatim', () => {
        const input: BlockArchOptions = {
            'include-containers': 'parents',
            'include-children': 'direct',
            edges: 'seeded',
            direction: 'in',
            'edge-labels': 'none'
        };
        const out = parseOptions(input);
        expect(out.includeContainers).toBe('parents');
        expect(out.includeChildren).toBe('direct');
        expect(out.edges).toBe('seeded');
        expect(out.direction).toBe('in');
        expect(out.edgeLabels).toBe('none');
    });

    it('sets collapse-relationships to true when flag is present', () => {
        const input: BlockArchOptions = {
            'collapse-relationships': true
        };
        const out = parseOptions(input);
        expect(out.collapseRelationships).toBe(true);
    });

    it('keeps collapse-relationships as false by default', () => {
        const input: BlockArchOptions = {
            edges: 'all'
        };
        const out = parseOptions(input);
        expect(out.collapseRelationships).toBe(false);
    });

    it('falls back to defaults on invalid enum values', () => {
        const input = raw(`{
      "include-containers": "maybe",
      "include-children": "kids",
      "edges": "zigzag",
      "direction": "sideways",
      "edge-labels": "mystery"
    }`);
        const out = parseOptions(input);
        expect(out.includeContainers).toBe('all');
        expect(out.includeChildren).toBe('all');
        expect(out.edges).toBe('connected');
        expect(out.direction).toBe('both');
        expect(out.edgeLabels).toBe('description');
    });
});
