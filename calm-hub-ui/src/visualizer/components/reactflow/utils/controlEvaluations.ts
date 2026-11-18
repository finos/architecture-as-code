import type { ControlEvaluationDecorator } from '../../../contracts/contracts.js';

const time = (d: ControlEvaluationDecorator) => Date.parse(d.data?.['evaluated-at'] ?? '');

const statusRank = (d: ControlEvaluationDecorator) => (d.data?.status === 'not-met' ? 0 : d.data?.status === 'met' ? 1 : 2);

/**
 * Orders evaluations for listing, newest first. One gateway decision writes all its evaluations with the same
 * `evaluated-at`, so among equal times not-met comes before met, before not-applicable or unknown, and then the
 * greater uniqueId first. Times that do not parse sort last.
 */
export const newestFirst = (decorators: ControlEvaluationDecorator[]) =>
    [...decorators].sort((a, b) => {
        const ta = Number.isNaN(time(a)) ? -Infinity : time(a);
        const tb = Number.isNaN(time(b)) ? -Infinity : time(b);
        if (ta !== tb) return tb - ta;
        if (statusRank(a) !== statusRank(b)) return statusRank(a) - statusRank(b);
        return a.uniqueId === b.uniqueId ? 0 : a.uniqueId < b.uniqueId ? 1 : -1;
    });
