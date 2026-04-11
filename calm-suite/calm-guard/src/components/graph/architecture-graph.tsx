'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useAnalysisStore } from '@/store/analysis-store';
import { calmToFlow } from './utils/calm-to-flow';

// Custom node components
import { ServiceNode } from './nodes/service-node';
import { DatabaseNode } from './nodes/database-node';
import { WebClientNode } from './nodes/webclient-node';
import { ActorNode } from './nodes/actor-node';
import { SystemNode } from './nodes/system-node';
import { TrustBoundaryNode } from './nodes/trust-boundary-node';
import { DefaultNode } from './nodes/default-node';

// Custom edge components
import { ProtocolEdge } from './edges/protocol-edge';

const nodeTypes = {
  service: ServiceNode,
  database: DatabaseNode,
  webclient: WebClientNode,
  actor: ActorNode,
  system: SystemNode,
  trustBoundary: TrustBoundaryNode,
  default: DefaultNode,
} as const;

const edgeTypes = {
  protocol: ProtocolEdge,
} as const;

/** Dwell time on each node before moving to the next (ms) */
const TOUR_DWELL_MS = 4000;
/** Zoom level when focused on a single node */
const TOUR_ZOOM = 1.0;
/** Stop touring after this many full loops */
const TOUR_MAX_LOOPS = 2;

/** Node type display labels */
const NODE_TYPE_LABELS: Record<string, string> = {
  actor: 'Actor',
  system: 'System',
  service: 'Service',
  database: 'Database',
  webclient: 'Web Client',
  network: 'Network',
  'data-asset': 'Data Asset',
  ecosystem: 'Ecosystem',
  ldap: 'LDAP',
};

interface FocusedNodeInfo {
  label: string;
  description: string;
  nodeType: string;
  connections: string[];
}

/**
 * TouringCamera — pans/zooms to each node in sequence while analysis runs.
 * Reports the currently focused node so the overlay can display info.
 */
function TouringCamera({
  nodes,
  edges,
  isAnalyzing,
  paused,
  onFocusChange,
}: {
  nodes: Node[];
  edges: Edge[];
  isAnalyzing: boolean;
  paused: boolean;
  onFocusChange: (info: FocusedNodeInfo | null) => void;
}) {
  const { setCenter, fitView } = useReactFlow();
  const indexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const tourableNodes = useMemo(
    () => nodes.filter((n) => n.type !== 'trustBoundary'),
    [nodes],
  );

  // Build a map of node ID → label for connection lookups
  const nodeLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of nodes) {
      map.set(n.id, (n.data as { label?: string })?.label ?? n.id);
    }
    return map;
  }, [nodes]);

  const getConnections = useCallback(
    (nodeId: string): string[] => {
      const connected = new Set<string>();
      for (const edge of edges) {
        if (edge.source === nodeId) {
          connected.add(nodeLabelMap.get(edge.target) ?? edge.target);
        } else if (edge.target === nodeId) {
          connected.add(nodeLabelMap.get(edge.source) ?? edge.source);
        }
      }
      return Array.from(connected);
    },
    [edges, nodeLabelMap],
  );

  const visitNext = useCallback(() => {
    if (tourableNodes.length === 0) return;
    if (pausedRef.current) return;

    const maxVisits = tourableNodes.length * TOUR_MAX_LOOPS;
    if (indexRef.current >= maxVisits) {
      if (timerRef.current) clearInterval(timerRef.current);
      fitView({ padding: 0.4, duration: 800 });
      onFocusChange(null);
      return;
    }

    const node = tourableNodes[indexRef.current % tourableNodes.length];
    const x = (node.position?.x ?? 0) + ((node.measured?.width ?? 200) / 2);
    const y = (node.position?.y ?? 0) + ((node.measured?.height ?? 100) / 2);
    setCenter(x, y, { zoom: TOUR_ZOOM, duration: 1200 });

    const data = node.data as { label?: string; description?: string; nodeType?: string };
    onFocusChange({
      label: data.label ?? node.id,
      description: data.description ?? '',
      nodeType: data.nodeType ?? node.type ?? 'unknown',
      connections: getConnections(node.id),
    });

    indexRef.current += 1;
  }, [tourableNodes, setCenter, fitView, onFocusChange, getConnections]);

  useEffect(() => {
    if (!isAnalyzing || tourableNodes.length === 0) {
      if (!isAnalyzing && tourableNodes.length > 0) {
        fitView({ padding: 0.4, duration: 800 });
      }
      onFocusChange(null);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    indexRef.current = 0;
    visitNext();
    timerRef.current = setInterval(visitNext, TOUR_DWELL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isAnalyzing, tourableNodes.length, visitNext, fitView, onFocusChange]);

  return null;
}

/**
 * Floating overlay that shows info about the currently focused node.
 */
function NodeInfoOverlay({ info }: { info: FocusedNodeInfo | null }) {
  if (!info) return null;

  const typeLabel = NODE_TYPE_LABELS[info.nodeType] ?? info.nodeType;

  return (
    <div className="absolute bottom-4 left-4 z-10 max-w-xs animate-fade-in pointer-events-none">
      <div className="bg-slate-900/90 backdrop-blur-sm border border-slate-700 rounded-lg p-3 shadow-lg">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
            {typeLabel}
          </span>
        </div>
        <p className="text-sm font-medium text-slate-100 leading-tight">{info.label}</p>
        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{info.description}</p>
        {info.connections.length > 0 && (
          <div className="mt-2 pt-2 border-t border-slate-700/50">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
              Connects to
            </p>
            <div className="flex flex-wrap gap-1">
              {info.connections.map((name) => (
                <span
                  key={name}
                  className="text-[10px] px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-300"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface ArchitectureGraphProps {
  compact?: boolean;
}

function ArchitectureGraphInner({ compact = false }: ArchitectureGraphProps) {
  const analysisInput = useAnalysisStore((state) => state.analysisInput);
  const analysisResult = useAnalysisStore((state) => state.analysisResult);
  const status = useAnalysisStore((state) => state.status);
  const [focusedNode, setFocusedNode] = useState<FocusedNodeInfo | null>(null);
  const [tourPaused, setTourPaused] = useState(false);

  const isAnalyzing = status === 'analyzing';

  const { nodes, edges } = useMemo(() => {
    if (!analysisInput) return { nodes: [], edges: [] };
    const architectureAnalysis = analysisResult?.architecture ?? null;
    const riskAssessment = analysisResult?.risk ?? null;
    return calmToFlow(analysisInput, architectureAnalysis, riskAssessment);
  }, [analysisInput, analysisResult]);

  const animatedEdges = useMemo(
    () => edges.map((edge) => ({ ...edge, animated: isAnalyzing })),
    [edges, isAnalyzing]
  );

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={animatedEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.4 }}
        maxZoom={1.2}
        colorMode="dark"
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={true}
        style={{ '--xy-background-color': '#1e293b', backgroundColor: '#1e293b' } as React.CSSProperties}
      >
        <TouringCamera
          nodes={nodes}
          edges={edges}
          isAnalyzing={isAnalyzing}
          paused={tourPaused}
          onFocusChange={setFocusedNode}
        />
        <Background color="#334155" gap={16} />
        {!compact && (
          <Controls className="!bg-slate-800 !border-slate-700 !rounded-lg" />
        )}
        {!compact && (
          <MiniMap
            nodeColor={(node) => {
              const complianceStatus = (node.data as { complianceStatus?: string })?.complianceStatus;
              switch (complianceStatus) {
                case 'compliant':
                  return '#10b981';
                case 'partial':
                  return '#f59e0b';
                case 'non-compliant':
                  return '#ef4444';
                default:
                  return '#475569';
              }
            }}
            className="!bg-slate-900 !border-slate-700 !rounded-lg"
          />
        )}
      </ReactFlow>
      <NodeInfoOverlay info={focusedNode} />
      {isAnalyzing && focusedNode && (
        <button
          onClick={() => setTourPaused((p) => !p)}
          className="absolute bottom-4 right-4 z-10 p-2 bg-slate-900/90 backdrop-blur-sm border border-slate-700 rounded-lg shadow-lg text-slate-300 hover:text-slate-100 hover:border-slate-500 transition-colors"
          title={tourPaused ? 'Resume tour' : 'Pause tour'}
        >
          {tourPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
        </button>
      )}
    </>
  );
}

export const ArchitectureGraph = memo(function ArchitectureGraph({ compact = false }: ArchitectureGraphProps) {
  const analysisInput = useAnalysisStore((state) => state.analysisInput);

  if (!analysisInput) {
    return (
      <div className="w-full h-full min-h-[400px] flex items-center justify-center bg-slate-800 rounded-lg border border-dashed border-slate-700">
        <div className="text-center">
          <p className="text-slate-400 text-sm">Load an architecture to view graph</p>
          <p className="text-slate-600 text-xs mt-1">Select a demo or upload a CALM JSON file</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[400px] relative">
      <ReactFlowProvider>
        <ArchitectureGraphInner compact={compact} />
      </ReactFlowProvider>
    </div>
  );
});
