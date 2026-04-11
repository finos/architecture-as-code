'use client';

import type { Node, NodeProps } from '@xyflow/react';
import { ShieldAlert, Network, Cloud, Building2 } from 'lucide-react';

export type TrustBoundaryNodeData = {
  label: string;
  boundaryType: 'network' | 'security-zone' | 'deployment' | 'organizational';
};

export type TrustBoundaryNodeType = Node<TrustBoundaryNodeData, 'trustBoundary'>;

const boundaryConfig: Record<TrustBoundaryNodeData['boundaryType'], { border: string; text: string; bg: string; Icon: typeof ShieldAlert }> = {
  network: { border: 'border-blue-500/30', text: 'text-blue-400', bg: 'bg-blue-500/5', Icon: Network },
  'security-zone': { border: 'border-amber-500/30', text: 'text-amber-400', bg: 'bg-amber-500/5', Icon: ShieldAlert },
  deployment: { border: 'border-teal-500/30', text: 'text-teal-400', bg: 'bg-teal-500/5', Icon: Cloud },
  organizational: { border: 'border-violet-500/30', text: 'text-violet-400', bg: 'bg-violet-500/5', Icon: Building2 },
};

export function TrustBoundaryNode({ data }: NodeProps<TrustBoundaryNodeType>) {
  const config = boundaryConfig[data.boundaryType] ?? boundaryConfig.network;
  const { Icon } = config;

  return (
    <div
      className={`border-dashed border-2 ${config.border} ${config.bg} rounded-2xl w-full h-full relative backdrop-blur-[1px]`}
    >
      <div className={`absolute top-2 left-3 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-900/80`}>
        <Icon className={`h-3 w-3 ${config.text}`} />
        <span className={`text-[10px] font-semibold ${config.text}`}>{data.label}</span>
        <span className="text-[9px] text-slate-600 capitalize">({data.boundaryType})</span>
      </div>
    </div>
  );
}
