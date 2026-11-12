import { useCallback, type RefObject } from 'react';
import { getRectOfNodes, type Node } from 'reactflow';
import { toSvg } from 'html-to-image';
import { postMessage } from '../../vscode-api';

export function useSvgExport(containerRef: RefObject<HTMLDivElement | null>, nodes: Node[], canvasMode: 'architecture' | 'sequence') {
    return useCallback(async () => {
        if (canvasMode === 'sequence') {
            const svgEl = containerRef.current?.querySelector('[data-sequence-svg] svg') as SVGSVGElement | null;
            if (!svgEl) return;
            const computedStyle = getComputedStyle(document.documentElement);
            const background = computedStyle.getPropertyValue('--calm-bg').trim() || '#1e1e1e';
            const clone = svgEl.cloneNode(true) as SVGSVGElement;
            const varRegex = /var\(--[^)]+\)/g;
            clone.querySelectorAll('*').forEach((element) => {
                const style = (element as SVGElement).style;
                if (!style?.cssText) return;
                for (let index = 0; index < style.length; index++) {
                    const property = style[index];
                    const value = style.getPropertyValue(property);
                    if (value.includes('var(')) {
                        const resolved = value.replace(varRegex, (match) => {
                            const variableName = match.slice(4, -1).trim();
                            return computedStyle.getPropertyValue(variableName).trim() || match;
                        });
                        style.setProperty(property, resolved);
                    }
                }
            });
            const backgroundRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            backgroundRect.setAttribute('x', '0');
            backgroundRect.setAttribute('y', '0');
            backgroundRect.setAttribute('width', '100%');
            backgroundRect.setAttribute('height', '100%');
            backgroundRect.setAttribute('fill', background);
            clone.insertBefore(backgroundRect, clone.firstChild);
            const svgText = new XMLSerializer().serializeToString(clone);
            postMessage({ type: 'exportDiagram', format: 'svg', data: svgText });
            return;
        }

        const viewport = containerRef.current?.querySelector('.react-flow__viewport') as HTMLElement | null;
        if (!viewport) return;
        const bounds = getRectOfNodes(nodes);
        if (!bounds.width || !bounds.height) return;
        const margin = 40;
        const imageWidth = Math.ceil(bounds.width + margin * 2);
        const imageHeight = Math.ceil(bounds.height + margin * 2);
        try {
            const dataUrl = await toSvg(viewport, {
                width: imageWidth,
                height: imageHeight,
                style: {
                    width: `${imageWidth}px`,
                    height: `${imageHeight}px`,
                    transform: `translate(${margin - bounds.x}px, ${margin - bounds.y}px)`,
                },
            });
            let svgText = decodeURIComponent(dataUrl.slice(dataUrl.indexOf(',') + 1));
            const background = getComputedStyle(document.documentElement).getPropertyValue('--calm-bg').trim() || '#1e1e1e';
            svgText = svgText.replace(/(<svg[^>]*>)/, `$1<rect x="0" y="0" width="100%" height="100%" fill="${background}"/>`);
            postMessage({ type: 'exportDiagram', format: 'svg', data: svgText });
        } catch (error) {
            console.error('SVG export failed', error);
        }
    }, [canvasMode, containerRef, nodes]);
}