import { useCallback, useLayoutEffect, useState } from 'react';
import { EdgeLabelRenderer, useStore } from 'reactflow';
import { THEME } from './theme.js';
import type { DecisionSummary } from './utils/decisionSummary.js';
import { sameNodeGeometry } from './utils/floatingEdges.js';
import { useElementSize } from './hooks/useElementSize.js';
import { useDecisionOverlay } from '../../context/DecisionOverlayContext.js';

/** Above every node, and below a hovered one (z-index 1000), so the hover card covers the callout. */
const CALLOUT_Z_INDEX = 500;

interface DecisionCalloutProps {
    /** The React Flow node the callout hangs below. */
    nodeId: string;
    summary: DecisionSummary;
    presenting: boolean;
    /** Defaults to the node's width. */
    width?: number;
}

/**
 * The decision overlay's callout for one node or container: blocked and why, approved and by whom, or met. It hangs
 * directly below the node, drawn in the edge-label layer so that it is above the other nodes and React Flow's node
 * bounds do not change. It reports its size, so the edge labels and the fit can allow for it, and lets the pointer
 * through to whatever is beneath.
 */
export function DecisionCallout({ nodeId, summary, presenting, width }: DecisionCalloutProps) {
    const node = useStore(useCallback((store) => store.nodeInternals.get(nodeId), [nodeId]), sameNodeGeometry);
    // Searching dims a node through its style. The callout is not inside the node, so it takes the same opacity.
    const opacity = useStore(useCallback((store) => store.nodeInternals.get(nodeId)?.style?.opacity, [nodeId]));
    const { reportCalloutSize } = useDecisionOverlay();
    const [element, setElement] = useState<HTMLDivElement | null>(null);
    const size = useElementSize(element);
    const gap = presenting ? 10 : 6;

    useLayoutEffect(() => {
        if (!size) return;
        reportCalloutSize(nodeId, { width: size.width, height: gap + size.height });
        return () => reportCalloutSize(nodeId, undefined);
    }, [nodeId, size, gap, reportCalloutSize]);

    const position = node?.positionAbsolute;
    if (!position || !node.width || !node.height) {
        return null;
    }

    const blocked = summary.outcome === 'blocked';
    const headSize = presenting ? '20px' : '13px';
    const bodySize = presenting ? '16px' : '12px';
    const accent = blocked ? THEME.colors.error : THEME.colors.success;
    const accentText = blocked ? THEME.colors.errorText : THEME.colors.successText;
    const calloutWidth = width ?? node.width;

    return (
        <EdgeLabelRenderer>
            <div
                ref={setElement}
                data-testid="decision-callout"
                data-outcome={summary.outcome}
                style={{
                    position: 'absolute',
                    transform: `translate(${position.x}px, ${position.y + node.height + gap}px)`,
                    width: summary.outcome === 'met' ? 'max-content' : calloutWidth,
                    maxWidth: calloutWidth,
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
                    opacity,
                    zIndex: CALLOUT_Z_INDEX,
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
        </EdgeLabelRenderer>
    );
}
