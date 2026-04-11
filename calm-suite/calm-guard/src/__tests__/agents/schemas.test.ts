import { describe, it, expect } from 'vitest';
import { agentEventSchema } from '@/lib/agents/types';
import { calmDocumentSchema } from '@/lib/calm/types';

// Valid agent identity fixture
const validAgentIdentity = {
  name: 'architecture-analyzer',
  displayName: 'Architecture Analyzer',
  icon: 'Network',
  color: 'blue',
};

// Valid "completed" agent event fixture
const validCompletedEvent = {
  type: 'completed',
  agent: validAgentIdentity,
  message: 'Analysis complete',
  timestamp: new Date().toISOString(),
};

describe('agentEventSchema', () => {
  it('accepts a valid completed event with all required fields', () => {
    const result = agentEventSchema.safeParse(validCompletedEvent);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected valid event to parse successfully');
    expect(result.data.type).toBe('completed');
    expect(result.data.agent.name).toBe('architecture-analyzer');
    expect(result.data.agent.displayName).toBe('Architecture Analyzer');
    expect(result.data.agent.icon).toBe('Network');
    expect(result.data.agent.color).toBe('blue');
  });

  it('accepts a valid finding event with severity field', () => {
    const findingEvent = {
      type: 'finding',
      agent: validAgentIdentity,
      message: 'Missing mTLS on database connection',
      severity: 'high',
      timestamp: new Date().toISOString(),
    };

    const result = agentEventSchema.safeParse(findingEvent);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected finding event to parse successfully');
    expect(result.data.severity).toBe('high');
  });

  it('rejects an event with an invalid type string', () => {
    const invalidEvent = {
      type: 'unknown-type',
      agent: validAgentIdentity,
      timestamp: new Date().toISOString(),
    };

    const result = agentEventSchema.safeParse(invalidEvent);

    expect(result.success).toBe(false);
    if (result.success) throw new Error('Expected invalid event to fail parsing');
    const typeIssue = result.error.issues.find(issue => issue.path.includes('type'));
    expect(typeIssue).toBeDefined();
  });
});

describe('calmDocumentSchema', () => {
  it('accepts a valid CALM document with a single service node', () => {
    const validDocument = {
      nodes: [
        {
          'unique-id': 'payment-service',
          'node-type': 'service',
          name: 'Payment Service',
          description: 'Handles payment processing',
        },
      ],
      relationships: [],
    };

    const result = calmDocumentSchema.safeParse(validDocument);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected valid document to parse successfully');
    expect(result.data.nodes).toHaveLength(1);
    expect(result.data.nodes[0]['node-type']).toBe('service');
  });
});
