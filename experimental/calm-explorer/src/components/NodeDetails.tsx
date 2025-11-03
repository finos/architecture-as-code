import { Info, Shield, AlertCircle, AlertTriangle, Network, ZoomIn, ExternalLink } from "lucide-react";
import { Button } from "./ui/button";
import { extractId } from "@/utils/calmHelpers";
import type { ControlConfiguration } from "@/types/calm";
import { ControlDetails } from "./ControlDetails";

interface NodeDetailsProps {
  node: any;
  onClose: () => void;
  onLoadDetailedArchitecture?: (url: string, nodeName?: string) => void;
  onJumpToControl?: (controlId: string) => void;
  onJumpToInterface?: (interfaceId: string) => void;
  resolvedControls?: Map<string, ControlConfiguration>;
}

export const NodeDetails = ({
  node,
  onClose,
  onLoadDetailedArchitecture,
  onJumpToControl,
  onJumpToInterface,
  resolvedControls
}: NodeDetailsProps) => {
  if (!node) return null;

  // Extract AIGF data
  const aigf = node.metadata?.aigf;
  const riskLevel = aigf?.['risk-level'];
  const risks = aigf?.risks || [];
  const mitigations = aigf?.mitigations || [];

  // Extract details
  const detailedArchitecture = node.details?.['detailed-architecture'];
  const requiredPattern = node.details?.['required-pattern'];

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical':
        return "hsl(0 84% 60%)";
      case 'high':
        return "hsl(25 95% 53%)";
      case 'medium':
        return "hsl(48 96% 53%)";
      default:
        return "hsl(var(--primary))";
    }
  };

  const renderValue = (value: any): string => {
    if (typeof value === "object") {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  // Filter out metadata.aigf, interfaces, details, controls, and internal implementation details from general properties since we'll show them specially
  const otherProperties = Object.entries(node).filter(([key]) =>
    key !== 'metadata' &&
    key !== 'interfaces' &&
    key !== 'details' &&
    key !== 'controls' &&
    key !== 'onShowDetails' &&
    key !== 'onJumpToControl'
  );
  const otherMetadata = node.metadata ? Object.entries(node.metadata).filter(([key]) => key !== 'aigf') : [];
  const interfaces = node.interfaces || [];
  const controls = node.controls || {};
  const controlEntries = Object.entries(controls);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 mb-6">
        <Info className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">Node Details</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="space-y-6">
          {/* Basic Information */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Info className="w-4 h-4" />
              Basic Information
            </h3>
            <div className="space-y-3">
              {otherProperties.map(([key, value]) => (
                <div key={key} className="space-y-1">
                  <dt className="text-sm font-medium text-accent">{key}</dt>
                  <dd className="text-sm text-foreground bg-secondary/50 p-3 rounded-md font-mono whitespace-pre-wrap break-all">
                    {renderValue(value)}
                  </dd>
                </div>
              ))}
            </div>
          </div>

          {/* Detailed Architecture Section */}
          {(detailedArchitecture || requiredPattern) && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <ZoomIn className="w-4 h-4" />
                Architecture Details
              </h3>
              <div className="space-y-2">
                {detailedArchitecture && (
                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <span className="text-xs font-medium text-muted-foreground block mb-1">Detailed Architecture</span>
                        <span className="text-xs text-blue-600 dark:text-blue-400 break-all">{detailedArchitecture}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        className="h-7 text-xs"
                        onClick={() => onLoadDetailedArchitecture?.(detailedArchitecture, node.name || node['unique-id'])}
                      >
                        <ZoomIn className="w-3 h-3 mr-1" />
                        Load Detailed View
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => window.open(detailedArchitecture, '_blank')}
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Open in New Tab
                      </Button>
                    </div>
                  </div>
                )}
                {requiredPattern && (
                  <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                    <span className="text-xs font-medium text-muted-foreground block mb-1">Required Pattern</span>
                    <span className="text-sm text-purple-600 dark:text-purple-400">{requiredPattern}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Interfaces Section */}
          {interfaces.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Network className="w-4 h-4" />
                Interfaces
              </h3>
              <div className="space-y-2">
                {interfaces.map((iface: any, idx: number) => {
                  const interfaceId = extractId(iface);
                  const nodeId = extractId(node);
                  const interfaceKey = interfaceId ? `${nodeId}/${interfaceId}` : null;

                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 hover:border-blue-500/40 transition-colors cursor-pointer"
                      onClick={() => interfaceKey && onJumpToInterface?.(interfaceKey)}
                      title="Click to jump to interface definition in JSON"
                    >
                      <div className="space-y-2">
                        {iface['unique-id'] && (
                          <div>
                            <span className="text-xs font-medium text-muted-foreground">ID: </span>
                            <span className="text-sm font-mono text-blue-600 dark:text-blue-400">{iface['unique-id']}</span>
                          </div>
                        )}
                      {iface['definition-url'] && (
                        <div>
                          <span className="text-xs font-medium text-muted-foreground">Definition: </span>
                          <a
                            href={iface['definition-url']}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline break-all"
                          >
                            {iface['definition-url']}
                          </a>
                        </div>
                      )}
                      {iface.config && (
                        <div>
                          <span className="text-xs font-medium text-muted-foreground mb-1 block">Config:</span>
                          <pre className="text-xs text-foreground bg-secondary/50 p-2 rounded overflow-auto max-h-40">
                            {JSON.stringify(iface.config, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Controls Section - Enhanced with ControlDetails */}
          {controlEntries.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Security Controls ({controlEntries.length})
              </h3>
              <div className="space-y-2">
                {controlEntries.map(([controlName, control]: [string, any], idx: number) => {
                  // Resolve control configurations from URLs
                  const resolvedConfigs = control.requirements
                    ?.map((req: any) => resolvedControls?.get(req['config-url']))
                    .filter((c: any): c is ControlConfiguration => c !== undefined) || [];

                  return (
                    <ControlDetails
                      key={idx}
                      controlName={controlName}
                      control={control}
                      resolvedConfigs={resolvedConfigs}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* AIGF Governance Section */}
          {aigf && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                AI Governance (FINOS AIGF)
              </h3>

              {/* Risk Level */}
              {riskLevel && (
                <div className="mb-4 p-3 rounded-lg border-2" style={{ borderColor: getRiskColor(riskLevel), background: getRiskColor(riskLevel) + '10' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-4 h-4" style={{ color: getRiskColor(riskLevel) }} />
                    <span className="text-xs font-medium text-muted-foreground">Risk Level</span>
                  </div>
                  <div className="text-sm font-bold uppercase" style={{ color: getRiskColor(riskLevel) }}>
                    {riskLevel}
                  </div>
                </div>
              )}

              {/* Risks */}
              {risks.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-orange-500" />
                    <span className="text-sm font-medium text-foreground">Risks ({risks.length})</span>
                  </div>
                  <div className="space-y-2">
                    {risks.map((risk: any, idx: number) => (
                      <div key={idx} className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                        {typeof risk === 'string' ? (
                          <div className="text-sm font-medium text-orange-600 dark:text-orange-400">{risk}</div>
                        ) : (
                          <>
                            <div className="text-sm font-medium text-orange-600 dark:text-orange-400 mb-1">
                              {risk.id && <span className="font-mono">{risk.id}</span>}
                              {risk.id && risk.name && <span> - </span>}
                              {risk.name}
                            </div>
                            {risk.description && (
                              <div className="text-xs text-foreground/80 mt-1">{risk.description}</div>
                            )}
                            {risk.severity && (
                              <div className="text-xs text-muted-foreground mt-1">Severity: {risk.severity}</div>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Mitigations */}
              {mitigations.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-medium text-foreground">Mitigations ({mitigations.length})</span>
                  </div>
                  <div className="space-y-2">
                    {mitigations.map((mitigation: any, idx: number) => (
                      <div key={idx} className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                        {typeof mitigation === 'string' ? (
                          <div className="text-sm font-medium text-green-600 dark:text-green-400">{mitigation}</div>
                        ) : (
                          <>
                            <div className="text-sm font-medium text-green-600 dark:text-green-400 mb-1">
                              {mitigation.id && <span className="font-mono">{mitigation.id}</span>}
                              {mitigation.id && mitigation.name && <span> - </span>}
                              {mitigation.name}
                            </div>
                            {mitigation.description && (
                              <div className="text-xs text-foreground/80 mt-1">{mitigation.description}</div>
                            )}
                            {mitigation.category && (
                              <div className="text-xs text-muted-foreground mt-1">Category: {mitigation.category}</div>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Other AIGF properties */}
              {Object.entries(aigf).filter(([key]) => key !== 'risk-level' && key !== 'risks' && key !== 'mitigations').map(([key, value]) => (
                <div key={key} className="mb-3">
                  <dt className="text-sm font-medium text-accent mb-1">{key}</dt>
                  <dd className="text-sm text-foreground bg-secondary/50 p-2 rounded-md font-mono whitespace-pre-wrap break-all">
                    {renderValue(value)}
                  </dd>
                </div>
              ))}
            </div>
          )}

          {/* Other Metadata */}
          {otherMetadata.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Additional Metadata</h3>
              <div className="space-y-3">
                {otherMetadata.map(([key, value]) => (
                  <div key={key} className="space-y-1">
                    <dt className="text-sm font-medium text-accent">{key}</dt>
                    <dd className="text-sm text-foreground bg-secondary/50 p-3 rounded-md font-mono whitespace-pre-wrap break-all">
                      {renderValue(value)}
                    </dd>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
