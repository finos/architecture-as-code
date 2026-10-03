import type { SvgFormat } from './types';

export function detectSvgFormat(svgContent: string): SvgFormat {
    if (
        /<mxGraphModel[\s>]/.test(svgContent) ||
        svgContent.includes('%3CmxGraphModel') ||
        svgContent.includes('mxfile') ||
        (svgContent.includes('content="') && svgContent.includes('mxCell'))
    ) {
        return 'drawio';
    }
    return 'generic';
}
