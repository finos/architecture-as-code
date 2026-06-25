// Generator for the AIGF Multi-Agent Reference Architecture — a C4-style CALM
// document series (convention-wired via node.details + required-pattern).
// Emits Tier 1 (context), Tier 2 (8 layer patterns + detailed archs), Tier 3
// (loan-origination instantiation), a url-mapping + validate loop + README.
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = new URL('./', import.meta.url);
mkdirSync(OUT, { recursive: true });
mkdirSync(new URL('loan/', OUT), { recursive: true });

const NS = 'https://calm.finos.org/marefarch';
const META = 'https://calm.finos.org/release/1.2/meta/calm.json';
const AIGF = 'https://air-governance-framework.finos.org';
const url = (f) => `${NS}/${f}`;
const write = (name, obj) => writeFileSync(new URL(name, OUT), JSON.stringify(obj, null, 2) + '\n');

// ── helpers ────────────────────────────────────────────────────────────────
const node = (id, type, name, description, extra = {}) => ({ 'unique-id': id, 'node-type': type, name, description, ...extra });
const composedOf = (id, container, nodes, description) => ({ 'unique-id': id, ...(description ? { description } : {}), 'relationship-type': { 'composed-of': { container, nodes } } });
const connects = (id, source, destination, description, protocol) => ({ 'unique-id': id, ...(description ? { description } : {}), 'relationship-type': { connects: { source: { node: source }, destination: { node: destination } } }, ...(protocol ? { protocol } : {}) });
const deployedIn = (id, container, nodes, description) => ({ 'unique-id': id, ...(description ? { description } : {}), 'relationship-type': { 'deployed-in': { container, nodes } } });
const interacts = (id, actor, nodes, description) => ({ 'unique-id': id, ...(description ? { description } : {}), 'relationship-type': { interacts: { actor, nodes } } });
// requirement-url points at a stable per-control reference (not the framework
// homepage); threats live in config under the house key `threats-mitigated`.
const control = (key, description, controlId, threats) => ({ [key]: { description, requirements: [{ 'requirement-url': `${AIGF}/mitigations/${controlId}`, config: { 'control-id': controlId, ...(threats ? { 'threats-mitigated': threats } : {}) } }] } });

// A loose layer/component pattern: must contain the anchor node + the listed
// node-types. `fileBase` names the file ($id); `anchorId` pins the anchor node.
function layerPattern(anchorId, fileBase, title, requiredTypes) {
  return {
    $schema: META,
    $id: url(`${fileBase}.pattern.json`),
    title,
    type: 'object',
    properties: {
      nodes: {
        type: 'array',
        minItems: 1,
        allOf: [
          { contains: { properties: { 'unique-id': { const: anchorId } }, required: ['unique-id'] } },
          ...requiredTypes.map((t) => ({ contains: { properties: { 'node-type': { const: t } }, required: ['node-type'] } })),
        ],
      },
      // Intentionally loose: patterns are structural gates (anchor id + the
      // layer's defining node-types must be present), letting detailed archs add
      // freely. A relationship-shape constraint here would trip the CLI's
      // relationship-references-existing-nodes-in-pattern rule.
      relationships: { type: 'array' },
    },
    required: ['nodes', 'relationships'],
  };
}

// A detailed (Tier-2) or instantiation (Tier-3) architecture conforming to a pattern.
function arch(patternFile, nodes, relationships) {
  return { $schema: url(patternFile), nodes, relationships };
}

// ── LAYER SPECS (Tier 2 — generic, deployable reference elaborations) ────────
// Each layer: an infra boundary node (deployed-in container) + deployable
// components. Non-deployable concepts (signal types, design patterns, "zoos")
// are intentionally absent; external SaaS lives in Tier 3 as `system`.
const LAYERS = [
  {
    id: 'user-interaction-layer', name: 'User Interaction Layer',
    description: 'Channels through which people interact with the multi-agent system.',
    types: ['webclient', 'service'],
    boundary: { id: 'edge-plane', name: 'Edge Plane', description: 'Public-facing deployment boundary (CDN/ingress).' },
    components: [
      node('web-app', 'webclient', 'Web Application', 'Browser client for end users.'),
      node('experience-api', 'service', 'Experience API', 'Backend-for-frontend that brokers user requests to the agent gateway.'),
    ],
    connects: [['ui-web-to-api', 'web-app', 'experience-api', 'User actions', 'HTTPS']],
  },
  {
    id: 'agent-gateway-layer', name: 'Agent Gateway Layer',
    description: 'Single entry point that authenticates, routes, and guards traffic into the agent layer.',
    types: ['ai:api-gateway', 'ai:guardrail', 'service'],
    boundary: { id: 'control-plane', name: 'Control Plane', description: 'Cluster boundary for gateways, registries and policy services.' },
    components: [
      node('agent-gateway', 'ai:api-gateway', 'Agent Gateway', 'Authenticated ingress and router for agent invocations.'),
      node('agent-registry', 'service', 'Agent Registry', 'Catalogue of available agents and their capabilities.'),
      node('agent-guardrails', 'ai:guardrail', 'Agent Guardrails', 'Input/output policy enforcement at the gateway.'),
    ],
    connects: [['agw-gw-to-registry', 'agent-gateway', 'agent-registry', 'Capability lookup', 'HTTPS'], ['agw-gw-to-guard', 'agent-gateway', 'agent-guardrails', 'Policy check', 'HTTPS']],
    controls: control('request-guarding', 'Enforce authentication, rate limiting and content policy on all agent traffic.', 'C11', ['unauthorized-access']),
  },
  {
    id: 'agent-layer', name: 'Agent Layer',
    description: 'Orchestrates task agents within a secure runtime, with state, memory and tools.',
    types: ['ai:orchestrator', 'ai:agent', 'service'],
    boundary: { id: 'agent-plane', name: 'Agent Runtime Plane', description: 'Isolated runtime boundary for agent execution.' },
    components: [
      node('agent-orchestrator', 'ai:orchestrator', 'Agent Orchestrator', 'Decomposes goals and coordinates task agents (supervisor role).'),
      node('agent-runtime', 'service', 'Agent Runtime', 'Sandboxed execution environment with state and handoff management.', { details: { 'detailed-architecture': url('agent-runtime.component.arch.json'), 'required-pattern': url('agent-runtime.component.pattern.json') } }),
      node('task-agent', 'ai:agent', 'Task Agent', 'Representative task-scoped agent workload (instantiated per use case).'),
      node('agent-state-store', 'database', 'Agent State Store', 'Durable conversation and workflow state.'),
      node('short-term-memory', 'ai:memory', 'Short-Term Memory', 'In-session working context for active runs.'),
      node('long-term-memory', 'ai:memory', 'Long-Term Memory', 'Persisted summaries and personalization across sessions.'),
      node('agent-tools', 'ai:tool', 'Agent Tools', 'Built-in tool surface (I/O, shell, web) available to agents.'),
    ],
    connects: [
      ['al-orch-to-agent', 'agent-orchestrator', 'task-agent', 'Dispatch task', 'HTTPS'],
      ['al-agent-to-runtime', 'task-agent', 'agent-runtime', 'Execute in sandbox', 'HTTPS'],
      ['al-runtime-to-state', 'agent-runtime', 'agent-state-store', 'Persist state', 'JDBC'],
      ['al-agent-to-stm', 'task-agent', 'short-term-memory', 'Working context', 'HTTPS'],
      ['al-agent-to-ltm', 'task-agent', 'long-term-memory', 'Recall/personalize', 'HTTPS'],
      ['al-agent-to-tools', 'task-agent', 'agent-tools', 'Invoke tool', 'HTTPS'],
    ],
    controls: {
      ...control('human-oversight', 'Require human approval for high-risk agent actions.', 'C3', ['autonomous-harm']),
      ...control('runtime-isolation', 'Execute agent code in a sandboxed, least-privilege runtime.', 'C14', ['code-execution']),
    },
  },
  {
    id: 'knowledge-layer', name: 'Knowledge Layer',
    description: 'Curated knowledge sources and retrieval indexes for grounding agents.',
    types: ['ai:knowledge-base', 'ai:vector-store', 'service'],
    boundary: { id: 'data-plane', name: 'Data Plane', description: 'Deployment boundary for stores and ingestion.' },
    components: [
      node('ingestion-pipeline', 'service', 'Ingestion Pipeline', 'Scans, filters and embeds source content before indexing.'),
      node('knowledge-base', 'ai:knowledge-base', 'Knowledge Base', 'Authoritative source documents and records.'),
      node('vector-store', 'ai:vector-store', 'Vector Store', 'Embedding index for semantic retrieval.'),
    ],
    connects: [['kl-ingest-to-kb', 'ingestion-pipeline', 'knowledge-base', 'Load source content', 'HTTPS'], ['kl-ingest-to-vec', 'ingestion-pipeline', 'vector-store', 'Write embeddings', 'HTTPS']],
    controls: control('data-filtering', 'Scan and filter sensitive content before it is embedded into the knowledge layer.', 'CN01', ['data-leakage']),
  },
  {
    id: 'llm-layer', name: 'LLM Layer',
    description: 'Governed access to language models through a gateway and registry.',
    types: ['ai:api-gateway', 'ai:llm', 'ai:guardrail'],
    boundary: { id: 'model-plane', name: 'Model Serving Plane', description: 'Deployment boundary for model serving and gateways.' },
    components: [
      node('llm-gateway', 'ai:api-gateway', 'LLM Gateway', 'Routing, quota and safety enforcement for model calls.'),
      node('model-registry', 'service', 'Model Registry', 'Approved models, versions and routing policy.'),
      node('model-serving', 'ai:llm', 'Model Serving', 'Managed/self-hosted model serving endpoint(s).'),
      node('llm-guardrails', 'ai:guardrail', 'LLM Guardrails', 'Prompt and response filtering.'),
    ],
    connects: [['llm-gw-to-registry', 'llm-gateway', 'model-registry', 'Resolve model', 'HTTPS'], ['llm-gw-to-serving', 'llm-gateway', 'model-serving', 'Inference', 'HTTPS'], ['llm-gw-to-guard', 'llm-gateway', 'llm-guardrails', 'Filter prompt/response', 'HTTPS']],
    controls: control('output-validation', 'Validate and filter model outputs before they leave the gateway.', 'C13', ['harmful-output']),
  },
  {
    id: 'mcp-layer', name: 'MCP Layer',
    description: 'Governed access to Model Context Protocol tool servers.',
    types: ['ai:api-gateway', 'ai:mcp-server', 'ai:guardrail'],
    boundary: { id: 'control-plane', name: 'Control Plane', description: 'Cluster boundary for gateways, registries and policy services.' },
    components: [
      node('mcp-gateway', 'ai:api-gateway', 'MCP Gateway', 'Authenticated ingress and policy enforcement for MCP tool calls.'),
      node('mcp-registry', 'service', 'MCP Server Registry', 'Catalogue of approved MCP servers and scopes.'),
      node('mcp-server', 'ai:mcp-server', 'MCP Server', 'Representative self-hosted MCP tool server (externals are instantiated in Tier 3).'),
      node('mcp-guardrails', 'ai:guardrail', 'MCP Guardrails', 'Tool authorization and argument validation.'),
    ],
    connects: [['mcp-gw-to-registry', 'mcp-gateway', 'mcp-registry', 'Resolve server', 'HTTPS'], ['mcp-gw-to-server', 'mcp-gateway', 'mcp-server', 'Invoke tool', 'HTTPS'], ['mcp-gw-to-guard', 'mcp-gateway', 'mcp-guardrails', 'Authorize tool call', 'HTTPS']],
    controls: control('tool-authorization', 'Authorize every tool invocation and validate its arguments against allowed scopes.', 'C36', ['tool-misuse']),
  },
  {
    id: 'evaluation-layer', name: 'Evaluation Layer',
    description: 'Continuous evaluation, human review and runtime protection of agent behaviour.',
    types: ['ai:eval-monitor', 'ai:human-in-the-loop', 'ai:guardrail'],
    boundary: { id: 'control-plane', name: 'Control Plane', description: 'Cluster boundary for gateways, registries and policy services.' },
    components: [
      node('eval-monitor', 'ai:eval-monitor', 'Evaluation Monitor', 'Scores agent outputs against quality and safety criteria.'),
      node('human-review', 'ai:human-in-the-loop', 'Human Review', 'Escalation queue for human adjudication of flagged decisions.'),
      node('runtime-protection', 'ai:guardrail', 'Runtime Protection', 'Real-time blocking of policy-violating actions.'),
      node('feedback-store', 'database', 'Feedback Store', 'Evaluation results and human feedback for improvement.'),
    ],
    connects: [['el-monitor-to-store', 'eval-monitor', 'feedback-store', 'Record scores', 'JDBC'], ['el-monitor-to-human', 'eval-monitor', 'human-review', 'Escalate', 'HTTPS']],
    controls: control('continuous-evaluation', 'Continuously evaluate agent outputs and route low-confidence decisions to human review.', 'C25', ['quality-drift']),
  },
  {
    id: 'observability-layer', name: 'Observability Layer',
    description: 'Telemetry collection, storage and analysis across the platform.',
    types: ['ai:observability', 'service'],
    boundary: { id: 'observability-plane', name: 'Observability Plane', description: 'Deployment boundary for telemetry infrastructure.' },
    components: [
      node('telemetry-collector', 'ai:observability', 'Telemetry Collector', 'Collects logs, traces, metrics and events from all components.'),
      node('observability-backend', 'ai:observability', 'Observability Backend', 'Stores and indexes telemetry signals.'),
      node('observability-dashboard', 'ai:observability', 'Observability Dashboard', 'Operator views over platform telemetry.'),
      node('anomaly-detection', 'service', 'Anomaly Detection', 'Flags anomalous behaviour from telemetry.'),
    ],
    connects: [['ol-coll-to-backend', 'telemetry-collector', 'observability-backend', 'Ship signals', 'HTTPS'], ['ol-backend-to-dash', 'observability-backend', 'observability-dashboard', 'Query', 'HTTPS'], ['ol-backend-to-anom', 'observability-backend', 'anomaly-detection', 'Analyze', 'HTTPS']],
    controls: control('audit-logging', 'Capture tamper-evident audit logs of agent decisions and tool calls.', 'C30', ['non-repudiation']),
  },
];

// ── Component-level docs (C4 "Component": internals of one container) ────────
// Linked from a Tier-2 container via details.detailed-architecture. The anchor
// id is reused from the parent (agent-runtime), keeping identity stable.
const COMPONENTS = [
  {
    id: 'agent-runtime', fileBase: 'agent-runtime.component', name: 'Agent Runtime', anchorType: 'service', c4Level: 'component',
    description: 'Internals of the sandboxed agent runtime container.',
    types: ['service'],
    boundary: { id: 'agent-plane', name: 'Agent Runtime Plane', description: 'Isolated runtime boundary for agent execution.' },
    components: [
      node('state-management', 'service', 'State Management', 'Tracks conversation and workflow state for active runs.'),
      node('secure-execution', 'service', 'Secure Execution', 'Sandboxes tool and code execution with least privilege.'),
      node('collaboration-handoff', 'service', 'Collaboration / Handoff', 'Coordinates context handoff between collaborating agents.'),
      node('context-manager', 'service', 'In-Session Context Manager', 'Assembles and trims the working context for each step.'),
    ],
    connects: [
      ['ar-ctx-to-state', 'context-manager', 'state-management', 'Read/write state', 'HTTPS'],
      ['ar-exec-to-ctx', 'secure-execution', 'context-manager', 'Update context', 'HTTPS'],
      ['ar-handoff-to-state', 'collaboration-handoff', 'state-management', 'Transfer state', 'HTTPS'],
    ],
  },
];

// ── Tier 2 + Component: emit per-spec pattern + detailed arch ────────────────
for (const L of [...LAYERS, ...COMPONENTS]) {
  const base = L.fileBase ?? L.id;
  write(`${base}.pattern.json`, layerPattern(L.id, base, `${L.name} Pattern`, L.types));

  const anchor = node(L.id, L.anchorType ?? 'system', L.name, L.description);
  const boundary = node(L.boundary.id, 'system', L.boundary.name, L.boundary.description);
  if (L.controls) anchor.controls = L.controls;

  const nodes = [anchor, boundary, ...L.components];
  const rels = [
    composedOf(`${L.id}-contains`, L.id, L.components.map((c) => c['unique-id']), `${L.name} components.`),
    ...L.connects.map(([id, s, d, desc, proto]) => connects(id, s, d, desc, proto)),
    deployedIn(`${L.id}-deployment`, L.boundary.id, L.components.map((c) => c['unique-id']), `${L.name} deploys onto the ${L.boundary.name}.`),
  ];
  // Each document DECLARES its C4 level (stable regardless of how the user
  // arrives at it) rather than the viewer inferring it from navigation depth.
  const a = arch(`${base}.pattern.json`, nodes, rels);
  a.metadata = { 'c4-level': L.c4Level ?? 'container' };
  write(`${base}.arch.json`, a);
}

// ── Tier 1: lean context document ───────────────────────────────────────────
const root = node('multi-agent-system', 'system', 'Multi-Agent Reference Architecture', 'AIGF-aligned reference architecture for governed multi-agent AI systems. Each layer links to a detailed, deployable elaboration.');
const layerNodes = LAYERS.map((L) => node(L.id, 'system', L.name, L.description, { details: { 'detailed-architecture': url(`${L.id}.arch.json`), 'required-pattern': url(`${L.id}.pattern.json`) } }));
const flowOrder = ['user-interaction-layer', 'agent-gateway-layer', 'agent-layer', 'knowledge-layer', 'llm-layer', 'mcp-layer', 'evaluation-layer'];
const tier1Rels = [
  composedOf('mas-contains', 'multi-agent-system', LAYERS.map((L) => L.id), 'The reference architecture is composed of eight layers.'),
  connects('flow-ui-gw', 'user-interaction-layer', 'agent-gateway-layer', 'User requests enter through the gateway', 'HTTPS'),
  connects('flow-gw-agent', 'agent-gateway-layer', 'agent-layer', 'Authenticated invocations reach the agents', 'HTTPS'),
  connects('flow-agent-knowledge', 'agent-layer', 'knowledge-layer', 'Agents retrieve grounding knowledge', 'HTTPS'),
  connects('flow-agent-llm', 'agent-layer', 'llm-layer', 'Agents call language models', 'HTTPS'),
  connects('flow-agent-mcp', 'agent-layer', 'mcp-layer', 'Agents call external tools via MCP', 'HTTPS'),
  connects('flow-agent-eval', 'agent-layer', 'evaluation-layer', 'Agent outputs are evaluated and reviewed', 'HTTPS'),
  connects('flow-eval-obs', 'evaluation-layer', 'observability-layer', 'Evaluation signals are observed', 'HTTPS'),
];
write('context.arch.json', { $schema: META, metadata: { 'c4-level': 'context' }, nodes: [root, ...layerNodes], relationships: tier1Rels });

// ── Tier 3: loan-origination instantiation (conforms to Tier-2 patterns) ────
// Each Tier-3 doc re-uses its layer anchor id and satisfies the layer pattern,
// adding the concrete loan-origination components.
write('loan/user-interaction.instance.arch.json', arch('user-interaction-layer.pattern.json',
  [
    node('user-interaction-layer', 'system', 'User Interaction Layer', 'Loan-origination user channels.'),
    node('applicant', 'actor', 'Applicant', 'A customer applying for a loan.'),
    node('loan-officer', 'actor', 'Loan Officer', 'Bank staff who review and approve applications.'),
    node('loan-origination-app', 'webclient', 'Loan Origination App', 'Web application for applicants and officers.'),
    node('experience-api', 'service', 'Experience API', 'Backend-for-frontend for the loan app.'),
  ],
  [
    composedOf('uil-loan-contains', 'user-interaction-layer', ['loan-origination-app', 'experience-api'], 'Loan UI components.'),
    interacts('uil-applicant-uses', 'applicant', ['loan-origination-app'], 'Applicant submits an application.'),
    interacts('uil-officer-uses', 'loan-officer', ['loan-origination-app'], 'Officer reviews applications.'),
    connects('uil-app-to-api', 'loan-origination-app', 'experience-api', 'Application requests', 'HTTPS'),
  ]));

write('loan/agent.instance.arch.json', arch('agent-layer.pattern.json',
  [
    node('agent-layer', 'system', 'Agent Layer', 'Loan-origination agent workforce.'),
    node('agent-orchestrator', 'ai:orchestrator', 'Workflow Orchestrator', 'Drives the loan-origination workflow.'),
    node('document-intelligence-agent', 'ai:agent', 'Document Intelligence Agent', 'Extracts data from submitted documents.'),
    node('fraud-detection-agent', 'ai:agent', 'Fraud Detection Agent', 'Screens applications for fraud signals.'),
    node('credit-risk-agent', 'ai:agent', 'Credit Risk Assessment Agent', 'Assesses applicant creditworthiness.'),
    node('compliance-review-agent', 'ai:agent', 'Compliance Review Agent', 'Checks regulatory and policy compliance.'),
    node('decision-gate', 'service', 'Decision Gate', 'Aggregates agent findings into an approval decision.'),
  ],
  [
    composedOf('al-loan-contains', 'agent-layer', ['agent-orchestrator', 'document-intelligence-agent', 'fraud-detection-agent', 'credit-risk-agent', 'compliance-review-agent', 'decision-gate'], 'Loan agents.'),
    connects('al-orch-doc', 'agent-orchestrator', 'document-intelligence-agent', 'Extract documents', 'HTTPS'),
    connects('al-orch-fraud', 'agent-orchestrator', 'fraud-detection-agent', 'Screen fraud', 'HTTPS'),
    connects('al-orch-credit', 'agent-orchestrator', 'credit-risk-agent', 'Assess credit', 'HTTPS'),
    connects('al-orch-compliance', 'agent-orchestrator', 'compliance-review-agent', 'Review compliance', 'HTTPS'),
    connects('al-orch-gate', 'agent-orchestrator', 'decision-gate', 'Decide', 'HTTPS'),
  ]));

write('loan/knowledge.instance.arch.json', arch('knowledge-layer.pattern.json',
  [
    node('knowledge-layer', 'system', 'Knowledge Layer', 'Loan-origination knowledge sources.'),
    node('ingestion-pipeline', 'service', 'Ingestion Pipeline', 'Filters and embeds loan policy content.'),
    node('underwriting-policy', 'ai:knowledge-base', 'Underwriting & Product Policy', 'Underwriting rules and product definitions.'),
    node('policy-vector-store', 'ai:vector-store', 'Policy Vector Store', 'Embeddings of policy and compliance rules.'),
    node('loan-records', 'database', 'Loan Application Records', 'Application and decision records.'),
  ],
  [
    composedOf('kl-loan-contains', 'knowledge-layer', ['ingestion-pipeline', 'underwriting-policy', 'policy-vector-store', 'loan-records'], 'Loan knowledge components.'),
    connects('kl-ingest-policy', 'ingestion-pipeline', 'underwriting-policy', 'Load policy', 'HTTPS'),
    connects('kl-ingest-vec', 'ingestion-pipeline', 'policy-vector-store', 'Write embeddings', 'HTTPS'),
  ]));

write('loan/mcp.instance.arch.json', arch('mcp-layer.pattern.json',
  [
    node('mcp-layer', 'system', 'MCP Layer', 'Loan-origination external integrations via MCP.'),
    node('mcp-gateway', 'ai:api-gateway', 'MCP Gateway', 'Governs calls to external services.'),
    node('mcp-registry', 'service', 'MCP Server Registry', 'Approved external integrations.'),
    node('mcp-guardrails', 'ai:guardrail', 'MCP Guardrails', 'Tool authorization and argument validation for external calls.'),
    node('document-parser', 'ai:mcp-server', 'Document Parser MCP Server', 'Self-hosted MCP server for OCR and document parsing.'),
    node('credit-bureau', 'system', 'Credit Bureau API', 'External credit bureau (third-party SaaS — connect, not deploy).'),
    node('kyc-service', 'system', 'KYC & Sanctions Screening', 'External KYC/AML screening service.'),
    node('esignature-service', 'system', 'E-Signature Service', 'External e-signature provider.'),
    node('disbursement-system', 'system', 'Disbursement System', 'External payments/disbursement system.'),
  ],
  [
    composedOf('mcp-loan-contains', 'mcp-layer', ['mcp-gateway', 'mcp-registry', 'mcp-guardrails', 'document-parser'], 'Self-hosted MCP control plane and tool server.'),
    connects('mcp-gw-parser', 'mcp-gateway', 'document-parser', 'Parse documents', 'HTTPS'),
    connects('mcp-gw-credit', 'mcp-gateway', 'credit-bureau', 'Credit pull', 'HTTPS'),
    connects('mcp-gw-kyc', 'mcp-gateway', 'kyc-service', 'KYC screen', 'HTTPS'),
    connects('mcp-gw-esign', 'mcp-gateway', 'esignature-service', 'Sign documents', 'HTTPS'),
    connects('mcp-gw-disburse', 'mcp-gateway', 'disbursement-system', 'Disburse funds', 'HTTPS'),
  ]));

// ── url mapping (URL → local filename, relative to this mapping file) ────────
const mapping = {};
mapping[url('context.arch.json')] = 'context.arch.json';
for (const L of [...LAYERS, ...COMPONENTS]) { const b = L.fileBase ?? L.id; mapping[url(`${b}.pattern.json`)] = `${b}.pattern.json`; mapping[url(`${b}.arch.json`)] = `${b}.arch.json`; }
write('url-mapping.json', mapping);

console.log('Generated series into', OUT.pathname);
