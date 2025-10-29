/**
 * Mock CALM data for testing
 */

export const validCALMWithUniqueId = {
  nodes: [
    {
      'unique-id': 'node-1',
      name: 'Service A',
      'node-type': 'service',
      description: 'Test service',
    },
    {
      'unique-id': 'node-2',
      name: 'Database',
      'node-type': 'database',
    },
  ],
  relationships: [
    {
      'unique-id': 'rel-1',
      'relationship-type': {
        connects: {
          source: { node: 'node-1' },
          destination: { node: 'node-2' },
        },
      },
      protocol: 'HTTPS',
    },
  ],
};

export const validCALMWithUnderscoreId = {
  nodes: [
    {
      unique_id: 'node-1',
      name: 'Service A',
      node_type: 'service',
    },
    {
      unique_id: 'node-2',
      name: 'Database',
      node_type: 'database',
    },
  ],
  relationships: [
    {
      unique_id: 'rel-1',
      'relationship-type': {
        connects: {
          source: { node: 'node-1' },
          destination: { node: 'node-2' },
        },
      },
    },
  ],
};

export const validCALMWithPlainId = {
  nodes: [
    { id: 'node-1', name: 'Service A', type: 'service' },
    { id: 'node-2', name: 'Database', type: 'database' },
  ],
  relationships: [
    {
      id: 'rel-1',
      source: 'node-1',
      target: 'node-2',
    },
  ],
};

export const calmWithControls = {
  nodes: [
    {
      'unique-id': 'node-1',
      name: 'Service A',
      'node-type': 'service',
      controls: {
        'control-1': {
          description: 'TLS encryption required',
          requirements: [
            {
              'requirement-url': 'https://example.com/req1',
            },
          ],
        },
        'control-2': {
          description: 'Authentication required',
        },
      },
    },
  ],
  relationships: [
    {
      'unique-id': 'rel-1',
      'relationship-type': {
        connects: {
          source: { node: 'node-1' },
          destination: { node: 'node-2' },
        },
      },
      controls: {
        'rel-control-1': {
          description: 'Encrypted connection',
        },
      },
    },
  ],
  controls: {
    'global-control-1': {
      description: 'System-wide control',
    },
  },
};

export const calmWithSystemNodes = {
  nodes: [
    {
      'unique-id': 'system-1',
      name: 'Production System',
      'node-type': 'system',
    },
    {
      'unique-id': 'service-1',
      name: 'API Service',
      'node-type': 'service',
    },
    {
      'unique-id': 'service-2',
      name: 'Database Service',
      'node-type': 'service',
    },
  ],
  relationships: [
    {
      'unique-id': 'deployment-1',
      'relationship-type': {
        'deployed-in': {
          container: 'system-1',
          nodes: ['service-1', 'service-2'],
        },
      },
    },
  ],
};

export const calmWithFlows = {
  nodes: [
    { 'unique-id': 'node-1', name: 'Frontend', 'node-type': 'service' },
    { 'unique-id': 'node-2', name: 'Backend', 'node-type': 'service' },
  ],
  relationships: [
    {
      'unique-id': 'rel-1',
      'relationship-type': {
        connects: {
          source: { node: 'node-1' },
          destination: { node: 'node-2' },
        },
      },
      protocol: 'HTTPS',
    },
  ],
  flows: [
    {
      name: 'User Request Flow',
      transitions: [
        {
          'relationship-unique-id': 'rel-1',
          direction: 'source-to-destination',
          'sequence-number': 1,
          description: 'Request sent',
        },
        {
          'relationship-unique-id': 'rel-1',
          direction: 'destination-to-source',
          'sequence-number': 2,
          description: 'Response returned',
        },
      ],
    },
  ],
};

export const calmWithInteracts = {
  nodes: [
    { 'unique-id': 'actor-1', name: 'User', 'node-type': 'actor' },
    { 'unique-id': 'service-1', name: 'Frontend', 'node-type': 'service' },
    { 'unique-id': 'service-2', name: 'Backend', 'node-type': 'service' },
  ],
  relationships: [
    {
      'unique-id': 'interaction-1',
      'relationship-type': {
        interacts: {
          actor: 'actor-1',
          nodes: ['service-1', 'service-2'],
        },
      },
      description: 'User interacts with services',
    },
  ],
};

export const invalidCALMNoIds = {
  nodes: [
    { name: 'Service without ID', type: 'service' },
  ],
  relationships: [],
};

export const emptyCALM = {
  nodes: [],
  relationships: [],
};
