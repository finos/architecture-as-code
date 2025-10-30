import { useState } from 'react';
import { EdgeProps, getBezierPath, EdgeLabelRenderer } from 'reactflow';
import { Info, Shield, AlertCircle, ArrowRight } from 'lucide-react';

export const CustomEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  markerStart,
  data,
}: EdgeProps) => {
  const [isHovered, setIsHovered] = useState(false);

  // Calculate perpendicular offset for bidirectional edges
  const direction = data?.direction;
  const offset = direction ? 20 : 0; // 20px offset for bidirectional edges

  let adjustedSourceX = sourceX;
  let adjustedSourceY = sourceY;
  let adjustedTargetX = targetX;
  let adjustedTargetY = targetY;

  if (offset > 0) {
    // Calculate the perpendicular offset direction
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length > 0) {
      // Perpendicular vector (rotate 90 degrees)
      const perpX = -dy / length;
      const perpY = dx / length;

      // Apply offset (backward edges go opposite direction)
      const offsetMultiplier = direction === 'backward' ? -1 : 1;
      adjustedSourceX = sourceX + perpX * offset * offsetMultiplier;
      adjustedSourceY = sourceY + perpY * offset * offsetMultiplier;
      adjustedTargetX = targetX + perpX * offset * offsetMultiplier;
      adjustedTargetY = targetY + perpY * offset * offsetMultiplier;
    }
  }

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX: adjustedSourceX,
    sourceY: adjustedSourceY,
    sourcePosition,
    targetX: adjustedTargetX,
    targetY: adjustedTargetY,
    targetPosition,
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
            <div className={`flex items-center justify-center w-6 h-6 rounded-full border-2 transition-all cursor-help ${
              hasFlowInfo
                ? 'bg-blue-500/20 border-blue-500 hover:bg-blue-500/40'
                : hasAIGF
                ? 'bg-green-500/20 border-green-500 hover:bg-green-500/40'
                : 'bg-accent/20 border-accent hover:bg-accent/40'
            }`}>
              {hasFlowInfo ? (
                <ArrowRight className="w-3 h-3 text-blue-600 dark:text-blue-400" />
              ) : hasAIGF ? (
                <Shield className="w-3 h-3 text-green-600 dark:text-green-400" />
              ) : (
                <Info className="w-3 h-3 text-accent" />
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
              className="animate-fade-in"
            >
              <div className="bg-card border-2 border-border rounded-lg shadow-lg p-3 min-w-[400px] max-w-2xl">
                <p className="text-xs font-medium text-foreground mb-2">{description}</p>
                {protocol && (
                  <p className="text-xs text-muted-foreground mb-2">
                    Protocol: <span className="font-mono text-accent">{protocol}</span>
                  </p>
                )}

                {/* Flow Transitions */}
                {flowTransitions.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-border">
                    <div className="flex items-center gap-1 mb-2">
                      <ArrowRight className="w-3 h-3 text-blue-500" />
                      <span className="text-xs font-medium text-foreground">
                        Flow Transitions {direction && <span className="text-muted-foreground">({direction})</span>}:
                      </span>
                    </div>
                    <div className="space-y-2">
                      {flowTransitions.map((transition: any, idx: number) => (
                        <div key={idx} className="text-xs bg-background/60 rounded p-2">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">
                              Step {transition.sequence}
                            </span>
                            {transition.flowName && (
                              <span className="text-muted-foreground">in {transition.flowName}</span>
                            )}
                          </div>
                          {transition.description && (
                            <p className="text-foreground/80">{transition.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Edge Controls */}
                {Object.keys(edgeControls).length > 0 && (
                  <div className="mt-3 pt-2 border-t border-border">
                    <div className="flex items-center gap-1 mb-2">
                      <Shield className="w-3 h-3 text-green-500" />
                      <span className="text-xs font-medium text-foreground">Connection Controls:</span>
                    </div>
                    <div className="space-y-2">
                      {Object.entries(edgeControls).map(([controlId, control]: [string, any]) => (
                        <div key={controlId} className="text-xs bg-green-500/10 rounded p-2">
                          <div className="font-mono text-green-600 dark:text-green-400 font-semibold mb-1">
                            {controlId}
                          </div>
                          {control.description && (
                            <p className="text-foreground/80 mb-1">{control.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Controls Applied */}
                {controlsApplied.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-border">
                    <div className="flex items-center gap-1 mb-2">
                      <Shield className="w-3 h-3 text-green-500" />
                      <span className="text-xs font-medium text-foreground">Controls Applied:</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {controlsApplied.map((control: string, idx: number) => (
                        <span key={idx} className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-600 dark:text-green-400 font-mono">
                          {control}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mitigations */}
                {mitigations.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-border">
                    <div className="flex items-center gap-1 mb-2">
                      <Shield className="w-3 h-3 text-green-500" />
                      <span className="text-xs font-medium text-foreground">Mitigations:</span>
                    </div>
                    <div className="space-y-1">
                      {mitigations.map((mitigation: any, idx: number) => (
                        <div key={idx} className="text-xs">
                          {typeof mitigation === 'string' ? (
                            <span className="font-mono text-green-600 dark:text-green-400">{mitigation}</span>
                          ) : (
                            <div>
                              <span className="font-mono text-green-600 dark:text-green-400">{mitigation.id}</span>
                              {mitigation.name && <span className="text-foreground/80"> - {mitigation.name}</span>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Risks */}
                {risks.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-border">
                    <div className="flex items-center gap-1 mb-2">
                      <AlertCircle className="w-3 h-3 text-orange-500" />
                      <span className="text-xs font-medium text-foreground">Risks:</span>
                    </div>
                    <div className="space-y-1">
                      {risks.map((risk: any, idx: number) => (
                        <div key={idx} className="text-xs">
                          {typeof risk === 'string' ? (
                            <span className="font-mono text-orange-600 dark:text-orange-400">{risk}</span>
                          ) : (
                            <div>
                              <span className="font-mono text-orange-600 dark:text-orange-400">{risk.id}</span>
                              {risk.name && <span className="text-foreground/80"> - {risk.name}</span>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="absolute left-1/2 -translate-x-1/2 -top-1 w-2 h-2 bg-card border-l-2 border-t-2 border-border rotate-45" />
            </div>
          )}
        </EdgeLabelRenderer>
      )}
    </>
  );
};
