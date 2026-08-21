import { describe, it, expect } from 'vitest';
import { detectSvgFormat } from './format-detector';

describe('detectSvgFormat', () => {
    it('detects draw.io SVG with mxGraphModel', () => {
        const svg = '<svg><foreignObject><mxGraphModel><root></root></mxGraphModel></foreignObject></svg>';
        expect(detectSvgFormat(svg)).toBe('drawio');
    });

    it('detects draw.io SVG with mxfile marker', () => {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg"><desc>mxfile host="app.diagrams.net"</desc></svg>';
        expect(detectSvgFormat(svg)).toBe('drawio');
    });

    it('detects draw.io SVG with content attribute containing mxCell', () => {
        const svg = '<svg content="%3CmxGraphModel%3E%3Croot%3E%3CmxCell%20id%3D%220%22%2F%3E%3C%2Froot%3E%3C%2FmxGraphModel%3E"></svg>';
        expect(detectSvgFormat(svg)).toBe('drawio');
    });

    it('returns generic for plain SVG', () => {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="100" height="50"/><text x="30" y="40">Node</text></svg>';
        expect(detectSvgFormat(svg)).toBe('generic');
    });

    it('returns generic for SVG with no diagram metadata', () => {
        const svg = `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
  <g><rect x="50" y="50" width="200" height="80"/></g>
</svg>`;
        expect(detectSvgFormat(svg)).toBe('generic');
    });
});
