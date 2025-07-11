export interface CalmArchitecture {
  'unique-id': string;
  metadata?: Record<string, any>[];
  nodes?: CalmNode[];
  relationships?: CalmRelationship[];
  flows?: CalmFlow[];
  controls?: Record<string, any>;
  [key: string]: any;
}

export interface CalmNode {
  'unique-id': string;
  'node-type': string;
  name: string;
  description?: string;
  interfaces?: any[];
  controls?: Record<string, any>;
  metadata?: Record<string, any>[];
  [key: string]: any;
}

export interface CalmRelationship {
  'unique-id': string;
  'relationship-type': {
    connects?: boolean;
    interacts?: boolean;
    'deployed-in'?: boolean;
    'composed-of'?: boolean;
  };
  parties: {
    source: {
      node: string;
      interface?: string;
    };
    destination: {
      node: string;
      interface?: string;
    };
  };
  protocol?: string;
  authentication?: any;
  controls?: Record<string, any>;
  metadata?: Record<string, any>[];
  [key: string]: any;
}

export interface CalmFlow {
  'unique-id': string;
  name: string;
  description?: string;
  transitions: CalmTransition[];
  controls?: Record<string, any>;
  metadata?: Record<string, any>[];
  [key: string]: any;
}

export interface CalmTransition {
  'relationship-unique-id': string;
  'sequence-number': number;
  summary?: string;
  direction?: 'source-to-destination' | 'destination-to-source';
}

export interface TableColumn {
  key: string;
  label: string;
  formatter?: (value: any) => string;
}

export interface TableOptions {
  columns?: TableColumn[];
  includeHeaders?: boolean;
  format?: 'markdown' | 'html';
  emptyMessage?: string;
}

export interface PathExtractionOptions {
  filter?: Record<string, any>;
  sort?: string | string[];
  limit?: number;
}

export type CalmWidgetHelper = (...args: any[]) => any;
