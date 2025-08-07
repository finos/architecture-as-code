import { CalmWidget } from '../../types';

export const JsonViewerWidget: CalmWidget<unknown, object, { context: unknown }> = {
    id: 'json-viewer',
    templatePartial: 'json-viewer-template.html',
    transformToViewModel: (context) => ({ context }),
    validateContext: (_context): _context is unknown => true
};

