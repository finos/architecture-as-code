import type { CalmRelationshipSchema } from '@finos/calm-models/types';
import type { ControlEvaluationDecorator, ElementEvaluation } from '../../../contracts/contracts.js';

const time = (d: ControlEvaluationDecorator) => Date.parse(d.data?.['evaluated-at'] ?? '');
const control = (d: ControlEvaluationDecorator) => d.data?.control?.['unique-id'];
const counted = (d: ControlEvaluationDecorator) => d.data?.status === 'met' || d.data?.status === 'not-met' || d.data?.status === 'not-applicable';

/**
 * Orders two evaluations newest first: by parsed `evaluated-at` (not by text, so `15:00:00Z` and `15:00:00.000Z`
 * are equal), and on equal times the greater uniqueId counts as newer, so the order never depends on input order.
 * Times that do not parse sort last.
 */
const newerFirst = (a: ControlEvaluationDecorator, b: ControlEvaluationDecorator) => {
    const ta = Number.isNaN(time(a)) ? -Infinity : time(a);
    const tb = Number.isNaN(time(b)) ? -Infinity : time(b);
    if (ta !== tb) return tb - ta;
    return a.uniqueId === b.uniqueId ? 0 : a.uniqueId < b.uniqueId ? 1 : -1;
};

/**
 * The container each containment relationship (`deployed-in` or `composed-of`) is drawn as, by relationship unique-id.
 * The diagram draws such a relationship as its container holding the contained nodes, not as an edge.
 */
export function containersOfContainment(relationships: CalmRelationshipSchema[] = []): Map<string, string> {
    const containers = new Map<string, string>();
    for (const rel of relationships) {
        const type = rel['relationship-type'];
        const container = type?.['deployed-in']?.container ?? type?.['composed-of']?.container;
        if (rel['unique-id'] && container) containers.set(rel['unique-id'], container);
    }
    return containers;
}

/**
 * The result the diagram shows for each element: for every control that named the element in `appliesTo`, the
 * newest evaluation; the element is not met if any of those is not met, met if any is met. Elements whose newest
 * evaluations are all not applicable are left out, so they show nothing.
 *
 * An element that is not drawn on its own counts for the element that draws it, given in `drawnAs`: a containment
 * relationship counts for its container (see {@link containersOfContainment}). The newest evaluation per control is
 * chosen for each element first, and only then folded into the element that draws it, so a newer result on one
 * element never hides a not-met result on another. An evaluation that names several of those elements counts once.
 *
 * Decorators are skipped entirely, before the newest is chosen, when they have no control, an `evaluated-at` that
 * does not parse, or a status other than met, not-met or not-applicable. So an unknown status never makes an
 * element met, and it never hides an older, valid evaluation of the same control.
 */
export function evaluationsByElement(
    decorators: ControlEvaluationDecorator[],
    drawnAs: Map<string, string> = new Map(),
): Map<string, ElementEvaluation> {
    const newest = new Map<string, Map<string, ControlEvaluationDecorator>>();
    for (const d of decorators) {
        const key = control(d);
        if (!key || Number.isNaN(time(d)) || !counted(d)) continue;
        for (const element of new Set(d.appliesTo ?? [])) {
            const byControl = newest.get(element) ?? new Map<string, ControlEvaluationDecorator>();
            newest.set(element, byControl);
            const current = byControl.get(key);
            if (!current || newerFirst(d, current) < 0) byControl.set(key, d);
        }
    }
    // Each drawn element's evaluations, by uniqueId: its own newest per control, and those of the elements it draws.
    const drawn = new Map<string, Map<string, ControlEvaluationDecorator>>();
    for (const [element, byControl] of newest) {
        const target = drawnAs.get(element) ?? element;
        const byId = drawn.get(target) ?? new Map<string, ControlEvaluationDecorator>();
        drawn.set(target, byId);
        for (const d of byControl.values()) byId.set(d.uniqueId, d);
    }
    const result = new Map<string, ElementEvaluation>();
    for (const [element, byId] of drawn) {
        const latest = [...byId.values()]
            .filter((d) => d.data.status !== 'not-applicable')
            .sort((a, b) => (a.data.status !== b.data.status ? (a.data.status === 'not-met' ? -1 : 1)
                : control(a)!.localeCompare(control(b)!) || newerFirst(a, b)));
        if (!latest.length) continue;
        result.set(element, { status: latest.some((d) => d.data.status === 'not-met') ? 'not-met' : 'met', latest });
    }
    return result;
}

const statusRank = (d: ControlEvaluationDecorator) => (d.data?.status === 'not-met' ? 0 : d.data?.status === 'met' ? 1 : 2);

/**
 * Orders evaluations for listing, newest first. One gateway decision writes all its evaluations with the same
 * `evaluated-at`, so among equal times not-met comes before met, before not-applicable or unknown, and then the
 * greater uniqueId first.
 */
export const newestFirst = (decorators: ControlEvaluationDecorator[]) =>
    [...decorators].sort((a, b) => {
        const ta = Number.isNaN(time(a)) ? -Infinity : time(a);
        const tb = Number.isNaN(time(b)) ? -Infinity : time(b);
        if (ta !== tb) return tb - ta;
        return statusRank(a) - statusRank(b) || newerFirst(a, b);
    });
