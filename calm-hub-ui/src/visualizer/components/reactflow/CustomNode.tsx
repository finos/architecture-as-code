import { useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import {
    Shield,
    AlertTriangle,
    AlertCircle,
    User,
    Globe,
    Box,
    Cog,
    Database,
    Network,
    Users,
    Globe2,
    FileText,
    ZoomIn,
    Info,
} from 'lucide-react';
import { extractId, extractNodeType } from './utils/calmHelpers';
import { THEME, getNodeTypeColor, getRiskLevelColor } from './theme';

// Types for AIGF risk and mitigation data
interface RiskItem {
    id?: string;
    name?: string;
    description?: string;
}

interface MitigationItem {
    id?: string;
    name?: string;
    description?: string;
}

interface ControlItem {
    description?: string;
    [key: string]: unknown;
}

export const CustomNode = ({ data }: NodeProps) => {
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
    const risks: (string | RiskItem)[] = aigf?.risks || [];
    const mitigations: (string | MitigationItem)[] = aigf?.mitigations || [];

    const riskCount = risks.length;
    const mitigationCount = mitigations.length;

    // Extract controls from node (CALM spec compliant)
    const nodeControls: Record<string, ControlItem> = data.controls || {};
    const controlEntries = Object.entries(nodeControls);
    const controlCount = controlEntries.length;

  // Get icon and color for node type
  const getNodeTypeStyle = () => {
    const color = getNodeTypeColor(nodeType);
    switch (nodeType.toLowerCase()) {
      case 'actor':
        return { icon: User, color, label: 'Actor' };
      case 'ecosystem':
        return { icon: Globe, color, label: 'Ecosystem' };
      case 'system':
        return { icon: Box, color, label: 'System' };
      case 'service':
        return { icon: Cog, color, label: 'Service' };
      case 'database':
      case 'datastore':
      case 'data-store':
        return { icon: Database, color, label: 'Database' };
      case 'network':
        return { icon: Network, color, label: 'Network' };
      case 'ldap':
        return { icon: Users, color, label: 'LDAP' };
      case 'webclient':
        return { icon: Globe2, color, label: 'Web Client' };
      case 'data-asset':
        return { icon: FileText, color, label: 'Data Asset' };
      case 'interface':
        return { icon: Network, color, label: 'Interface' };
      case 'external-service':
        return { icon: Globe2, color, label: 'External Service' };
      default:
        return { icon: Box, color: THEME.colors.muted, label: nodeType };
    }
  };

  const nodeTypeStyle = getNodeTypeStyle();
  const NodeIcon = nodeTypeStyle.icon;

  // Determine border color based on risk level (or node type if no risk)
  const getBorderColor = () => {
    if (riskLevel) {
      return getRiskLevelColor(riskLevel);
    }
    return nodeTypeStyle.color;
  };

  const borderColor = getBorderColor();

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        background: THEME.colors.card,
        border: `2px solid ${borderColor}`,
        borderRadius: '12px',
        padding: '16px',
        minWidth: isHovered ? '300px' : '220px',
        color: THEME.colors.foreground,
        fontSize: '14px',
        fontWeight: 500,
        boxShadow: isHovered ? THEME.shadows.lg : THEME.shadows.sm,
        transition: 'all 0.3s ease-in-out',
      }}
    >
      {/* Hidden handles to satisfy React Flow; floating edge computes actual attachment */}
      <Handle type="source" position={Position.Right} id="source" style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Left} id="target" style={{ opacity: 0 }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ fontWeight: 600, marginBottom: '4px', flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <NodeIcon style={{ width: '16px', height: '16px', flexShrink: 0, color: nodeTypeStyle.color }} />
          <span>{data.label}</span>
          {detailedArchitecture && (
            <div title="Has detailed architecture">
              <ZoomIn style={{ width: '14px', height: '14px', flexShrink: 0, color: THEME.colors.accent }} />
            </div>
          )}
        </div>
        {(riskCount > 0 || mitigationCount > 0 || controlCount > 0) && (
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            {riskCount > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 500,
                  background: `${borderColor}20`,
                  color: borderColor,
                }}
              >
                <AlertCircle style={{ width: '12px', height: '12px' }} />
                <span>{riskCount}</span>
              </div>
            )}
            {mitigationCount > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 500,
                  background: `${THEME.colors.success}20`,
                  color: THEME.colors.success,
                }}
              >
                <Shield style={{ width: '12px', height: '12px' }} />
                <span>{mitigationCount}</span>
              </div>
            )}
            {controlCount > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 500,
                  background: `${THEME.colors.accent}20`,
                  color: THEME.colors.accent,
                }}
              >
                <Shield style={{ width: '12px', height: '12px' }} />
                <span>{controlCount}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {isHovered && (
        <div style={{ marginTop: '8px' }}>
          <div style={{ borderTop: `1px solid ${THEME.colors.border}`, paddingTop: '8px' }}>
            <div style={{ fontSize: '12px', color: THEME.colors.muted, marginBottom: '4px' }}>Type:</div>
            <div style={{ fontSize: '12px', fontWeight: 500, color: THEME.colors.accent }}>{nodeType}</div>
          </div>
          {riskLevel && (
            <div style={{ borderTop: `1px solid ${THEME.colors.border}`, paddingTop: '8px', marginTop: '8px' }}>
              <div style={{ fontSize: '12px', color: THEME.colors.muted, marginBottom: '4px' }}>Risk Level:</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <AlertTriangle style={{ width: '12px', height: '12px', color: borderColor }} />
                <span style={{ fontSize: '12px', fontWeight: 500, textTransform: 'uppercase', color: borderColor }}>
                  {riskLevel}
                </span>
              </div>
            </div>
          )}
          {riskCount > 0 && (
            <div style={{ borderTop: `1px solid ${THEME.colors.border}`, paddingTop: '8px', marginTop: '8px' }}>
              <div style={{ fontSize: '12px', color: THEME.colors.muted, marginBottom: '4px' }}>Risks:</div>
              <div style={{ fontSize: '12px', color: THEME.colors.foreground }}>
                {risks.map((risk, idx) => (
                  <div key={idx} style={{ marginBottom: '4px' }}>
                    {typeof risk === 'string' ? risk : (risk.name || risk.id || JSON.stringify(risk))}
                  </div>
                ))}
              </div>
            </div>
          )}
          {mitigationCount > 0 && (
            <div style={{ borderTop: `1px solid ${THEME.colors.border}`, paddingTop: '8px', marginTop: '8px' }}>
              <div style={{ fontSize: '12px', color: THEME.colors.muted, marginBottom: '4px' }}>Mitigations:</div>
              <div style={{ fontSize: '12px', color: THEME.colors.foreground }}>
                {mitigations.map((mitigation, idx) => (
                  <div key={idx} style={{ marginBottom: '4px' }}>
                    {typeof mitigation === 'string' ? mitigation : (mitigation.name || mitigation.id || JSON.stringify(mitigation))}
                  </div>
                ))}
              </div>
            </div>
          )}
          {controlCount > 0 && (
            <div style={{ borderTop: `1px solid ${THEME.colors.border}`, paddingTop: '8px', marginTop: '8px' }}>
              <div style={{ fontSize: '12px', color: THEME.colors.muted, marginBottom: '4px' }}>Controls:</div>
              <div style={{ fontSize: '12px', color: THEME.colors.foreground }}>
                {controlEntries.map(([controlId, control], idx) => {
                  const nodeId = extractId(data);
                  const controlKey = `${nodeId}/${controlId}`;

                  return (
                    <div
                      key={idx}
                      style={{
                        marginBottom: '4px',
                        padding: '6px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onJumpToControl) {
                          onJumpToControl(controlKey);
                        }
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = `${THEME.colors.accent}10`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                      title="Click to jump to control definition"
                    >
                      <div style={{ fontWeight: 500, color: THEME.colors.accent }}>{controlId}</div>
                      {control.description && (
                        <div style={{ color: THEME.colors.muted, marginLeft: '8px' }}>{control.description}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div style={{ borderTop: `1px solid ${THEME.colors.border}`, paddingTop: '8px', marginTop: '8px' }}>
            <div style={{ fontSize: '12px', color: THEME.colors.muted, marginBottom: '4px' }}>Description:</div>
            <div style={{ fontSize: '12px', color: THEME.colors.foreground, lineHeight: 1.5 }}>{description}</div>
          </div>
          {onShowDetails && (
            <div style={{ borderTop: `1px solid ${THEME.colors.border}`, paddingTop: '8px', marginTop: '8px' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onShowDetails(data);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  fontSize: '12px',
                  fontWeight: 500,
                  borderRadius: '6px',
                  background: THEME.colors.accent,
                  color: '#ffffff',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'opacity 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
              >
                <Info style={{ width: '14px', height: '14px' }} />
                Show Details
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
