import { memo } from 'react';
import { NodeProps, Handle, Position } from 'reactflow';
import { THEME } from './theme';
import { usePresentationMode, type PresentationModeStore } from '../../../theme/usePresentationMode.js';
import { scalePx, useDiagramTextScale, type DiagramTextScaleStore } from '../../../theme/useDiagramTextScale.js';
import { useElementEvaluation } from '../../context/ControlEvaluationContext.js';
import { EvaluationBadge } from './EvaluationBadge.js';
import { useDecisionOverlay } from '../../context/DecisionOverlayContext.js';
import { decisionSummary } from './utils/decisionSummary.js';
import { DecisionCallout } from './DecisionCallout.js';

interface SystemGroupNodeProps extends NodeProps {
  /** Injected for tests; default to the app-wide stores. */
  textScaleStore?: DiagramTextScaleStore;
  presentationStore?: PresentationModeStore;
}

function SystemGroupNodeComponent({ id, data, textScaleStore, presentationStore }: SystemGroupNodeProps) {
  const { presenting } = usePresentationMode(presentationStore);
  const { scale } = useDiagramTextScale(textScaleStore);
  // The children start 80px down. Above 1.5x the presentation label does not fit in that space.
  const labelScale = presenting ? Math.min(scale, 1.5) : scale;
  // A container's own controls, and those of the deployed-in and composed-of relationships it draws.
  const evaluation = useElementEvaluation(data['unique-id']);
  const notMet = evaluation?.status === 'not-met';
  const { showDecisions, subjectLabels } = useDecisionOverlay();
  const summary = showDecisions && evaluation
    ? decisionSummary(evaluation, { elementId: data['unique-id'], subjectLabel: (id) => subjectLabels.get(id) })
    : undefined;
  return (
    <div
      style={{
        background: THEME.colors.group.background,
        border: notMet ? `3px solid ${THEME.colors.error}` : `2px dashed ${THEME.colors.group.border}`,
        borderRadius: '12px',
        padding: '24px',
        width: '100%',
        height: '100%',
        pointerEvents: 'none', // Allow clicks to pass through to child nodes
        transition: 'all 0.3s ease-in-out',
      }}
    >
      {/* Hidden handles to satisfy React Flow; floating edge computes actual attachment */}
      <Handle type="source" position={Position.Right} id="source" style={{ opacity: 0, pointerEvents: 'all' }} />
      <Handle type="target" position={Position.Left} id="target" style={{ opacity: 0, pointerEvents: 'all' }} />
      <div
        style={{
          position: 'absolute',
          top: '12px',
          left: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: presenting ? '6px 16px' : '4px 12px',
          borderRadius: '6px',
          fontWeight: 600,
          fontSize: scalePx(presenting ? 22 : 12, labelScale),
          background: THEME.colors.backgroundSecondary,
          color: THEME.colors.group.label,
          border: `1px solid ${THEME.colors.border}`,
          pointerEvents: 'auto', // Re-enable pointer events for the label so it's clickable
        }}
      >
        <span>{data.label}</span>
        {evaluation && <EvaluationBadge status={evaluation.status} presenting={presenting} scale={labelScale} />}
      </div>
      {/* Below the container, as below a node, so the callout does not cover the nodes inside it. */}
      {summary && <DecisionCallout nodeId={id} summary={summary} presenting={presenting} scale={scale} width={presenting ? 320 : 220} />}
    </div>
  );
}

export const SystemGroupNode = memo(SystemGroupNodeComponent);
