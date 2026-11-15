import type { ExtensionContribution, ExtensionPoint, ExtensionSummary } from '../model/extensions.js';

/** An extension that contributes `points`, each through one GET route, plus a POST action when asked. */
export function fakeExtension(index: number, points: ExtensionPoint[] = ['screen', 'landing-card', 'designer-tab', 'detail-panel', 'action']): ExtensionSummary {
    const contribution = (id: string, title: string, route: string): ExtensionContribution[] => [{ id, title, route }];
    const contributes: ExtensionSummary['contributes'] = {};
    for (const point of points) {
        contributes[point] =
            point === 'action'
                ? contribution('run', `Run ${index}`, 'run')
                : contribution(point, `${point} ${index}`, 'data');
    }
    return {
        id: `ext-${index}`,
        name: `Extension ${index}`,
        provider: `Provider ${index}`,
        hubApi: 0,
        routes: [
            { id: 'data', method: 'GET', path: '/data', scope: 'authenticated', readOnly: true },
            { id: 'run', method: 'POST', path: '/run', scope: 'authenticated', readOnly: false },
        ],
        contributes,
    };
}

export const fakeExtensions = (count: number, points?: ExtensionPoint[]) =>
    Array.from({ length: count }, (_, index) => fakeExtension(index + 1, points));
