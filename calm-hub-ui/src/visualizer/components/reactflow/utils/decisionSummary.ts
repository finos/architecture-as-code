import type { ControlEvaluationDecorator, ElementEvaluation } from '../../../contracts/contracts.js';

/** One not-met control in a blocked decision: the control's key and what its first finding requires. */
export interface BlockedControl {
    controlKey: string;
    /** The first finding's description, shown as "Requires: …". */
    requirement?: string;
    /** The element the finding is about, when it is not the element being summarised, by display name if known. */
    subject?: string;
}

/** What the decision overlay says about one element. */
export type DecisionSummary =
    | { outcome: 'blocked'; controls: BlockedControl[]; more: number }
    | { outcome: 'approved'; approver: string; controlKey: string; commit?: string }
    | { outcome: 'met'; reviewer?: string };

export interface DecisionSummaryOptions {
    /** The element being summarised; a finding about it does not name its subject. */
    elementId?: string;
    /** Display name for an element's unique-id; the raw unique-id is used when it returns nothing. */
    subjectLabel?: (id: string) => string | undefined;
    /** How many not-met controls to list before "+N more". */
    limit?: number;
}

const controlKey = (d: ControlEvaluationDecorator) => d.data.control['unique-id'];

/**
 * A connection the code makes that the architecture may not have, written "source->destination" by node unique-ids,
 * named by its nodes' display names when both are known.
 */
function connectionLabel(id: string, subjectLabel?: (id: string) => string | undefined): string | undefined {
    const match = /^([^>]+)->([^>]+)$/.exec(id);
    if (!match || !subjectLabel) return undefined;
    const [source, destination] = [subjectLabel(match[1]), subjectLabel(match[2])];
    return source && destination ? `${source} → ${destination}` : undefined;
}

/**
 * The outcome of the latest decision for one element, for the overlay drawn on the diagram.
 *
 * Any not-met evaluation blocks, whatever else was met: up to `limit` not-met controls are listed, each with its first
 * finding, and the rest are counted in `more`. Otherwise the element is approved when some evaluation names an
 * approver, and only met when none does.
 */
export function decisionSummary(evaluation: ElementEvaluation, options: DecisionSummaryOptions = {}): DecisionSummary {
    const { elementId, subjectLabel, limit = 2 } = options;
    const notMet = evaluation.latest.filter((d) => d.data.status === 'not-met');
    if (notMet.length) {
        return {
            outcome: 'blocked',
            controls: notMet.slice(0, limit).map((d) => {
                const finding = d.data.findings?.[0];
                const subject = finding?.subject && finding.subject !== elementId ? finding.subject : undefined;
                return {
                    controlKey: controlKey(d),
                    requirement: finding?.description,
                    subject: subject && (subjectLabel?.(subject) || connectionLabel(subject, subjectLabel) || subject),
                };
            }),
            more: Math.max(0, notMet.length - limit),
        };
    }
    const met = evaluation.latest.filter((d) => d.data.status === 'met');
    const approved = met.find((d) => d.data.actors?.approver);
    if (approved) {
        const commit = approved.data.change?.commit;
        return {
            outcome: 'approved',
            approver: approved.data.actors!.approver,
            controlKey: controlKey(approved),
            commit: commit ? commit.slice(0, 7) : undefined,
        };
    }
    const reviewer = met.find((d) => d.data.actors?.reviewer)?.data.actors?.reviewer;
    return reviewer ? { outcome: 'met', reviewer } : { outcome: 'met' };
}

/**
 * Display names for the diagram's elements by unique-id, so a finding about another element can name it: a node by
 * its label, a relationship as "source → destination" by its nodes' labels. A relationship drawn as several edges is
 * named by its first.
 */
export function subjectLabelsFor(
    nodes: { id: string; data?: { label?: unknown } }[],
    edges: { source: string; target: string; data?: { 'unique-id'?: string } }[],
): Map<string, string> {
    const labels = new Map<string, string>();
    for (const node of nodes) {
        labels.set(node.id, typeof node.data?.label === 'string' ? node.data.label : node.id);
    }
    for (const edge of edges) {
        const id = edge.data?.['unique-id'];
        if (!id || labels.has(id)) continue;
        labels.set(id, `${labels.get(edge.source) ?? edge.source} → ${labels.get(edge.target) ?? edge.target}`);
    }
    return labels;
}
