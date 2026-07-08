import { Architecture, CalmControl } from '@finos/calm-models/model';

/**
 * The scope at which a control is applied within an architecture.
 */
export type ControlScope = 'Architecture' | 'Node' | 'Relationship' | 'Flow';

/**
 * A single control location within an architecture, together with everything needed
 * to both validate it (index-based `pathPrefix`) and index it (`scope`/`appliedTo`).
 *
 * This is the single place the CALM control hierarchy (top-level / nodes / relationships /
 * flows) is enumerated for control validation.
 */
export interface ControlLocation {
    /** JSON-pointer-style prefix to the control, e.g. `/nodes/0/controls`. */
    pathPrefix: string;
    /** The scope at which the control is applied. */
    scope: ControlScope;
    /** The unique-id of the owning node/relationship/flow (empty for top-level). */
    appliedTo: string;
    /** The control identifier (key within the controls object). */
    controlId: string;
    /** The control itself. */
    control: CalmControl;
}

function* controlsAt(
    controls: { data: Record<string, CalmControl> } | undefined,
    pathPrefix: string,
    scope: ControlScope,
    appliedTo: string
): Generator<ControlLocation> {
    if (!controls) {
        return;
    }
    for (const [controlId, control] of Object.entries(controls.data)) {
        yield { pathPrefix, scope, appliedTo, controlId, control };
    }
}

/**
 * Enumerate every control in an architecture across all scopes in document order:
 * top-level, then nodes, then relationships, then flows.
 */
export function* iterateControls(architecture: Architecture): Generator<ControlLocation> {
    yield* controlsAt(architecture.controls, '/controls', 'Architecture', '');

    for (let nodeIdx = 0; nodeIdx < architecture.nodes.length; nodeIdx++) {
        const node = architecture.nodes[nodeIdx];
        yield* controlsAt(node.controls, `/nodes/${nodeIdx}/controls`, 'Node', node.uniqueId);
    }

    for (let relIdx = 0; relIdx < architecture.relationships.length; relIdx++) {
        const relationship = architecture.relationships[relIdx];
        yield* controlsAt(relationship.controls, `/relationships/${relIdx}/controls`, 'Relationship', relationship.uniqueId);
    }

    const flows = architecture.flows ?? [];
    for (let flowIdx = 0; flowIdx < flows.length; flowIdx++) {
        const flow = flows[flowIdx];
        yield* controlsAt(flow.controls, `/flows/${flowIdx}/controls`, 'Flow', flow.uniqueId);
    }
}
