/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback } from 'react';
import { EdgeProps, getBezierPath, EdgeLabelRenderer, useStore } from 'reactflow';
import { Info, Shield, AlertCircle, ArrowRight } from 'lucide-react';
import { getEdgeParams } from './utils/floatingEdges';
import { THEME } from './theme';

export const FloatingEdge = ({
  id,
  source,
  target,
  style = {},
  markerEnd,
  markerStart,
  data,
}: EdgeProps) => {
  const [isHovered, setIsHovered] = useState(false);

  const sourceNode = useStore(useCallback((store) => store.nodeInternals.get(source), [source]));
  const targetNode = useStore(useCallback((store) => store.nodeInternals.get(target), [target]));

  if (!sourceNode || !targetNode) {
    return null;
  }

  const { sx, sy, tx, ty, sourcePos, targetPos } = getEdgeParams(sourceNode, targetNode);

  // Calculate perpendicular offset for bidirectional edges
  const direction = data?.direction;
  const offset = direction ? 20 : 0; // 20px offset for bidirectional edges

  let adjustedSourceX = sx;
  let adjustedSourceY = sy;
  let adjustedTargetX = tx;
  let adjustedTargetY = ty;

  if (offset > 0) {
    // Calculate the perpendicular offset direction
    const dx = tx - sx;
    const dy = ty - sy;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length > 0) {
      // Perpendicular vector (rotate 90 degrees)
      const perpX = -dy / length;
      const perpY = dx / length;

      // Apply offset (backward edges go opposite direction)
      const offsetMultiplier = direction === 'backward' ? -1 : 1;
      adjustedSourceX = sx + perpX * offset * offsetMultiplier;
      adjustedSourceY = sy + perpY * offset * offsetMultiplier;
      adjustedTargetX = tx + perpX * offset * offsetMultiplier;
      adjustedTargetY = ty + perpY * offset * offsetMultiplier;
    }
  }

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX: adjustedSourceX,
    sourceY: adjustedSourceY,
    sourcePosition: sourcePos,
    targetX: adjustedTargetX,
    targetY: adjustedTargetY,
    targetPosition: targetPos,
  });

  const description = data?.description || '';
  const protocol = data?.protocol || '';
  const flowTransitions = data?.flowTransitions || [];
  const hasFlowInfo = flowTransitions.length > 0;

  // Extract AIGF data
  const aigf = data?.metadata?.aigf;
  const controlsApplied = aigf?.['controls-applied'] || [];
  const mitigations = aigf?.mitigations || [];
  const risks = aigf?.risks || [];
  const hasAIGF = controlsApplied.length > 0 || mitigations.length > 0 || risks.length > 0;

  // Extract controls from edge data
  const edgeControls = data?.controls || {};

  // Determine badge color
  const getBadgeStyle = () => {
    if (hasFlowInfo) {
      return {
        background: `${THEME.colors.accent}20`,
        border: THEME.colors.accent,
        iconColor: THEME.colors.accent,
      };
    }
    if (hasAIGF) {
      return {
        background: `${THEME.colors.success}20`,
        border: THEME.colors.success,
        iconColor: THEME.colors.success,
      };
    }
    return {
      background: `${THEME.colors.muted}20`,
      border: THEME.colors.muted,
      iconColor: THEME.colors.muted,
    };
  };

  const badgeStyle = getBadgeStyle();

  return (
    <>
      <path
        id={id}
        style={style}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
        markerStart={markerStart}
      />
      {description && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
              zIndex: 1000,
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="nodrag nopan"
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                border: `2px solid ${badgeStyle.border}`,
                background: badgeStyle.background,
                cursor: 'help',
                transition: 'all 0.2s',
              }}
            >
              {hasFlowInfo ? (
                <ArrowRight style={{ width: '12px', height: '12px', color: badgeStyle.iconColor }} />
              ) : hasAIGF ? (
                <Shield style={{ width: '12px', height: '12px', color: badgeStyle.iconColor }} />
              ) : (
                <Info style={{ width: '12px', height: '12px', color: badgeStyle.iconColor }} />
              )}
            </div>
          </div>

          {isHovered && (
            <div
              style={{
                position: 'fixed',
                left: labelX,
                top: labelY + 40,
                transform: 'translateX(-50%)',
                pointerEvents: 'none',
                zIndex: 10000,
              }}
            >
              <div
                style={{
                  background: THEME.colors.card,
                  border: `1px solid ${THEME.colors.border}`,
                  borderRadius: '8px',
                  boxShadow: THEME.shadows.lg,
                  padding: '12px',
                  minWidth: '300px',
                  maxWidth: '400px',
                }}
              >
                <p style={{ fontSize: '12px', fontWeight: 500, color: THEME.colors.foreground, marginBottom: '8px' }}>
                  {description}
                </p>
                {protocol && (
                  <p style={{ fontSize: '12px', color: THEME.colors.muted, marginBottom: '8px' }}>
                    Protocol: <span style={{ fontFamily: 'monospace', color: THEME.colors.accent }}>{protocol}</span>
                  </p>
                )}

                {/* Flow Transitions */}
                {flowTransitions.length > 0 && (
                  <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: `1px solid ${THEME.colors.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
                      <ArrowRight style={{ width: '12px', height: '12px', color: THEME.colors.accent }} />
                      <span style={{ fontSize: '12px', fontWeight: 500, color: THEME.colors.foreground }}>
                        Flow Transitions {direction && <span style={{ color: THEME.colors.muted }}>({direction})</span>}:
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {flowTransitions.map((transition: any, idx: number) => (
                        <div
                          key={idx}
                          style={{
                            fontSize: '12px',
                            background: THEME.colors.backgroundSecondary,
                            borderRadius: '4px',
                            padding: '8px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ fontFamily: 'monospace', color: THEME.colors.accent, fontWeight: 600 }}>
                              Step {transition.sequence}
                            </span>
                            {transition.flowName && (
                              <span style={{ color: THEME.colors.muted }}>in {transition.flowName}</span>
                            )}
                          </div>
                          {transition.description && (
                            <p style={{ color: THEME.colors.foreground }}>{transition.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Edge Controls */}
                {Object.keys(edgeControls).length > 0 && (
                  <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: `1px solid ${THEME.colors.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
                      <Shield style={{ width: '12px', height: '12px', color: THEME.colors.success }} />
                      <span style={{ fontSize: '12px', fontWeight: 500, color: THEME.colors.foreground }}>
                        Connection Controls:
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {Object.entries(edgeControls).map(([controlId, control]: [string, any]) => (
                        <div
                          key={controlId}
                          style={{
                            fontSize: '12px',
                            background: `${THEME.colors.success}10`,
                            borderRadius: '4px',
                            padding: '8px',
                          }}
                        >
                          <div style={{ fontFamily: 'monospace', color: THEME.colors.success, fontWeight: 600, marginBottom: '4px' }}>
                            {controlId}
                          </div>
                          {control.description && (
                            <p style={{ color: THEME.colors.foreground }}>{control.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Controls Applied */}
                {controlsApplied.length > 0 && (
                  <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: `1px solid ${THEME.colors.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
                      <Shield style={{ width: '12px', height: '12px', color: THEME.colors.success }} />
                      <span style={{ fontSize: '12px', fontWeight: 500, color: THEME.colors.foreground }}>
                        Controls Applied:
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {controlsApplied.map((control: string, idx: number) => (
                        <span
                          key={idx}
                          style={{
                            fontSize: '12px',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: `${THEME.colors.success}20`,
                            color: THEME.colors.success,
                            fontFamily: 'monospace',
                          }}
                        >
                          {control}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mitigations */}
                {mitigations.length > 0 && (
                  <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: `1px solid ${THEME.colors.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
                      <Shield style={{ width: '12px', height: '12px', color: THEME.colors.success }} />
                      <span style={{ fontSize: '12px', fontWeight: 500, color: THEME.colors.foreground }}>
                        Mitigations:
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {mitigations.map((mitigation: any, idx: number) => (
                        <div key={idx} style={{ fontSize: '12px' }}>
                          {typeof mitigation === 'string' ? (
                            <span style={{ fontFamily: 'monospace', color: THEME.colors.success }}>{mitigation}</span>
                          ) : (
                            <div>
                              <span style={{ fontFamily: 'monospace', color: THEME.colors.success }}>{mitigation.id}</span>
                              {mitigation.name && <span style={{ color: THEME.colors.foreground }}> - {mitigation.name}</span>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Risks */}
                {risks.length > 0 && (
                  <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: `1px solid ${THEME.colors.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
                      <AlertCircle style={{ width: '12px', height: '12px', color: THEME.colors.warning }} />
                      <span style={{ fontSize: '12px', fontWeight: 500, color: THEME.colors.foreground }}>
                        Risks:
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {risks.map((risk: any, idx: number) => (
                        <div key={idx} style={{ fontSize: '12px' }}>
                          {typeof risk === 'string' ? (
                            <span style={{ fontFamily: 'monospace', color: THEME.colors.warning }}>{risk}</span>
                          ) : (
                            <div>
                              <span style={{ fontFamily: 'monospace', color: THEME.colors.warning }}>{risk.id}</span>
                              {risk.name && <span style={{ color: THEME.colors.foreground }}> - {risk.name}</span>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {/* Tooltip arrow */}
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '-6px',
                  width: '12px',
                  height: '12px',
                  background: THEME.colors.card,
                  borderLeft: `1px solid ${THEME.colors.border}`,
                  borderTop: `1px solid ${THEME.colors.border}`,
                  transform: 'translateX(-50%) rotate(45deg)',
                }}
              />
            </div>
          )}
        </EdgeLabelRenderer>
      )}
    </>
  );
};
