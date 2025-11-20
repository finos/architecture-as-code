import { useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Shield, AlertTriangle, AlertCircle, User, Globe, Box, Cog, Database, Network, Users, Globe2, FileText, ZoomIn, Info } from 'lucide-react';
import { extractId, extractNodeType } from '@/utils/calmHelpers';

export const CustomNode = ({ data, id }: NodeProps) => {
  const [isHovered, setIsHovered] = useState(false);

  // Get callbacks from data
  const onShowDetails = data.onShowDetails;
  const onJumpToControl = data.onJumpToControl;

  const description = data.description || 'No description available';
  const nodeType = extractNodeType(data) || 'Unknown';
  const detailedArchitecture = data.details?.['detailed-architecture'];

  // Extract AIGF data (if present in node metadata)
  const aigf = data.metadata?.aigf;
  const riskLevel = aigf?.['risk-level'] || null;
  const risks = aigf?.risks || [];
  const mitigations = aigf?.mitigations || [];

  const riskCount = risks.length;
  const mitigationCount = mitigations.length;

  // Extract controls from node (CALM spec compliant)
  const nodeControls = data.controls || {};
  const controlEntries = Object.entries(nodeControls);
  const controlCount = controlEntries.length;

  // Get icon and color for node type
  const getNodeTypeStyle = () => {
    switch (nodeType.toLowerCase()) {
      case 'actor':
        return { icon: User, color: 'hsl(280 75% 60%)', label: 'Actor' };
      case 'ecosystem':
        return { icon: Globe, color: 'hsl(200 70% 60%)', label: 'Ecosystem' };
      case 'system':
        return { icon: Box, color: 'hsl(220 70% 60%)', label: 'System' };
      case 'service':
        return { icon: Cog, color: 'hsl(180 75% 55%)', label: 'Service' };
      case 'database':
      case 'datastore':
      case 'data-store':
        return { icon: Database, color: 'hsl(140 60% 55%)', label: 'Database' };
      case 'network':
        return { icon: Network, color: 'hsl(40 85% 60%)', label: 'Network' };
      case 'ldap':
        return { icon: Users, color: 'hsl(260 65% 60%)', label: 'LDAP' };
      case 'webclient':
        return { icon: Globe2, color: 'hsl(190 80% 60%)', label: 'Web Client' };
      case 'data-asset':
        return { icon: FileText, color: 'hsl(160 60% 55%)', label: 'Data Asset' };
      case 'interface':
        return { icon: Network, color: 'hsl(300 70% 60%)', label: 'Interface' };
      case 'external-service':
        return { icon: Globe2, color: 'hsl(340 65% 60%)', label: 'External Service' };
      default:
        return { icon: Box, color: 'hsl(var(--primary))', label: nodeType };
    }
  };

  const nodeTypeStyle = getNodeTypeStyle();
  const NodeIcon = nodeTypeStyle.icon;

  // Determine border color based on risk level (or node type if no risk)
  const getBorderColor = () => {
    if (riskLevel) {
      switch (riskLevel) {
        case 'critical':
          return "hsl(0 84% 60%)"; // Red
        case 'high':
          return "hsl(25 95% 53%)"; // Orange
        case 'medium':
          return "hsl(48 96% 53%)"; // Yellow
        default:
          return nodeTypeStyle.color;
      }
    }
    return nodeTypeStyle.color;
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="transition-all duration-300 ease-in-out"
      style={{
        background: "hsl(var(--card))",
        border: `2px solid ${getBorderColor()}`,
        borderRadius: "12px",
        padding: "16px",
        minWidth: isHovered ? "300px" : "220px",
        color: "hsl(var(--foreground))",
        fontSize: "14px",
        fontWeight: "500",
        boxShadow: isHovered ? `0 10px 30px -10px ${getBorderColor()} / 0.3` : "none",
      }}
    >
      {/* Hidden handles to satisfy React Flow; floating edge computes actual attachment */}
      <Handle type="source" position={Position.Right} id="source" style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Left} id="target" style={{ opacity: 0 }} />

      <div className="flex items-start justify-between gap-2">
        <div className="font-semibold mb-1 flex-1 flex items-center gap-2">
          <NodeIcon className="w-4 h-4 flex-shrink-0" style={{ color: nodeTypeStyle.color }} />
          <span>{data.label}</span>
          {detailedArchitecture && (
            <div title="Has detailed architecture">
              <ZoomIn className="w-3.5 h-3.5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
            </div>
          )}
        </div>
        {(riskCount > 0 || mitigationCount > 0 || controlCount > 0) && (
          <div className="flex gap-1 items-center">
            {riskCount > 0 && (
              <div
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium"
                style={{
                  background: getBorderColor() + ' / 0.15',
                  color: getBorderColor()
                }}
              >
                <AlertCircle className="w-3 h-3" />
                <span>{riskCount}</span>
              </div>
            )}
            {mitigationCount > 0 && (
              <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-green-500/15 text-green-600 dark:text-green-400 text-xs font-medium">
                <Shield className="w-3 h-3" />
                <span>{mitigationCount}</span>
              </div>
            )}
            {controlCount > 0 && (
              <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-600 dark:text-blue-400 text-xs font-medium">
                <Shield className="w-3 h-3" />
                <span>{controlCount}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {isHovered && (
        <div className="mt-2 space-y-2 animate-fade-in">
          <div className="border-t border-border pt-2">
            <div className="text-xs text-muted-foreground mb-1">Type:</div>
            <div className="text-xs font-medium text-accent">{nodeType}</div>
          </div>
          {riskLevel && (
            <div className="border-t border-border pt-2">
              <div className="text-xs text-muted-foreground mb-1">Risk Level:</div>
              <div className="flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" style={{ color: getBorderColor() }} />
                <span className="text-xs font-medium uppercase" style={{ color: getBorderColor() }}>
                  {riskLevel}
                </span>
              </div>
            </div>
          )}
          {riskCount > 0 && (
            <div className="border-t border-border pt-2">
              <div className="text-xs text-muted-foreground mb-1">AIGF Risks:</div>
              <div className="text-xs text-foreground">
                {risks.map((risk: any, idx: number) => (
                  <div key={idx} className="mb-1">
                    {typeof risk === 'string' ? risk : JSON.stringify(risk)}
                  </div>
                ))}
              </div>
            </div>
          )}
          {mitigationCount > 0 && (
            <div className="border-t border-border pt-2">
              <div className="text-xs text-muted-foreground mb-1">AIGF Mitigations:</div>
              <div className="text-xs text-foreground">
                {mitigations.map((mitigation: any, idx: number) => (
                  <div key={idx} className="mb-1">
                    {typeof mitigation === 'string' ? mitigation : JSON.stringify(mitigation)}
                  </div>
                ))}
              </div>
            </div>
          )}
          {controlCount > 0 && (
            <div className="border-t border-border pt-2">
              <div className="text-xs text-muted-foreground mb-1">Controls:</div>
              <div className="text-xs text-foreground space-y-1">
                {controlEntries.map(([controlId, control]: [string, any], idx: number) => {
                  const nodeId = extractId(data);
                  const controlKey = `${nodeId}/${controlId}`;

                  return (
                    <div
                      key={idx}
                      className="mb-1 p-1.5 rounded hover:bg-accent/20 cursor-pointer transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onJumpToControl) {
                          onJumpToControl(controlKey);
                        }
                      }}
                      title="Click to jump to control definition in JSON"
                    >
                      <div className="font-medium text-blue-600 dark:text-blue-400">{controlId}</div>
                      {control.description && (
                        <div className="text-muted-foreground ml-2">{control.description}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className="border-t border-border pt-2">
            <div className="text-xs text-muted-foreground mb-1">Description:</div>
            <div className="text-xs text-foreground leading-relaxed">{description}</div>
          </div>
          {onShowDetails && (
            <div className="border-t border-border pt-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onShowDetails(data);
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Info className="w-3.5 h-3.5" />
                Show Details
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
