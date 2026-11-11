import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Node } from 'reactflow';
import { toSvg } from 'html-to-image';
import { diagramBounds, exportDiagram, exportFileName, labelRects, pngScale, withBackground, withSvgStyles } from './diagramExport.js';

vi.mock('html-to-image', () => ({
    toSvg: vi.fn(async () => `data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg width="10"><g/></svg>')}`),
}));

const node = (id: string, x: number, y: number, extra: Partial<Node> = {}): Node => ({
    id,
    position: { x, y },
    positionAbsolute: { x, y },
    width: 100,
    height: 50,
    data: {},
    ...extra,
});

describe('diagramBounds', () => {
    it('takes in every shown node', () => {
        expect(diagramBounds([node('a', 0, 0), node('b', 300, 200)], new Map())).toEqual({ x: 0, y: 0, width: 400, height: 250 });
    });

    it('leaves out hidden nodes', () => {
        const nodes = [node('a', 0, 0), node('b', 900, 900, { hidden: true })];
        expect(diagramBounds(nodes, new Map())).toEqual({ x: 0, y: 0, width: 100, height: 50 });
    });

    it('takes in the decision callouts below the nodes', () => {
        const bounds = diagramBounds([node('a', 0, 0)], new Map([['a', { width: 220, height: 90 }]]));
        expect(bounds).toEqual({ x: 0, y: 0, width: 220, height: 140 });
    });
});

describe('labelRects', () => {
    const at = (element: Element, left: number, top: number, width: number, height: number) =>
        vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({ left, top, width, height } as DOMRect);

    it('gives each drawn edge label and callout in flow units, as they can reach past the nodes', () => {
        const viewport = document.createElement('div');
        viewport.innerHTML = '<div class="react-flow__edgelabel-renderer"><div></div><div></div></div>';
        const [label, hidden] = viewport.querySelectorAll('.react-flow__edgelabel-renderer > *');
        at(viewport, 100, 50, 0, 0);
        at(label, 120, 30, 80, 40);
        at(hidden, 0, 0, 0, 0);

        expect(labelRects(viewport, 2)).toEqual([{ x: 10, y: -10, width: 40, height: 20 }]);
    });
});

describe('pngScale', () => {
    it('is 2 for a diagram of normal size', () => {
        expect(pngScale(2000, 1500)).toBe(2);
    });

    it('drops so the image stays inside the largest canvas every browser draws', () => {
        const scale = pngScale(8000, 6000);
        expect(scale).toBeLessThan(2);
        // A canvas drops the fraction of a pixel.
        expect(Math.floor(8000 * scale) * Math.floor(6000 * scale)).toBeLessThanOrEqual(16_777_216);
    });

    it('drops so a long, narrow image stays inside the longest canvas side', () => {
        expect(50_080 * pngScale(50_080, 480)).toBeLessThanOrEqual(16_384);
    });
});

describe('exportFileName', () => {
    it('is made from the diagram key', () => {
        expect(exportFileName('finos/Architectures/7', 'svg')).toBe('finos-Architectures-7.svg');
    });

    it('falls back to a plain name for a diagram with no key, such as a dropped file', () => {
        expect(exportFileName(undefined, 'png')).toBe('diagram.png');
    });
});

describe('withBackground', () => {
    it('puts a full-size background first in the SVG, outside the moved diagram', () => {
        expect(withBackground('<svg width="10"><g/></svg>', '#fff')).toBe(
            '<svg width="10"><rect width="100%" height="100%" fill="#fff"/><g/></svg>'
        );
    });
});

describe('withSvgStyles', () => {
    afterEach(() => document.body.replaceChildren());

    it('copies the styles that edges get from style sheets, so a curve is not filled black', () => {
        const css = document.createElement('style');
        css.textContent = '.edge { fill: none; stroke: rgb(0, 0, 255); }';
        const viewport = document.createElement('div');
        viewport.innerHTML = '<svg><path class="edge" d="M0 0"/></svg>';
        document.body.append(css, viewport);
        const copy = `<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div xmlns="http://www.w3.org/1999/xhtml">${
            '<svg xmlns="http://www.w3.org/2000/svg"><path class="edge" d="M0 0"/></svg>'}</div></foreignObject></svg>`;

        const path = new DOMParser().parseFromString(withSvgStyles(copy, viewport), 'image/svg+xml').querySelector('path') as SVGElement;

        expect(path.style.fill).toBe('none');
        expect(path.style.stroke).toBe('rgb(0, 0, 255)');
    });

    it('leaves the image as it is when its shapes do not match the drawn ones', () => {
        const viewport = document.createElement('div');
        viewport.innerHTML = '<svg><path/><path/></svg>';
        const copy = '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><svg><path/></svg></foreignObject></svg>';
        expect(withSvgStyles(copy, viewport)).toBe(copy);
    });
});

describe('exportDiagram', () => {
    const viewport = document.createElement('div');
    const bounds = { x: 100, y: 50, width: 400, height: 200 };
    let saved: { href: string; download: string } | undefined;

    beforeEach(() => {
        saved = undefined;
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
            saved = { href: this.href, download: this.download };
        });
        URL.createObjectURL = vi.fn(() => 'blob:svg');
        URL.revokeObjectURL = vi.fn();
    });

    afterEach(() => vi.restoreAllMocks());

    it('draws the whole diagram with a margin, moved to the top left of the image', async () => {
        await exportDiagram(viewport, bounds, 'svg', 'd.svg', '#fff');
        expect(toSvg).toHaveBeenCalledWith(viewport, expect.objectContaining({
            width: 480,
            height: 280,
            style: { width: '480px', height: '280px', transform: 'translate(-60px, -10px)' },
        }));
    });

    it('saves an SVG with the background', async () => {
        let blob: Blob | undefined;
        vi.mocked(URL.createObjectURL).mockImplementation((b) => {
            blob = b as Blob;
            return 'blob:svg';
        });
        await exportDiagram(viewport, bounds, 'svg', 'd.svg', '#fff');
        expect(saved).toEqual({ href: 'blob:svg', download: 'd.svg' });
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:svg');
        expect(blob?.type).toBe('image/svg+xml');
        expect(await blob?.text()).toBe('<svg width="10"><rect width="100%" height="100%" fill="#fff"/><g/></svg>');
    });

    it('saves a PNG drawn from the SVG, at the scale for its size', async () => {
        let drawn: { src: string; width: number; height: number } | undefined;
        HTMLImageElement.prototype.decode = vi.fn(async () => {});
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
            return {
                drawImage: (image: HTMLImageElement, _x: number, _y: number, width: number, height: number) => {
                    drawn = { src: image.src, width, height };
                },
            } as unknown as CanvasRenderingContext2D;
        });
        const png = new Blob(['png'], { type: 'image/png' });
        vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback, type) => {
            expect(type).toBe('image/png');
            callback(png);
        });
        vi.mocked(URL.createObjectURL).mockImplementation((b) => (b === png ? 'blob:png' : 'blob:other'));

        await exportDiagram(viewport, bounds, 'png', 'd.png', '#fff');

        expect(drawn).toEqual({
            src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg width="10"><rect width="100%" height="100%" fill="#fff"/><g/></svg>')}`,
            width: 960,
            height: 560,
        });
        expect(saved).toEqual({ href: 'blob:png', download: 'd.png' });
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:png');
    });

    it('fails when the canvas makes no PNG', async () => {
        HTMLImageElement.prototype.decode = vi.fn(async () => {});
        // jsdom has no canvas.
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
        vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(null));

        await expect(exportDiagram(viewport, bounds, 'png', 'd.png', '#fff')).rejects.toThrow('PNG');
        expect(saved).toBeUndefined();
    });
});
