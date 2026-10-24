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
 * The result the diagram shows for each element: for every control that named the element in `appliesTo`, the
 * newest evaluation; the element is not met if any of those is not met, met if any is met. Elements whose newest
 * evaluations are all not applicable are left out, so they show nothing.
 *
 * Decorators are skipped entirely, before the newest is chosen, when they have no control, an `evaluated-at` that
 * does not parse, or a status other than met, not-met or not-applicable. So an unknown status never makes an
 * element met, and it never hides an older, valid evaluation of the same control.
 */
export function evaluationsByElement(decorators: ControlEvaluationDecorator[]): Map<string, ElementEvaluation> {
    const newest = new Map<string, Map<string, ControlEvaluationDecorator>>();
    for (const d of decorators) {
        const key = control(d);
        if (!key || Number.isNaN(time(d)) || !counted(d)) continue;
        for (const element of d.appliesTo ?? []) {
            const byControl = newest.get(element) ?? new Map<string, ControlEvaluationDecorator>();
            newest.set(element, byControl);
            const current = byControl.get(key);
            if (!current || newerFirst(d, current) < 0) byControl.set(key, d);
        }
    }
    const result = new Map<string, ElementEvaluation>();
    for (const [element, byControl] of newest) {
        const latest = [...byControl.values()]
            .filter((d) => d.data.status !== 'not-applicable')
            .sort((a, b) => (a.data.status === b.data.status ? control(a)!.localeCompare(control(b)!) : a.data.status === 'not-met' ? -1 : 1));
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
