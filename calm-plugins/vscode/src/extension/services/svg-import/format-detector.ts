import type { SvgFormat } from './types';

export function detectSvgFormat(svgContent: string): SvgFormat {
    if (
        svgContent.includes('mxGraphModel') ||
        svgContent.includes('mxfile') ||
        (svgContent.includes('content="') && svgContent.includes('mxCell'))
    ) {
        return 'drawio';
    }
    return 'generic';
}
