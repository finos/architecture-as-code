import type { DecoratorView } from '../contracts/contracts.js';

/**
 * The views of the built-in extensions, for when the registry cannot be loaded. Keep them the same as the manifests in
 * `calm-hub/src/main/resources/META-INF/calm-extensions/builtin`: `builtinDecoratorViews.test.ts` fails if they differ.
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
