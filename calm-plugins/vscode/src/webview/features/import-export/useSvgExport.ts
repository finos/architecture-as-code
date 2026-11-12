import { useCallback, type RefObject } from 'react';
import { getRectOfNodes, type Node } from 'reactflow';
import { toSvg } from 'html-to-image';
import { postMessage } from '../../vscode-api';

export function useSvgExport(containerRef: RefObject<HTMLDivElement | null>, nodes: Node[]) {
    return useCallback(async () => {
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
    }, [containerRef, nodes]);
}