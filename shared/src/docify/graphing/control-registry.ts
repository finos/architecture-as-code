import { Architecture, CalmControl } from '@finos/calm-models/model';

export interface ControlRequirementGroup {
    id: string;
    content: string;
    domain: string;
    scope: string;
    appliedTo: string;
}

export interface ControlConfigurationGroup {
    domain: string;
    scope: string;
    appliedTo: string;
    requirementUrl: string;
}

export class ControlRegistry {
    private controlRequirements: Record<string, ControlRequirementGroup[]> = {};
    private controlConfigurations: Record<string, ControlConfigurationGroup[]> = {};
    private groupedByDomainRequirements: Record<string, ControlRequirementGroup[]> = {};
    private groupedByDomainConfigurations: Record<string, ControlConfigurationGroup[]> = {};
    private architecture: Architecture;

    constructor(architecture: Architecture) {
        this.architecture = architecture;
    }

    public processControls(): void {
        this.architecture.nodes.forEach(node => {
            if (node.controls) {
                Object.entries(node.controls.data).forEach(([controlId, control]) => {
                    this.addControlConfigurationToTable(control, controlId, 'Node', node.uniqueId);
                    this.addControlRequirementToTable(control, controlId, 'Node', node.uniqueId);
                });
            }
        });

        this.architecture.relationships.forEach(relationship => {
            if (relationship.controls) {
                Object.entries(relationship.controls.data).forEach(([controlId, control]) => {
                    this.addControlConfigurationToTable(control, controlId, 'Relationship', relationship.uniqueId);
                    this.addControlRequirementToTable(control, controlId, 'Relationship', relationship.uniqueId);
                });
            }
        });

        this.architecture.flows?.forEach(flow => {
            if (flow.controls) {
                Object.entries(flow.controls.data).forEach(([controlId, control]) => {
                    this.addControlConfigurationToTable(control, controlId, 'Flow', flow.uniqueId);
                    this.addControlRequirementToTable(control, controlId, 'Flow', flow.uniqueId);
                });
            }
        });

        this.groupRequirementsByDomain();
        this.groupConfigurationsByDomain();
    }

    private addControlRequirementToTable(
        controls: CalmControl | CalmControl[],
        domain: string,
        scope: string,
        appliedTo: string
    ): void {
        const controlArr = Array.isArray(controls) ? controls : [controls];
        controlArr.forEach(control => {
            control.requirements.forEach(detail => {
                const requirement = detail.requirement.reference;
                const id = this.getRequirementId(requirement);
                if (!id) return;

                const existing = this.controlRequirements[id] ?? [];
                const isDuplicate = existing.some(req =>
                    req.domain === domain && req.scope === scope && req.appliedTo === appliedTo
                );

                if (!isDuplicate) {
                    this.controlRequirements[id] = [
                        ...existing,
                        {
                            id,
                            content: typeof requirement === 'string' ? requirement : JSON.stringify(requirement),
                            domain,
                            scope,
                            appliedTo
                        }
                    ];
                }
            });
        });
    }

    private addControlConfigurationToTable(
        controls: CalmControl | CalmControl[],
        domain: string,
        scope: string,
        appliedTo: string
    ): void {
        const controlArr = Array.isArray(controls) ? controls : [controls];

        controlArr.forEach(control => {
            control.requirements.forEach(detail => {
                let config: Record<string, unknown> = {};

                // Handle resolved and unresolved configs
                if (detail.configUrl) {
                    if (detail.configUrl.isResolved) {
                        config = detail.configUrl.value || {};
                    } else {
                        config = { 'config-url': detail.configUrl.reference };
                    }
                } else if (detail.config) {
                    config = detail.config;
                }

                if (config) {
                    const existing = this.controlConfigurations[domain] ?? [];
                    const alreadyPresent = existing.some(
                        cfg => cfg.domain === domain && cfg.scope === scope && cfg.appliedTo === appliedTo
                    );

                    if (!alreadyPresent) {
                        const entry: ControlConfigurationGroup = {
                            domain,
                            scope,
                            appliedTo,
                            requirementUrl: detail.requirement?.reference || 'N/A' // Only include requirement-url
                        };
                        this.controlConfigurations[domain] = [...existing, entry];
                    }
                }
            });
        });
    }

    private extractLastSegmentFromPath(path: string): string | undefined {
        return path.split('/').filter(Boolean).pop();
    }

    private getRequirementId(requirement: unknown): string | undefined {
        if (typeof requirement === 'string') return this.extractLastSegmentFromPath(requirement);
        if (typeof requirement === 'object' && requirement !== null && '$id' in requirement) {
            return this.extractLastSegmentFromPath((requirement as Record<string, string>)['$id']);
        }
        return undefined;
    }

    private groupRequirementsByDomain(): void {
        Object.values(this.controlRequirements).flat().forEach(req => {
            this.groupedByDomainRequirements[req.domain] ??= [];
            this.groupedByDomainRequirements[req.domain].push(req);
        });
    }

    private groupConfigurationsByDomain(): void {
        Object.values(this.controlConfigurations).flat().forEach(cfg => {
            this.groupedByDomainConfigurations[cfg.domain] ??= [];
            this.groupedByDomainConfigurations[cfg.domain].push(cfg);
        });
    }

    public getControls(): ControlConfigurationGroup[] {
        return Object.values(this.controlConfigurations).flat();
    }

    public getControlRequirements(): ControlRequirementGroup[] {
        return Object.values(this.controlRequirements).flat();
    }

    public getGroupedByDomainRequirements(): Record<string, ControlRequirementGroup[]> {
        return this.groupedByDomainRequirements;
    }

    public getGroupedByDomainConfigurations(): Record<string, ControlConfigurationGroup[]> {
        return this.groupedByDomainConfigurations;
    }

    public getControlConfigurations(): Record<string, ControlConfigurationGroup[]> {
        return this.controlConfigurations;
    }
}
