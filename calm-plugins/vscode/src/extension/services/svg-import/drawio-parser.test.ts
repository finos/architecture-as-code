import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseDrawioSvg, parseStyleString, classifyDrawioStyle } from './drawio-parser';

const fixture = (name: string) => readFileSync(join(__dirname, '__fixtures__', name), 'utf-8');

describe('parseDrawioSvg', () => {
    it('parses a simple draw.io SVG with nodes and edges', async () => {
        const svg = fixture('drawio-simple.svg');
        const result = await parseDrawioSvg(svg);

        expect(result.sourceFormat).toBe('drawio');
        expect(result.nodes).toHaveLength(3);
        expect(result.edges).toHaveLength(2);
    });

    it('extracts node labels correctly', async () => {
        const svg = fixture('drawio-simple.svg');
        const result = await parseDrawioSvg(svg);

        const labels = result.nodes.map(n => n.label).sort();
        expect(labels).toEqual(['Database', 'User', 'Web App']);
    });

    it('classifies shapes from draw.io styles', async () => {
        const svg = fixture('drawio-simple.svg');
        const result = await parseDrawioSvg(svg);

        const webApp = result.nodes.find(n => n.label === 'Web App');
        const db = result.nodes.find(n => n.label === 'Database');
        const user = result.nodes.find(n => n.label === 'User');

        expect(webApp?.shapeHint).toBe('rounded-rectangle');
        expect(db?.shapeHint).toBe('cylinder');
        expect(user?.shapeHint).toBe('person');
    });

    it('extracts geometry from mxGeometry', async () => {
        const svg = fixture('drawio-simple.svg');
        const result = await parseDrawioSvg(svg);

        const webApp = result.nodes.find(n => n.label === 'Web App');
        expect(webApp?.geometry).toEqual({ x: 50, y: 80, width: 160, height: 60 });
    });

    it('extracts edge source/target and labels', async () => {
        const svg = fixture('drawio-simple.svg');
        const result = await parseDrawioSvg(svg);

        const httpsEdge = result.edges.find(e => e.label === 'HTTPS');
        expect(httpsEdge).toBeDefined();
        expect(httpsEdge?.sourceId).toBe('2');
        expect(httpsEdge?.targetId).toBe('3');
    });

    it('detects parent-child containment', async () => {
        const svg = fixture('drawio-nested.svg');
        const result = await parseDrawioSvg(svg);

        const authService = result.nodes.find(n => n.label === 'Auth Service');
        const apiGateway = result.nodes.find(n => n.label === 'API Gateway');
        const usersDb = result.nodes.find(n => n.label === 'Users DB');

        expect(authService?.parentId).toBe('vpc');
        expect(apiGateway?.parentId).toBe('vpc');
        expect(usersDb?.parentId).toBe('vpc');
    });

    it('returns empty result for non-draw.io content', async () => {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="100" height="50"/></svg>';
        const result = await parseDrawioSvg(svg);

        expect(result.nodes).toHaveLength(0);
        expect(result.edges).toHaveLength(0);
    });
});

describe('parseStyleString', () => {
    it('parses key=value pairs separated by semicolons', () => {
        const result = parseStyleString('shape=cylinder;fillColor=#dae8fc;strokeColor=#6c8ebf');
        expect(result).toEqual({
            shape: 'cylinder',
            fillColor: '#dae8fc',
            strokeColor: '#6c8ebf',
        });
    });

    it('handles bare values (no =) as flags', () => {
        const result = parseStyleString('rounded=1;whiteSpace=wrap;html;');
        expect(result.rounded).toBe('1');
        expect(result.html).toBe('1');
    });

    it('handles empty string', () => {
        expect(parseStyleString('')).toEqual({});
    });
});

describe('parseDrawioSvg - edge cases', () => {
    it('strips HTML tags from labels', async () => {
        const svg = `<svg content="${encodeURIComponent('<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="2" value="&lt;b&gt;Bold&lt;/b&gt; Text" style="rounded=1;" vertex="1" parent="1"><mxGeometry x="10" y="10" width="100" height="50" as="geometry"/></mxCell></root></mxGraphModel>')}"></svg>`;
        const result = await parseDrawioSvg(svg);

        expect(result.nodes[0]?.label).toBe('Bold Text');
    });

    it('handles inline mxGraphModel (not in content attribute)', async () => {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg">
            <foreignObject>
                <mxGraphModel><root>
                    <mxCell id="0"/>
                    <mxCell id="1" parent="0"/>
                    <mxCell id="n1" value="Inline Node" style="rounded=1;" vertex="1" parent="1">
                        <mxGeometry x="20" y="30" width="120" height="60" as="geometry"/>
                    </mxCell>
                </root></mxGraphModel>
            </foreignObject>
        </svg>`;
        const result = await parseDrawioSvg(svg);

        expect(result.nodes).toHaveLength(1);
        expect(result.nodes[0]?.label).toBe('Inline Node');
    });

    it('skips edges with missing source or target', async () => {
        const svg = `<svg content="${encodeURIComponent('<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="2" value="A" style="rounded=1;" vertex="1" parent="1"><mxGeometry x="10" y="10" width="100" height="50" as="geometry"/></mxCell><mxCell id="3" value="" edge="1" source="2" target="nonexistent" parent="1"><mxGeometry relative="1" as="geometry"/></mxCell></root></mxGraphModel>')}"></svg>`;
        const result = await parseDrawioSvg(svg);

        expect(result.nodes).toHaveLength(1);
        expect(result.edges).toHaveLength(0);
    });

    it('handles edges with no label', async () => {
        const svg = fixture('drawio-nested.svg');
        const result = await parseDrawioSvg(svg);

        const unlabeled = result.edges.find(e => !e.label);
        expect(unlabeled).toBeDefined();
        expect(unlabeled?.label).toBeUndefined();
    });

    it('handles single mxCell (non-array in xml2js)', async () => {
        const svg = `<svg content="${encodeURIComponent('<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="2" value="Solo" style="rounded=1;" vertex="1" parent="1"><mxGeometry x="0" y="0" width="80" height="40" as="geometry"/></mxCell></root></mxGraphModel>')}"></svg>`;
        const result = await parseDrawioSvg(svg);

        expect(result.nodes).toHaveLength(1);
        expect(result.nodes[0]?.label).toBe('Solo');
    });

    it('handles cells with no mxGeometry (skips them)', async () => {
        const svg = `<svg content="${encodeURIComponent('<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="2" value="NoGeo" style="rounded=1;" vertex="1" parent="1"/></root></mxGraphModel>')}"></svg>`;
        const result = await parseDrawioSvg(svg);

        expect(result.nodes).toHaveLength(0);
    });
});

describe('classifyDrawioStyle', () => {
    it('classifies cylinder shape', () => {
        expect(classifyDrawioStyle({ shape: 'cylinder' })).toBe('cylinder');
    });

    it('classifies actor shape', () => {
        expect(classifyDrawioStyle({ shape: 'actor' })).toBe('person');
    });

    it('classifies cloud shape', () => {
        expect(classifyDrawioStyle({ shape: 'cloud' })).toBe('cloud');
    });

    it('classifies rounded rectangle', () => {
        expect(classifyDrawioStyle({ rounded: '1' })).toBe('rounded-rectangle');
    });

    it('defaults to rectangle', () => {
        expect(classifyDrawioStyle({})).toBe('rectangle');
    });

    it('classifies hexagon shape', () => {
        expect(classifyDrawioStyle({ shape: 'hexagon' })).toBe('hexagon');
    });

    it('classifies rhombus as diamond', () => {
        expect(classifyDrawioStyle({ shape: 'rhombus' })).toBe('diamond');
    });

    it('classifies ellipse style flag', () => {
        expect(classifyDrawioStyle({ ellipse: '1' })).toBe('ellipse');
    });

    it('classifies mxgraph.general.user as person', () => {
        expect(classifyDrawioStyle({ shape: 'mxgraph.general.user' })).toBe('person');
    });
});
