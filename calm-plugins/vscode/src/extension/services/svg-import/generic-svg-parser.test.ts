import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseGenericSvg } from './generic-svg-parser';

const fixture = (name: string) => readFileSync(join(__dirname, '__fixtures__', name), 'utf-8');

describe('parseGenericSvg', () => {
    it('extracts nodes from grouped shapes with text', () => {
        const svg = fixture('generic-simple.svg');
        const result = parseGenericSvg(svg);

        expect(result.sourceFormat).toBe('generic');
        expect(result.nodes.length).toBeGreaterThanOrEqual(3);
    });

    it('extracts labels from text elements', () => {
        const svg = fixture('generic-simple.svg');
        const result = parseGenericSvg(svg);

        const labels = result.nodes.map(n => n.label);
        expect(labels).toContain('API Service');
        expect(labels).toContain('Payment System');
        expect(labels).toContain('User');
    });

    it('classifies shapes correctly', () => {
        const svg = fixture('generic-simple.svg');
        const result = parseGenericSvg(svg);

        const apiService = result.nodes.find(n => n.label === 'API Service');
        const user = result.nodes.find(n => n.label === 'User');

        expect(apiService?.shapeHint).toBe('rounded-rectangle');
        expect(user?.shapeHint).toBe('ellipse');
    });

    it('extracts geometry from shape attributes', () => {
        const svg = fixture('generic-simple.svg');
        const result = parseGenericSvg(svg);

        const apiService = result.nodes.find(n => n.label === 'API Service');
        expect(apiService?.geometry).toEqual({ x: 50, y: 50, width: 180, height: 70 });
    });

    it('detects edges from line elements', () => {
        const svg = fixture('generic-simple.svg');
        const result = parseGenericSvg(svg);

        expect(result.edges.length).toBeGreaterThanOrEqual(1);
    });

    it('returns empty for SVG with no shapes', () => {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text x="10" y="20">Hello</text></svg>';
        const result = parseGenericSvg(svg);
        expect(result.nodes).toHaveLength(0);
    });

    it('detects containment from bounding boxes', () => {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg">
            <g id="outer"><rect x="10" y="10" width="400" height="300"/><text x="30" y="30">Container</text></g>
            <g id="inner"><rect x="50" y="50" width="100" height="60"/><text x="100" y="80">Child</text></g>
        </svg>`;
        const result = parseGenericSvg(svg);

        const child = result.nodes.find(n => n.label === 'Child');
        const container = result.nodes.find(n => n.label === 'Container');
        expect(child?.parentId).toBe(container?.id);
    });

    it('handles tspan text elements', () => {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg">
            <g id="n1">
                <rect x="10" y="10" width="150" height="60"/>
                <text x="85" y="45"><tspan>Multi</tspan><tspan>Line</tspan></text>
            </g>
        </svg>`;
        const result = parseGenericSvg(svg);

        expect(result.nodes).toHaveLength(1);
        expect(result.nodes[0]?.label).toBe('Multi Line');
    });

    it('assigns IDs from group id attribute', () => {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg">
            <g id="my-custom-id">
                <rect x="10" y="10" width="150" height="60"/>
                <text x="85" y="45">Named</text>
            </g>
        </svg>`;
        const result = parseGenericSvg(svg);

        expect(result.nodes[0]?.id).toBe('my-custom-id');
    });

    it('generates fallback IDs when no id attribute', () => {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg">
            <g>
                <rect x="10" y="10" width="150" height="60"/>
                <text x="85" y="45">NoId</text>
            </g>
        </svg>`;
        const result = parseGenericSvg(svg);

        expect(result.nodes[0]?.id).toMatch(/^node-\d+$/);
    });

    it('handles circle shapes', () => {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg">
            <g id="c1">
                <circle cx="100" cy="100" r="40"/>
                <text x="100" y="105">Hub</text>
            </g>
        </svg>`;
        const result = parseGenericSvg(svg);

        expect(result.nodes).toHaveLength(1);
        expect(result.nodes[0]?.shapeHint).toBe('ellipse');
        expect(result.nodes[0]?.geometry).toEqual({ x: 60, y: 60, width: 80, height: 80 });
    });

    it('ignores shapes smaller than minimum size', () => {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg">
            <g id="tiny"><rect x="0" y="0" width="10" height="10"/><text x="5" y="5">Tiny</text></g>
            <g id="big"><rect x="100" y="100" width="150" height="60"/><text x="175" y="130">Big</text></g>
        </svg>`;
        const result = parseGenericSvg(svg);

        expect(result.nodes).toHaveLength(1);
        expect(result.nodes[0]?.label).toBe('Big');
    });

    it('detects polyline edges between nodes', () => {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg">
            <g id="a"><rect x="10" y="10" width="100" height="50"/><text x="60" y="35">A</text></g>
            <g id="b"><rect x="300" y="10" width="100" height="50"/><text x="350" y="35">B</text></g>
            <polyline points="110,35 300,35" stroke="#000"/>
        </svg>`;
        const result = parseGenericSvg(svg);

        expect(result.edges).toHaveLength(1);
        expect(result.edges[0]?.sourceId).toBe('a');
        expect(result.edges[0]?.targetId).toBe('b');
    });

    it('does not create edge when endpoints are too far from nodes', () => {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg">
            <g id="a"><rect x="10" y="10" width="100" height="50"/><text x="60" y="35">A</text></g>
            <line x1="500" y1="500" x2="600" y2="600" stroke="#000"/>
        </svg>`;
        const result = parseGenericSvg(svg);

        expect(result.edges).toHaveLength(0);
    });

    it('handles standalone shapes not in groups with nearby text', () => {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg">
            <rect x="50" y="50" width="120" height="60"/>
            <text x="110" y="80">Standalone</text>
        </svg>`;
        const result = parseGenericSvg(svg);

        expect(result.nodes).toHaveLength(1);
        expect(result.nodes[0]?.label).toBe('Standalone');
    });
});
