import { NodeProps, Handle, Position } from 'reactflow';
import { THEME } from './theme';

export const SystemGroupNode = ({ data }: NodeProps) => {
  return (
    <div
      style={{
        background: THEME.colors.group.background,
        border: `2px dashed ${THEME.colors.group.border}`,
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
          padding: '4px 12px',
          borderRadius: '6px',
          fontWeight: 600,
          fontSize: '12px',
          background: THEME.colors.backgroundSecondary,
          color: THEME.colors.group.label,
          border: `1px solid ${THEME.colors.border}`,
          pointerEvents: 'auto', // Re-enable pointer events for the label so it's clickable
        }}
      >
        {data.label}
      </div>
    </div>
  );
};
