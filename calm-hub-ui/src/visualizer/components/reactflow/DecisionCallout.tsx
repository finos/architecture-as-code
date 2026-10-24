import { THEME } from './theme.js';
import type { DecisionSummary } from './utils/decisionSummary.js';

/**
 * The decision overlay's callout for one node: blocked and why, approved and by whom, or met. It sits directly below
 * the node, absolutely positioned so React Flow's layout and the node's measured size do not change, and lets the
 * pointer through to whatever is beneath.
 */
export function DecisionCallout({ summary, presenting }: { summary: DecisionSummary; presenting: boolean }) {
    const blocked = summary.outcome === 'blocked';
    const headSize = presenting ? '20px' : '13px';
    const bodySize = presenting ? '16px' : '12px';
    const accent = blocked ? THEME.colors.error : THEME.colors.success;
    const accentText = blocked ? THEME.colors.errorText : THEME.colors.successText;

    return (
        <div
            data-testid="decision-callout"
            data-outcome={summary.outcome}
            style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: presenting ? '10px' : '6px',
                width: summary.outcome === 'met' ? 'max-content' : '100%',
                maxWidth: '100%',
                boxSizing: 'border-box',
                padding: presenting ? '10px 14px' : '6px 10px',
                borderRadius: presenting ? '10px' : '8px',
                background: THEME.colors.card,
                border: `${blocked ? 3 : 2}px solid ${accent}`,
                boxShadow: THEME.shadows.sm,
                color: THEME.colors.foreground,
                fontSize: bodySize,
                lineHeight: 1.3,
                textAlign: 'left',
                pointerEvents: 'none',
                overflowWrap: 'anywhere',
                zIndex: 10,
            }}
        >
            {summary.outcome === 'blocked' && (
                <>
                    <div style={{ fontSize: headSize, fontWeight: 700, color: accentText }}>
                        <span aria-hidden="true">✗</span> Blocked
                    </div>
                    {summary.controls.map((c) => (
                        <div key={c.controlKey} data-testid="decision-callout-control" style={{ marginTop: presenting ? '6px' : '4px' }}>
                            <div style={{ fontWeight: 700 }}>{c.controlKey}</div>
                            {c.requirement && <div>Requires: {c.requirement}</div>}
                            {c.subject && <div style={{ color: THEME.colors.muted }}>on {c.subject}</div>}
                        </div>
                    ))}
                    {summary.more > 0 && (
                        <div style={{ marginTop: '4px', color: THEME.colors.muted }}>+{summary.more} more</div>
                    )}
                </>
            )}
            {summary.outcome === 'approved' && (
                <>
                    <div style={{ fontSize: headSize, fontWeight: 700, color: accentText }}>
                        <span aria-hidden="true">✓</span> Approved by {summary.approver}
                    </div>
                    <div style={{ marginTop: '2px', fontWeight: 700 }}>{summary.controlKey}</div>
                    {summary.commit && (
                        <div style={{ color: THEME.colors.muted }}>
                            commit <span style={{ fontFamily: 'monospace' }}>{summary.commit}</span>
                        </div>
                    )}
                </>
            )}
            {summary.outcome === 'met' && (
                <div style={{ fontWeight: 700, color: accentText }}>
                    <span aria-hidden="true">✓</span> Met
                    {summary.reviewer && (
                        <span style={{ fontWeight: 400, color: THEME.colors.muted }}> · reviewed by {summary.reviewer}</span>
                    )}
                </div>
            )}
        </div>
    );
}
