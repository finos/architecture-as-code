'use client';

import { Handle, Position } from '@xyflow/react';
import type { Node, NodeProps } from '@xyflow/react';
import { User } from 'lucide-react';
import type { ComplianceStatus } from './service-node';
import { borderColors, glowColors } from './service-node';

export type ActorNodeData = {
  label: string;
  description: string;
  complianceStatus: ComplianceStatus;
  nodeType: string;
};

export type ActorNodeType = Node<ActorNodeData, 'actor'>;

export function ActorNode({ data }: NodeProps<ActorNodeType>) {
  return (
    <div
      className={`bg-slate-800/90 backdrop-blur-sm border-2 ${borderColors[data.complianceStatus]} rounded-xl min-w-[160px] max-w-[200px] overflow-hidden shadow-lg ${glowColors[data.complianceStatus]} transition-shadow duration-500`}
      style={{ transition: 'border-color 0.6s ease-out, box-shadow 0.6s ease-out' }}
    >
      <Handle type="target" position={Position.Left} className="!bg-orange-400 !w-2 !h-2 !border-slate-900 !border-2" />
      <div className="bg-gradient-to-r from-orange-900/60 to-orange-800/30 border-b border-orange-600/30 px-3 py-1.5 flex items-center gap-2">
        <div className="flex items-center justify-center h-5 w-5 rounded-md bg-orange-500/20">
          <User className="h-3 w-3 text-orange-400" />
        </div>
        <span className="text-[10px] font-bold text-orange-300 uppercase tracking-widest">Actor</span>
      </div>
      <div className="px-3 py-2.5">
        <div className="text-xs font-semibold text-slate-100 leading-tight">{data.label}</div>
        {data.description && (
          <div className="text-[10px] text-slate-400 mt-1 leading-snug line-clamp-2">{data.description}</div>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-orange-400 !w-2 !h-2 !border-slate-900 !border-2" />
    </div>
  );
}
