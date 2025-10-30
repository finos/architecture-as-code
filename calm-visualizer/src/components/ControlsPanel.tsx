import { Card } from "./ui/card";
import { Shield, ExternalLink, AlertCircle } from "lucide-react";
import { ScrollArea } from "./ui/scroll-area";
import { Badge } from "./ui/badge";

interface ControlsPanelProps {
  controls: Record<string, any>;
  onNodeClick?: (nodeId: string) => void;
  onControlClick?: (controlId: string) => void;
}

export const ControlsPanel = ({ controls, onNodeClick, onControlClick }: ControlsPanelProps) => {
  if (!controls || Object.keys(controls).length === 0) return null;

  const controlEntries = Object.entries(controls);

  return (
    <Card className="h-full flex flex-col border-border bg-card">
      <div className="flex items-center gap-2 p-4 border-b border-border">
        <Shield className="w-4 h-4 text-accent" />
        <h2 className="font-semibold">CALM Controls</h2>
        <span className="text-xs text-muted-foreground ml-auto">
          {controlEntries.length} {controlEntries.length === 1 ? 'control' : 'controls'}
        </span>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {controlEntries.map(([controlId, control]: [string, any]) => (
            <div
              key={controlId}
              className="rounded-lg border border-border bg-card/50 overflow-hidden hover:border-accent/50 transition-colors cursor-pointer"
              onClick={() => onControlClick?.(controlId)}
              title="Click to jump to control definition in JSON"
            >
              {/* Control Header */}
              <div className="p-3 bg-green-500/10 border-b border-border">
                <h3 className="font-semibold text-sm mb-1 flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                  <span className="font-mono text-xs text-muted-foreground">{controlId}</span>
                </h3>
                {control.nodeName && (
                  <div className="mt-1 mb-2">
                    <Badge
                      variant="secondary"
                      className="text-xs cursor-pointer hover:bg-accent"
                      onClick={() => onNodeClick?.(control.appliesTo)}
                    >
                      Node: {control.nodeName}
                    </Badge>
                  </div>
                )}
                {control.relationshipDescription && (
                  <div className="mt-1 mb-2">
                    <Badge
                      variant="outline"
                      className="text-xs"
                    >
                      Relationship: {control.relationshipDescription}
                    </Badge>
                  </div>
                )}
                {control.description && (
                  <p className="text-xs text-foreground mt-1">{control.description}</p>
                )}
              </div>

              {/* Requirements */}
              {control.requirements && control.requirements.length > 0 && (
                <div className="p-3 space-y-2">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">Requirements</h4>
                  {control.requirements.map((req: any, idx: number) => (
                    <div key={idx} className="rounded-lg bg-secondary/30 border border-border p-2 space-y-2">
                      {req['requirement-url'] && (
                        <a
                          href={req['requirement-url']}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span className="break-all">{req['requirement-url']}</span>
                        </a>
                      )}

                      {req['config-url'] && (
                        <a
                          href={req['config-url']}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Config: {req['config-url']}</span>
                        </a>
                      )}

                      {req.config && (
                        <div>
                          <span className="text-xs font-medium text-muted-foreground mb-1 block">Configuration:</span>

                          {/* Applies To section */}
                          {req.config.appliesTo && (
                            <div className="mb-2">
                              <span className="text-xs text-muted-foreground">Applies to:</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {req.config.appliesTo.nodes?.map((nodeId: string) => (
                                  <Badge
                                    key={nodeId}
                                    variant="secondary"
                                    className="text-xs cursor-pointer hover:bg-accent"
                                    onClick={() => onNodeClick?.(nodeId)}
                                  >
                                    {nodeId}
                                  </Badge>
                                ))}
                                {req.config.appliesTo.relationships?.map((relId: string) => (
                                  <Badge
                                    key={relId}
                                    variant="outline"
                                    className="text-xs"
                                  >
                                    {relId}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Other config details */}
                          <pre className="text-xs text-foreground bg-secondary/50 p-2 rounded overflow-auto max-h-32">
                            {JSON.stringify(
                              Object.fromEntries(
                                Object.entries(req.config).filter(([key]) => key !== 'appliesTo')
                              ),
                              null,
                              2
                            )}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* AIGF Mappings */}
              {(control['aigf-mitigations'] || control['aigf-risks']) && (
                <div className="px-3 pb-3">
                  <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-2 space-y-1.5">
                    <h4 className="text-xs font-medium text-foreground mb-1">FINOS AIGF Mapping</h4>

                    {control['aigf-mitigations'] && control['aigf-mitigations'].length > 0 && (
                      <div className="flex items-start gap-1.5">
                        <Shield className="w-3 h-3 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <span className="text-xs text-muted-foreground">Mitigations: </span>
                          <span className="text-xs font-mono text-green-600 dark:text-green-400">
                            {control['aigf-mitigations'].join(', ')}
                          </span>
                        </div>
                      </div>
                    )}

                    {control['aigf-risks'] && control['aigf-risks'].length > 0 && (
                      <div className="flex items-start gap-1.5">
                        <AlertCircle className="w-3 h-3 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <span className="text-xs text-muted-foreground">Risks: </span>
                          <span className="text-xs font-mono text-orange-600 dark:text-orange-400">
                            {control['aigf-risks'].join(', ')}
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
