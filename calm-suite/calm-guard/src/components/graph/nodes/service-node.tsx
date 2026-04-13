'use client';

import { Handle, Position } from '@xyflow/react';
import type { Node, NodeProps } from '@xyflow/react';
import { Server } from 'lucide-react';

export type ComplianceStatus = 'compliant' | 'partial' | 'non-compliant' | 'unknown';

export const borderColors: Record<ComplianceStatus, string> = {
  compliant: 'border-emerald-500',
  partial: 'border-amber-500',
  'non-compliant': 'border-red-500',
  unknown: 'border-slate-600',
};

export const glowColors: Record<ComplianceStatus, string> = {
  compliant: 'shadow-emerald-500/20',
  partial: 'shadow-amber-500/20',
  'non-compliant': 'shadow-red-500/20',
  unknown: 'shadow-none',
};

export type ServiceNodeData = {
  label: string;
  description: string;
  complianceStatus: ComplianceStatus;
  nodeType: string;
};

export type ServiceNodeType = Node<ServiceNodeData, 'service'>;

export function ServiceNode({ data }: NodeProps<ServiceNodeType>) {
  return (
    <div
      className={`bg-slate-800/90 backdrop-blur-sm border-2 ${borderColors[data.complianceStatus]} rounded-xl min-w-[160px] max-w-[200px] overflow-hidden shadow-lg ${glowColors[data.complianceStatus]} transition-shadow duration-500`}
      style={{ transition: 'border-color 0.6s ease-out, box-shadow 0.6s ease-out' }}
    >
      <Handle type="target" position={Position.Left} className="!bg-blue-400 !w-2 !h-2 !border-slate-900 !border-2" />
      <div className="bg-gradient-to-r from-blue-900/60 to-blue-800/30 border-b border-blue-600/30 px-3 py-1.5 flex items-center gap-2">
        <div className="flex items-center justify-center h-5 w-5 rounded-md bg-blue-500/20">
          <Server className="h-3 w-3 text-blue-400" />
        </div>
        <span className="text-[10px] font-bold text-blue-300 uppercase tracking-widest">Service</span>
      </div>
      <div className="px-3 py-2.5">
        <div className="text-xs font-semibold text-slate-100 leading-tight">{data.label}</div>
        {data.description && (
          <div className="text-[10px] text-slate-400 mt-1 leading-snug line-clamp-2">{data.description}</div>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-blue-400 !w-2 !h-2 !border-slate-900 !border-2" />
    </div>
  );
}
