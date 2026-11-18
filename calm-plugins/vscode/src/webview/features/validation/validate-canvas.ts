import type { Edge, Node } from 'reactflow';
import type { CalmFlow } from '../../../core/types';
import { flowToCalm } from '../../transforms/calm-editor-transformer';
import { validateArchitecture } from '../../utils/validation';
import type { ValidationIssue } from '../../stores/canvas-store';

interface StandardNodeControls {
    id?: string;
    controls?: Record<string, unknown>;
}

interface ValidateCanvasInput {
    nodes: Node[];
    edges: Edge[];
    documentControls: Record<string, unknown>;
    flows: CalmFlow[];
    standardNodes: StandardNodeControls[];
}

interface ValidateCanvasResult {
    issues: ValidationIssue[];
    nodes: Node[];
}

export function validateCanvas({ nodes, edges, documentControls, flows, standardNodes }: ValidateCanvasInput): ValidateCanvasResult {
    const paletteControlsById = new Map<string, Record<string, unknown>>();
    for (const standardNode of standardNodes) {
        if (standardNode.id && standardNode.controls && Object.keys(standardNode.controls).length > 0) {
            paletteControlsById.set(standardNode.id, standardNode.controls);
        }
    }

    const effectiveNodes = nodes.map((node) => {
        const data = (node.data ?? {}) as Record<string, unknown>;
        const metadata = data.metadata as Record<string, unknown> | undefined;
        const sourceId = metadata?.['source-standard-node'] as string | undefined;
        const paletteControls = sourceId ? paletteControlsById.get(sourceId) : undefined;
        const currentControls = data.controls as Record<string, unknown> | undefined;
        if (!paletteControls || (currentControls && Object.keys(currentControls).length > 0)) return node;
        return { ...node, data: { ...data, controls: JSON.parse(JSON.stringify(paletteControls)) as Record<string, unknown> } };
    });

    const architecture = flowToCalm(effectiveNodes, edges, documentControls, flows);
    const architectureNodes = architecture.nodes ?? [];
    const issues = validateArchitecture(architecture);
    let controlCount = Object.keys((architecture.controls as Record<string, unknown>) ?? {}).length;
    for (const node of architectureNodes) {
        const controls = node.controls as Record<string, unknown> | undefined;
        if (controls) controlCount += Object.keys(controls).length;
    }

    if (issues.length === 0) {
        issues.push({
            severity: 'info',
            message: controlCount === 0
                ? `Valid — ${architectureNodes.length} node(s), but 0 controls found. Drop a standard node that defines controls (e.g. "Microservice") onto a node, then Validate.`
                : `Valid — checked ${architectureNodes.length} node(s) and ${controlCount} control(s); all requirements satisfied.`,
        });
    }

    const counts: Record<string, { errors: number; warnings: number }> = {};
    for (const issue of issues) {
        if (!issue.nodeId) continue;
        const count = counts[issue.nodeId] ?? { errors: 0, warnings: 0 };
        if (issue.severity === 'error') count.errors++;
        else if (issue.severity === 'warning') count.warnings++;
        counts[issue.nodeId] = count;
    }

    return {
        issues,
        nodes: effectiveNodes.map((node) => ({
            ...node,
            data: {
                ...(node.data as Record<string, unknown>),
                validationErrors: counts[node.id]?.errors ?? 0,
                validationWarnings: counts[node.id]?.warnings ?? 0,
            },
        })),
    };
}