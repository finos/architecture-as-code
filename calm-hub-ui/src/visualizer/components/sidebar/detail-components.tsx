import { ReactNode } from 'react';
import { AlertTriangle, AlertCircle, Shield, ArrowRight, type LucideIcon } from 'lucide-react';
import { getRiskLevelColor } from '../../../theme/helpers.js';
import type { RiskItem, MitigationItem, ControlItem } from '../../contracts/contracts.js';
import { formatFieldName } from './sidebar-utils.js';

export { formatFieldName, getNodeIcon, extractAigf, getExtraProperties } from './sidebar-utils.js';
export type { AigfData } from './sidebar-utils.js';

export function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <div className="border-t border-base-300 pt-3">
            <h4 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-2">{title}</h4>
            {children}
        </div>
    );
}

export function Badge({ icon: Icon, label, color }: { icon: LucideIcon; label: string; color: string }) {
    return (
        <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: color }}
        >
            <Icon className="w-3.5 h-3.5" />
            {label}
        </span>
    );
}

export function RiskLevelBadge({ level }: { level: string }) {
    return <Badge icon={AlertTriangle} label={level} color={getRiskLevelColor(level)} />;
}

export function PropertiesSection({ properties }: { properties: [string, unknown][] }) {
    if (properties.length === 0) return null;
    return (
        <Section title="Properties">
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                {properties.map(([key, value]) => (
                    <div key={key} className="contents">
                        <span className="text-xs text-base-content/50 font-medium">{formatFieldName(key)}</span>
                        <span className="text-xs text-base-content font-medium">{String(value)}</span>
                    </div>
                ))}
            </div>
        </Section>
    );
}

export function ControlsSection({ controls }: { controls: Record<string, ControlItem> }) {
    const entries = Object.entries(controls);
    if (entries.length === 0) return null;
    return (
        <Section title="Controls">
            <div className="flex flex-col gap-2">
                {entries.map(([id, control]) => {
                    const reqCount = Array.isArray(control.requirements) ? control.requirements.length : 0;
                    return (
                        <div key={id} className="bg-base-200 rounded-lg px-3 py-2">
                            <div className="flex items-center gap-1.5 mb-0.5">
                                <Shield className="w-3.5 h-3.5 text-accent" />
                                <span className="text-xs font-semibold text-accent">{id}</span>
                            </div>
                            {control.description && (
                                <p className="text-xs text-base-content/60 ml-5">{control.description}</p>
                            )}
                            {reqCount > 0 && (
                                <p className="text-xs text-base-content/40 ml-5 mt-0.5">
                                    {reqCount} requirement{reqCount !== 1 ? 's' : ''}
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>
        </Section>
    );
}

export function RisksSection({ risks, riskLevel }: { risks: (string | RiskItem)[]; riskLevel?: string }) {
    if (risks.length === 0) return null;
    return (
        <Section title="Risks">
            <div className="flex flex-col gap-1.5">
                {risks.map((risk, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs">
                        <AlertCircle
                            className="w-3.5 h-3.5 mt-0.5 shrink-0"
                            style={{ color: riskLevel ? getRiskLevelColor(riskLevel) : undefined }}
                        />
                        <span className="text-base-content/70">
                            {typeof risk === 'string' ? risk : (risk.name || risk.id || JSON.stringify(risk))}
                        </span>
                    </div>
                ))}
            </div>
        </Section>
    );
}

export function MitigationsSection({ mitigations }: { mitigations: (string | MitigationItem)[] }) {
    if (mitigations.length === 0) return null;
    return (
        <Section title="Mitigations">
            <div className="flex flex-col gap-1.5">
                {mitigations.map((mitigation, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs">
                        <Shield className="w-3.5 h-3.5 mt-0.5 shrink-0 text-success" />
                        <span className="text-base-content/70">
                            {typeof mitigation === 'string' ? mitigation : (mitigation.name || mitigation.id || JSON.stringify(mitigation))}
                        </span>
                    </div>
                ))}
            </div>
        </Section>
    );
}

export function InterfacesSection({ interfaces }: { interfaces: Record<string, unknown>[] }) {
    if (interfaces.length === 0) return null;
    return (
        <Section title="Interfaces">
            <div className="flex flex-col gap-2">
                {interfaces.map((iface, idx) => {
                    const ifaceId = (iface['unique-id'] as string) || `interface-${idx}`;
                    const otherFields = Object.entries(iface).filter(([k]) => k !== 'unique-id');
                    return (
                        <div key={ifaceId} className="bg-base-200 rounded-lg px-3 py-2">
                            <p className="text-xs font-semibold text-base-content mb-1">{ifaceId}</p>
                            {otherFields.map(([k, v]) => (
                                <div key={k} className="flex justify-between text-xs">
                                    <span className="text-base-content/50">{formatFieldName(k)}</span>
                                    <span className="text-base-content font-mono">{String(v)}</span>
                                </div>
                            ))}
                        </div>
                    );
                })}
            </div>
        </Section>
    );
}

export function ConnectionDiagram({ nodes }: { nodes: [string, string] }) {
    return (
        <div className="flex items-center gap-2 bg-base-200 rounded-lg px-3 py-2.5">
            <span className="text-xs font-mono font-semibold text-base-content bg-base-300 rounded px-2 py-1">{nodes[0]}</span>
            <div className="flex items-center flex-1">
                <div className="flex-1 border-t border-base-content/20"></div>
                <ArrowRight className="w-3.5 h-3.5 text-base-content/40 mx-0.5" />
            </div>
            <span className="text-xs font-mono font-semibold text-base-content bg-base-300 rounded px-2 py-1">{nodes[1]}</span>
        </div>
    );
}

export function NodeList({ label, nodes }: { label: string; nodes: string[] }) {
    return (
        <div className="bg-base-200 rounded-lg px-3 py-2.5">
            <span className="text-xs text-base-content/50 font-medium">{label}</span>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
                {nodes.map(node => (
                    <span key={node} className="text-xs font-mono font-semibold text-base-content bg-base-300 rounded px-2 py-1">{node}</span>
                ))}
            </div>
        </div>
    );
}
