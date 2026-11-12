import type { DecoratorView } from '../contracts/contracts.js';

/**
 * The views Hub draws without an extension, in the `decorator-views` shape that a manifest declares. Field names come
 * from the control-evaluation and deployment decorator Standards.
 */
export const BUILTIN_DECORATOR_VIEWS: readonly DecoratorView[] = [
    {
        id: 'control-evaluation',
        match: { type: 'control-evaluation' },
        label: 'Control evaluations',
        overlay: {
            status: '/status',
            map: { met: 'ok', 'not-met': 'error' },
            hide: ['not-applicable'],
            label: '/control/unique-id',
            key: '/control/unique-id',
            time: '/evaluated-at',
        },
    },
    {
        id: 'deployment',
        match: { type: 'deployment' },
        label: 'Deployments',
        overlay: {
            status: '/status',
            map: { completed: 'ok', 'in-progress': 'info', pending: 'info', 'rolled-back': 'warn', failed: 'error' },
            default: 'info',
            time: '/start-time',
        },
    },
];
