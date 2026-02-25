// FINOS CALM Control Types

export interface ControlRequirement {
  'requirement-url': string;
  'config-url': string;
  'implementation-section'?: string;
}

export interface CALMControl {
  description: string;
  requirements: ControlRequirement[];
  // Resolved control configurations (populated asynchronously)
  resolvedConfigs?: ControlConfiguration[];
}

export interface ControlConfiguration {
  '$id'?: string;
  'control-id': string;
  'control-name': string;
  category: 'Preventative' | 'Detective' | 'Risk';
  description: string;
  'reference-url': string;
  'mitigates-risks'?: string[];
  'related-mitigations'?: string[];
  'implementation-requirements'?: Record<string, any>;
  'k8s-mapping'?: Record<string, any>;
}

export interface FileMappings {
  description: string;
  mappings: Record<string, string>;
  notes?: Record<string, string>;
}

export interface CALMNode {
  'unique-id': string;
  name: string;
  'node-type': string;
  description?: string;
  interfaces?: any[];
  controls?: Record<string, CALMControl>;
}

export interface CALMRelationship {
  'unique-id': string;
  description?: string;
  protocol?: string;
  'relationship-type': any;
  controls?: Record<string, CALMControl>;
}

export interface CALMArchitecture {
  nodes: CALMNode[];
  relationships: CALMRelationship[];
  metadata?: any;
  flows?: any[];
}

// Helper type for resolved controls with context
export interface ResolvedControl {
  controlName: string;
  control: CALMControl;
  configs: ControlConfiguration[];
  sourceType: 'node' | 'relationship';
  sourceId: string;
  sourceName: string;
}
