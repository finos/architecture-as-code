#!/usr/bin/env tsx
/**
 * generate-api-docs.ts
 *
 * Generates docs/docs/api/reference.md by extracting Zod schema definitions
 * from source files using regex-based parsing. Produces a Markdown API reference
 * documenting all CALMGuard API endpoints with their request/response schemas.
 *
 * Usage: pnpm docs:api
 */

import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUTPUT_PATH = path.join(PROJECT_ROOT, 'docs', 'docs', 'api', 'reference.md');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Field {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

interface SchemaInfo {
  name: string;
  fields: Field[];
}

interface Endpoint {
  method: string;
  path: string;
  description: string;
  requestSchema?: SchemaInfo;
  responseSchema?: SchemaInfo;
  statusCodes: Array<{ code: number; description: string }>;
  example?: {
    request?: string;
    response?: string;
  };
}

// ---------------------------------------------------------------------------
// Schema extraction helpers
// ---------------------------------------------------------------------------

/**
 * Extract Zod object field definitions from source TypeScript.
 * Handles: z.string(), z.number(), z.boolean(), z.array(), z.enum(), z.unknown(), .optional()
 */
function extractZodFields(source: string, schemaName: string): Field[] {
  // Find the schema definition block
  const schemaStart = source.indexOf(`${schemaName} = z.object({`);
  if (schemaStart === -1) return [];

  let depth = 0;
  let i = source.indexOf('{', schemaStart);
  const start = i;

  for (; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) break;
    }
  }

  const block = source.slice(start + 1, i);
  const fields: Field[] = [];

  // Match field definitions: fieldName: z.TYPE(.optional())
  const fieldRegex = /^\s*['"]?([\w-]+)['"]?\s*:\s*(z\.[^,\n]+)/gm;
  let match;

  while ((match = fieldRegex.exec(block)) !== null) {
    const fieldName = match[1];
    const fieldDef = match[2].trim();
    const required = !fieldDef.includes('.optional()');

    let type = extractTypeName(fieldDef);
    const description = extractDescription(source, fieldName);

    fields.push({ name: fieldName, type, required, description });
  }

  return fields;
}

/**
 * Convert a Zod type expression to a readable type string.
 */
function extractTypeName(zodExpr: string): string {
  if (zodExpr.startsWith('z.string()')) return 'string';
  if (zodExpr.startsWith('z.number()')) return 'number';
  if (zodExpr.startsWith('z.boolean()')) return 'boolean';
  if (zodExpr.startsWith('z.unknown()')) return 'any';
  if (zodExpr.startsWith('z.literal(')) {
    const m = zodExpr.match(/z\.literal\(['"]([^'"]+)['"]\)/);
    return m ? `"${m[1]}"` : 'literal';
  }
  if (zodExpr.startsWith('z.array(')) {
    const inner = zodExpr.slice('z.array('.length, zodExpr.lastIndexOf(')'));
    return `${extractTypeName(inner)}[]`;
  }
  if (zodExpr.startsWith('z.enum(')) {
    const m = zodExpr.match(/z\.enum\(\[([^\]]+)\]\)/);
    if (m) {
      return m[1].split(',').map(v => v.trim().replace(/['"]/g, '')).join(' | ');
    }
    return 'enum';
  }
  if (zodExpr.startsWith('z.record(')) return 'Record<string, any>';
  if (zodExpr.startsWith('z.object(')) return 'object';
  return 'any';
}

/**
 * Try to extract a JSDoc-style comment above a field definition.
 */
function extractDescription(source: string, fieldName: string): string {
  const fieldIndex = source.indexOf(`${fieldName}:`);
  if (fieldIndex === -1) return '';

  // Look backwards for a comment
  const before = source.slice(Math.max(0, fieldIndex - 200), fieldIndex);
  const commentMatch = before.match(/\/\*\*\s*([\s\S]*?)\s*\*\/\s*$/);
  if (commentMatch) {
    return commentMatch[1]
      .split('\n')
      .map(l => l.replace(/^\s*\*\s?/, ''))
      .join(' ')
      .trim();
  }
  return '';
}

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

/** Escape curly braces in MDX table cells to prevent JSX parse errors */
function escapeMdx(text: string): string {
  return text.replace(/\{/g, '&#123;').replace(/\}/g, '&#125;');
}

function renderFieldTable(fields: Field[]): string {
  if (fields.length === 0) return '*No fields defined*\n';

  const rows = fields.map(f => {
    const req = f.required ? 'Yes' : 'No';
    const desc = escapeMdx(f.description || '—');
    return `| \`${f.name}\` | \`${f.type}\` | ${req} | ${desc} |`;
  });

  return [
    '| Field | Type | Required | Description |',
    '|-------|------|----------|-------------|',
    ...rows,
  ].join('\n') + '\n';
}

function renderEndpoint(ep: Endpoint): string {
  const lines: string[] = [];

  lines.push(`## \`${ep.method} ${ep.path}\``);
  lines.push('');
  lines.push(ep.description);
  lines.push('');

  // Status codes
  lines.push('### Status Codes');
  lines.push('');
  lines.push('| Code | Description |');
  lines.push('|------|-------------|');
  for (const sc of ep.statusCodes) {
    lines.push(`| ${sc.code} | ${escapeMdx(sc.description)} |`);
  }
  lines.push('');

  // Request schema
  if (ep.requestSchema) {
    lines.push(`### Request Body (${ep.requestSchema.name})`);
    lines.push('');
    lines.push('Content-Type: `application/json`');
    lines.push('');
    lines.push(renderFieldTable(ep.requestSchema.fields));
  }

  // Response schema
  if (ep.responseSchema) {
    lines.push(`### Response Body (${ep.responseSchema.name})`);
    lines.push('');
    lines.push(renderFieldTable(ep.responseSchema.fields));
  }

  // Examples
  if (ep.example?.request) {
    lines.push('### Example Request');
    lines.push('');
    lines.push('```json');
    lines.push(ep.example.request);
    lines.push('```');
    lines.push('');
  }

  if (ep.example?.response) {
    lines.push('### Example Response');
    lines.push('');
    lines.push('```json');
    lines.push(ep.example.response);
    lines.push('```');
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main generation
// ---------------------------------------------------------------------------

function generate(): string {
  // Read source files for schema extraction
  const agentTypesSource = fs.readFileSync(
    path.join(PROJECT_ROOT, 'src', 'lib', 'agents', 'types.ts'),
    'utf-8',
  );
  // Extract key schemas
  const agentEventFields = extractZodFields(agentTypesSource, 'agentEventSchema');

  // Define endpoints
  const endpoints: Endpoint[] = [
    {
      method: 'POST',
      path: '/api/analyze',
      description: [
        'Runs the full 4-agent analysis pipeline on a CALM architecture document.',
        'Returns a **Server-Sent Events (SSE) stream** (`text/event-stream`).',
        '',
        'Events stream in real-time as agents execute. The stream closes after a terminal',
        '`done` or `error` event.',
        '',
        '> **Note:** This is an SSE endpoint, not a standard JSON endpoint.',
        '> Use `EventSource` in the browser or any SSE client.',
      ].join('\n'),
      requestSchema: {
        name: 'AnalyzeRequest',
        fields: [
          {
            name: 'calm',
            type: 'CalmDocument',
            required: true,
            description: 'The CALM architecture JSON to analyze',
          },
          {
            name: 'frameworks',
            type: 'string[]',
            required: false,
            description: 'Compliance frameworks to evaluate: "SOX" | "PCI-DSS" | "NIST-CSF" | "CCC". Defaults to all four.',
          },
        ],
      },
      responseSchema: {
        name: 'SSE Events',
        fields: agentEventFields.length > 0 ? agentEventFields : [
          { name: 'type', type: 'started | thinking | finding | completed | error | done', required: true, description: 'Event type' },
          { name: 'agent', type: 'AgentIdentity', required: true, description: 'Agent that emitted the event' },
          { name: 'message', type: 'string', required: false, description: 'Human-readable event message' },
          { name: 'severity', type: 'critical | high | medium | low | info', required: false, description: 'Finding severity (finding events only)' },
          { name: 'data', type: 'any', required: false, description: 'Structured result data (completed events)' },
          { name: 'timestamp', type: 'string (ISO 8601)', required: true, description: 'Event timestamp' },
        ],
      },
      statusCodes: [
        { code: 200, description: 'SSE stream opened. Events stream until analysis completes.' },
        { code: 400, description: 'Invalid request body or invalid CALM document.' },
        { code: 500, description: 'Catastrophic failure before stream could open.' },
      ],
      example: {
        request: JSON.stringify(
          { calm: { nodes: [{ 'unique-id': 'svc-1', 'node-type': 'service', name: 'Payment API', description: 'Handles payments' }], relationships: [] }, frameworks: ['PCI-DSS', 'SOX'] },
          null,
          2,
        ),
        response: [
          'data: {"type":"started","agent":{"name":"architecture-analyzer","displayName":"Architecture Analyzer","icon":"search","color":"#8b5cf6"},"timestamp":"2026-02-24T10:00:00Z"}',
          '',
          'data: {"type":"finding","agent":{...},"message":"Missing encryption controls on service node","severity":"high","timestamp":"2026-02-24T10:00:02Z"}',
          '',
          'data: {"type":"done","result":{"score":65,"findings":[...],"pipeline":{...}}}',
        ].join('\n'),
      },
    },
    {
      method: 'POST',
      path: '/api/calm/parse',
      description: [
        'Validates and parses a CALM JSON document **without running AI agents**.',
        'Use this endpoint for pre-flight validation before triggering a full analysis.',
        '',
        'Returns the parsed `AnalysisInput` (structured representation of the CALM document)',
        'on success, or a `ParseError` with field-level validation issues on failure.',
      ].join('\n'),
      requestSchema: {
        name: 'ParseRequest',
        fields: [
          {
            name: 'calm',
            type: 'unknown',
            required: true,
            description: 'The CALM JSON to validate. Any shape is accepted — validation reports issues.',
          },
        ],
      },
      responseSchema: {
        name: 'ParseResponse',
        fields: [
          { name: 'success', type: 'boolean', required: true, description: 'Whether the CALM document is valid' },
          { name: 'data', type: 'AnalysisInput', required: false, description: 'Parsed analysis input (present when success=true)' },
          { name: 'error', type: 'string', required: false, description: 'Error message (present when success=false)' },
          { name: 'details', type: 'ParseError', required: false, description: 'Field-level validation issues (present when success=false)' },
        ],
      },
      statusCodes: [
        { code: 200, description: 'CALM document is valid. Returns success=true with data as AnalysisInput.' },
        { code: 400, description: 'Invalid request body or CALM validation failure. Returns error and details.' },
      ],
      example: {
        request: JSON.stringify({ calm: { nodes: [], relationships: [] } }, null, 2),
        response: JSON.stringify(
          {
            error: 'Invalid CALM document',
            details: {
              issues: [
                { path: ['nodes'], message: 'Array must contain at least 1 element(s)' },
              ],
            },
          },
          null,
          2,
        ),
      },
    },
    {
      method: 'GET',
      path: '/api/pipeline',
      description: [
        'Returns the pipeline configuration generated by the most recent analysis.',
        '',
        'The pipeline result is stored in memory (`globalThis.__lastPipelineResult`) after',
        'a successful `/api/analyze` call. This endpoint retrieves it.',
        '',
        '> **Note:** This is ephemeral in-memory storage. The pipeline result is lost on',
        '> server restart. In production, pipeline configs should be persisted to a database.',
      ].join('\n'),
      statusCodes: [
        { code: 200, description: 'Returns the PipelineConfig JSON.' },
        { code: 404, description: 'No pipeline result available. Run /api/analyze first.' },
      ],
      example: {
        response: JSON.stringify(
          {
            githubActions: {
              name: 'Security Scanning',
              on: { push: { branches: ['main'] }, pull_request: {} },
              jobs: {
                security: {
                  'runs-on': 'ubuntu-latest',
                  steps: [
                    { name: 'Checkout', uses: 'actions/checkout@v4' },
                    { name: 'Run Trivy', uses: 'aquasecurity/trivy-action@master', with: { 'scan-type': 'fs', format: 'sarif' } },
                  ],
                },
              },
            },
          },
          null,
          2,
        ),
      },
    },
  ];

  // Build the markdown document
  const lines: string[] = [
    '---',
    'sidebar_position: 7',
    'title: API Reference',
    '---',
    '',
    '# API Reference',
    '',
    '> This page is auto-generated from Zod schema source files by `scripts/generate-api-docs.ts`.',
    '> Run `pnpm docs:api` to regenerate.',
    '',
    `*Generated: ${new Date().toISOString()}*`,
    '',
    'CALMGuard exposes three API routes. All routes are Next.js App Router API routes in `src/app/api/`.',
    '',
    '| Method | Path | Purpose |',
    '|--------|------|---------|',
    '| POST | `/api/analyze` | Run full analysis — returns SSE stream |',
    '| POST | `/api/calm/parse` | Validate CALM document — no AI |',
    '| GET | `/api/pipeline` | Retrieve last generated pipeline config |',
    '',
  ];

  for (const ep of endpoints) {
    lines.push(renderEndpoint(ep));
    lines.push('---');
    lines.push('');
  }

  lines.push('## Error Response Format');
  lines.push('');
  lines.push('All non-SSE error responses follow this shape:');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify({ error: 'Description of the error', issues: [{ path: ['field'], message: 'Validation message' }] }, null, 2));
  lines.push('```');
  lines.push('');
  lines.push('## CALM Document Schema');
  lines.push('');
  lines.push('The CALM document schema is defined in `src/lib/calm/types.ts` using Zod.');
  lines.push('See [Uploading Architectures](/uploading-architectures) for the full structure.');
  lines.push('');
  lines.push('## Agent Event Schema');
  lines.push('');
  lines.push('Defined in `src/lib/agents/types.ts`:');
  lines.push('');
  lines.push('```typescript');
  lines.push("type AgentEventType = 'started' | 'thinking' | 'finding' | 'completed' | 'error';");
  lines.push("type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';");
  lines.push('');
  lines.push('interface AgentEvent {');
  lines.push('  type: AgentEventType;');
  lines.push('  agent: {');
  lines.push('    name: string;');
  lines.push('    displayName: string;');
  lines.push('    icon: string;');
  lines.push('    color: string;');
  lines.push('  };');
  lines.push('  message?: string;');
  lines.push('  severity?: Severity;');
  lines.push('  data?: unknown;');
  lines.push('  timestamp: string; // ISO 8601');
  lines.push('}');
  lines.push('```');
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const output = generate();
fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_PATH, output, 'utf-8');
console.log(`Generated API reference: ${OUTPUT_PATH}`);
console.log(`Lines: ${output.split('\n').length}`);
