import { THEME } from './theme.js';
import type { ControlEvaluationFinding } from '../../contracts/contracts.js';

/**
 * A not-met finding, framed as what the control requires so it does not read as a pass: "Requires: <description>",
 * then the cause muted, e.g. "(absent)". The finding's subject leads when it is not `elementId` (the element being
 * hovered); with no `elementId`, as in a list, it always leads.
 */
export function FindingText({ finding, elementId }: { finding: ControlEvaluationFinding; elementId?: string }) {
    const subject = finding.subject && finding.subject !== elementId ? `${finding.subject} — ` : '';
    return (
        <>
            {subject}Requires: {finding.description}
            {finding.cause && <span style={{ color: THEME.colors.muted, fontWeight: 400 }}> ({finding.cause})</span>}
        </>
    );
}
