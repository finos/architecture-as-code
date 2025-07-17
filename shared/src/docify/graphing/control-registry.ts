import { Architecture } from '../../model/core';
import { CalmControl } from '../../model/control';

interface ControlRequirementGroup {
    id: string;
    content: string;
    domain: string;
    scope: string;
    appliedTo: string;
}

interface ControlConfigurationGroup {
    id: string;
    name: string;
    schema: string;
    description: string;
    domain: string;
    scope: string;
    appliedTo: string;
    content: string;
}

/**
 * A class that manages control requirements and configurations across architecture documents
 */
export class ControlRegistry {
    private controlRequirements: Record<string, ControlRequirementGroup[]> = {};
    private controlConfigurations: Record<string, ControlConfigurationGroup[]> = {};
    private groupedByDomainRequirements: Record<string, ControlRequirementGroup[]> = {};
    private groupedByDomainConfigurations: Record<string, ControlConfigurationGroup[]> = {};
    private architecture: Architecture;

    /**
     * Creates a new ControlRegistry instance
     * @param architecture The architecture containing nodes, relationships, and flows with controls
     */
    constructor(architecture: Architecture) {
        this.architecture = architecture;
    }

    /**
     * Processes all controls in the architecture and organizes them
     */
    public processControls(): void {
        this.architecture.nodes.forEach(node => {
            this.addControlConfigurationToTable(node.controls, 'Node', node.uniqueId);
            this.addControlRequirementToTable(node.controls, 'Node', node.uniqueId);
        });

        this.architecture.relationships.forEach(relationship => {
            this.addControlConfigurationToTable(relationship.controls, 'Relationship', relationship.uniqueId);
            this.addControlRequirementToTable(relationship.controls, 'Relationship', relationship.uniqueId);
        });

        this.architecture.flows.forEach(flow => {
            this.addControlConfigurationToTable(flow.controls, 'Flow', flow.uniqueId);
            this.addControlRequirementToTable(flow.controls, 'Flow', flow.uniqueId);
        });

        this.groupRequirementsByDomain();

        this.groupConfigurationsByDomain();
    }

    /**
     * Adds control requirements to the registry
     * @param controls The controls containing requirements
     * @param scope The scope of the controls
     * @param appliedTo The entity the controls are applied to
     */
    private addControlRequirementToTable(controls: CalmControl[], scope: string, appliedTo: string): void {
        controls.forEach(control => {
            control.requirements.forEach(detail => {
                const requirement = detail.controlRequirementUrl;
                const id = this.getRequirementId(requirement);

                if (!id) return;

                const existing = this.controlRequirements[id] ?? [];
                const isDuplicate = existing.some(req =>
                    req.domain === control.controlId &&
                    req.scope === scope &&
                    req.appliedTo === appliedTo
                );

                if (!isDuplicate) {
                    const controlRequirement: ControlRequirementGroup = {
                        id,
                        content: requirement,
                        domain: control.controlId,
                        scope,
                        appliedTo
                    };
                    existing.push(controlRequirement);
                    this.controlRequirements[id] = existing;
                }
            });
        });
    }

    /**
     * Extracts the last segment from a path string
     * @param path The path string to extract from
     * @returns The last segment of the path
     */
    private extractLastSegmentFromPath(path: string): string | undefined {
        return path.split('/').filter(Boolean).pop();
    }

    private getRequirementId(requirement: unknown): string | undefined {
        if (typeof requirement === 'string') {
            return this.extractLastSegmentFromPath(requirement);
        }

        if (
            typeof requirement === 'object' &&
            requirement !== null &&
            '$id' in requirement &&
            typeof (requirement as Record<string, unknown>)['$id'] === 'string'
        ) {
            return this.extractLastSegmentFromPath((requirement as Record<string, string>)['$id']);
        }

        return undefined;
    }

    /**
     * Adds control configurations to the registry
     * @param controls The controls containing configurations
     * @param scope The scope of the controls
     * @param appliedTo The entity the controls are applied to
     */
    private addControlConfigurationToTable(controls: CalmControl[], scope: string, appliedTo: string): void {
        controls.forEach(control => {
            control.requirements.forEach(detail => {
                const config = detail.controlConfig ?? detail.controlConfigUrl;

                if (config && typeof config['control-id'] === 'string') {
                    const id = config['control-id'];

                    if (!this.controlConfigurations[id]) {
                        this.controlConfigurations[id] = [];
                    }

                    const existingEntry = this.controlConfigurations[id].find(c =>
                        c.domain === control.controlId &&
                        c.scope === scope &&
                        c.appliedTo === appliedTo
                    );

                    if (!existingEntry) {
                        const controlConfiguration: ControlConfigurationGroup = {
                            id,
                            name: config['name'] ?? '',
                            schema: config['$schema'] ?? '',
                            description: config['description'] ?? '',
                            domain: control.controlId,
                            scope,
                            appliedTo,
                            content: detail.controlConfigUrl
                        };
                        this.controlConfigurations[id].push(controlConfiguration);
                    }
                }
            });
        });
    }


    /**
     * Groups requirements by domain
     */
    private groupRequirementsByDomain(): void {
        Object.values(this.controlRequirements).forEach(requirements => {
            requirements.forEach(req => {
                if (!this.groupedByDomainRequirements[req.domain]) {
                    this.groupedByDomainRequirements[req.domain] = [];
                }
                this.groupedByDomainRequirements[req.domain].push(req);
            });
        });
    }

    /**
     * Groups configurations by domain
     */
    private groupConfigurationsByDomain(): void {
        Object.values(this.controlConfigurations).forEach(configurations => {
            configurations.forEach(config => {
                if (!this.groupedByDomainConfigurations[config.domain]) {
                    this.groupedByDomainConfigurations[config.domain] = [];
                }
                this.groupedByDomainConfigurations[config.domain].push(config);
            });
        });
    }

    /**
     * Gets the flattened list of controls
     * @returns Array of control objects
     */
    public getControls(): ControlConfigurationGroup[] {
        return Object.entries(this.controlConfigurations).flatMap(([id, configurations]) =>
            configurations.map(config => ({
                id,
                ...config
            }))
        );
    }

    /**
     * Gets the flattened list of control requirements
     * @returns Array of control requirement objects
     */
    public getControlRequirements(): ControlRequirementGroup[] {
        return Object.entries(this.controlRequirements).flatMap(([id, requirements]) =>
            requirements.map(requirement => ({
                id,
                ...requirement
            }))
        );
    }

    /**
     * Gets the control requirements grouped by domain
     * @returns Record of control requirements grouped by domain
     */
    public getGroupedByDomainRequirements(): Record<string, ControlRequirementGroup[]> {
        return this.groupedByDomainRequirements;
    }

    /**
     * Gets the control configurations grouped by domain
     * @returns Record of control configurations grouped by domain
     */
    public getGroupedByDomainConfigurations(): Record<string, ControlConfigurationGroup[]> {
        return this.groupedByDomainConfigurations;
    }

    /**
     * Gets the raw control configurations
     * @returns Record of control configurations
     */
    public getControlConfigurations(): Record<string, ControlRequirementGroup[]> {
        return this.controlConfigurations;
    }
}
