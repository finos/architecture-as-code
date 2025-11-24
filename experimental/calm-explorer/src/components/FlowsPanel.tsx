import { Card } from "./ui/card";
import { GitBranch, Shield, AlertCircle, ChevronRight } from "lucide-react";
import { ScrollArea } from "./ui/scroll-area";

interface FlowsPanelProps {
  flows: any[];
  onTransitionClick?: (relationshipId: string) => void;
}

export const FlowsPanel = ({ flows, onTransitionClick }: FlowsPanelProps) => {
  if (!flows || flows.length === 0) return null;

  return (
    <Card className="h-full flex flex-col border-border bg-card">
      <div className="flex items-center gap-2 p-3 border-b border-border">
        <GitBranch className="w-4 h-4 text-accent" />
        <h2 className="font-semibold text-sm">Business Flows</h2>
        <span className="text-xs text-muted-foreground ml-auto">
          {flows.length} {flows.length === 1 ? 'flow' : 'flows'}
        </span>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {flows.map((flow: any) => (
            <div
              key={flow['unique-id']}
              className="rounded-lg border border-border bg-card/50 overflow-hidden"
            >
              {/* Flow Header */}
              <div className="p-2 bg-accent/10 border-b border-border">
                <h3 className="font-semibold text-sm mb-0.5">{flow.name}</h3>
                {flow.description && (
                  <p className="text-xs text-muted-foreground">{flow.description}</p>
                )}
              </div>

              {/* Transitions */}
              <div className="p-2 space-y-1">
                {flow.transitions?.map((transition: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 p-1.5 rounded hover:bg-accent/5 transition-colors cursor-pointer group"
                    onClick={() => onTransitionClick?.(transition['relationship-unique-id'])}
                  >
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-medium">
                      {transition['sequence-number']}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground leading-snug">
                        {transition.description}
                      </p>
                      {transition['relationship-unique-id'] && (
                        <span className="text-xs font-mono text-muted-foreground/70">
                          {transition['relationship-unique-id']}
                        </span>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </div>
                ))}
              </div>

              {/* AIGF Governance (if present) */}
              {flow['aigf-governance'] && (
                <div className="px-2 pb-2">
                  <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-1.5 space-y-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Shield className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                      <span className="text-xs font-medium text-foreground">AIGF Governance</span>
                    </div>

                    {flow['aigf-governance']['mitigations-applied']?.length > 0 && (
                      <div className="flex items-start gap-1.5">
                        <Shield className="w-3 h-3 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <span className="text-xs text-muted-foreground">Mitigations: </span>
                          <span className="text-xs font-mono text-green-600 dark:text-green-400">
                            {flow['aigf-governance']['mitigations-applied'].join(', ')}
                          </span>
                        </div>
                      </div>
                    )}

                    {flow['aigf-governance']['risks-addressed']?.length > 0 && (
                      <div className="flex items-start gap-1.5">
                        <AlertCircle className="w-3 h-3 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <span className="text-xs text-muted-foreground">Risks: </span>
                          <span className="text-xs font-mono text-orange-600 dark:text-orange-400">
                            {flow['aigf-governance']['risks-addressed'].join(', ')}
                          </span>
                        </div>
                      </div>
                    )}

                    {flow['aigf-governance']['trust-boundaries-crossed']?.length > 0 && (
                      <div className="flex items-start gap-1.5">
                        <div className="w-3 h-3 mt-0.5 flex-shrink-0 border-2 border-blue-600 dark:border-blue-400 rounded-sm" />
                        <div className="flex-1">
                          <span className="text-xs text-muted-foreground">Boundaries: </span>
                          <span className="text-xs text-blue-600 dark:text-blue-400">
                            {flow['aigf-governance']['trust-boundaries-crossed'].join(', ')}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
};
