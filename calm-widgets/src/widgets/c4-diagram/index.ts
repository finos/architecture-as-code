import {
    C4_LEVELS,
    c4Scopes,
    c4View,
    defaultC4Mapping,
    projectC4,
    withDetailedArchitectures,
    type C4ArchitectureInput,
    type C4Element,
    type C4Level,
    type C4Model,
    type C4View,
    type ResolvedC4Mapping,
} from '@finos/calm-models/c4';
import { CalmWidget } from '../../types';

export interface C4DiagramOptions {
    /** `context` (the default), `container`, `component` or `deployment`. */
    level?: string;
    /** The unique-id of the system or container the diagram is about. Defaults to the first one at the level. */
    scope?: string;
    title?: string;
}

export interface C4DiagramViewModel {
    lines: string[];
}

let configuredMapping: ResolvedC4Mapping | undefined;

/** Sets the C4 mapping that every `c4-diagram` uses, such as the one from `calm docify --c4-mapping`. */
export function setC4Mapping(mapping: ResolvedC4Mapping | undefined): void {
    configuredMapping = mapping;
}

interface ArchitectureLike {
    title?: unknown;
    nodes: { 'unique-id': string; 'node-type': string; name?: string; description?: string; details?: unknown }[];
    relationships?: C4ArchitectureInput['relationships'];
}

function isArchitecture(context: unknown): context is ArchitectureLike {
    return typeof context === 'object' && context !== null && Array.isArray((context as { nodes?: unknown }).nodes);
}

/**
 * In a docify model, `details` holds the dereferenced detailed architecture. It gives rule 5 of the C4 standard
 * its next level down.
 */
function toInput(architecture: ArchitectureLike): C4ArchitectureInput {
    const details: Record<string, C4ArchitectureInput> = {};
    const nodes = architecture.nodes.map(({ details: detail, ...node }) => {
        if (isArchitecture(detail)) details[node['unique-id']] = toInput(detail);
        return node;
    });
    const input = {
        title: typeof architecture.title === 'string' ? architecture.title : undefined,
        nodes,
        relationships: architecture.relationships ?? [],
    };
    return withDetailedArchitectures(input, details);
}

const MERMAID_DIAGRAM: Record<C4Level, string> = {
    context: 'C4Context',
    container: 'C4Container',
    component: 'C4Component',
    deployment: 'C4Deployment',
};

/** Mermaid C4 text takes no escapes, so a quote becomes an apostrophe. */
function text(value: string | undefined): string {
    return `"${(value ?? '').replace(/"/g, '\'').replace(/\s+/g, ' ').trim()}"`;
}

class Writer {
    readonly lines: string[] = [];
    private readonly aliases = new Map<string, string>();
    private depth = 1;

    alias(id: string): string {
        const existing = this.aliases.get(id);
        if (existing) return existing;
        const base = id.replace(/[^A-Za-z0-9_]/g, '_') || 'element';
        let alias = base;
        for (let n = 2; [...this.aliases.values()].includes(alias); n++) alias = `${base}_${n}`;
        this.aliases.set(id, alias);
        return alias;
    }

    line(value: string) {
        this.lines.push(`${'    '.repeat(this.depth)}${value}`);
    }

    block(open: string, body: () => void) {
        this.line(`${open} {`);
        this.depth++;
        body();
        this.depth--;
        this.line('}');
    }

    element(element: C4Element) {
        const external = element.external.length > 0 ? '_Ext' : '';
        const database = element.nodeType === 'database' ? 'Db' : '';
        const alias = this.alias(element.id);
        const nodeType = text(element.nodeType);
        switch (element.kind) {
        case 'person':
            return this.line(`Person${external}(${alias}, ${text(element.name)}, ${text(element.description)})`);
        case 'software-system':
            return this.line(`System${database}${external}(${alias}, ${text(element.name)}, ${text(element.description)})`);
        case 'component':
            return this.line(`Component${database}${external}(${alias}, ${text(element.name)}, ${nodeType}, ${text(element.description)})`);
        default:
            return this.line(`Container${database}${external}(${alias}, ${text(element.name)}, ${nodeType}, ${text(element.description)})`);
        }
    }
}

function writeView(view: C4View, model: C4Model, title: string | undefined): string[] {
    const writer = new Writer();
    if (title) writer.line(`title ${title.replace(/\s+/g, ' ')}`);

    if (view.deployments) {
        for (const { node, hosted } of view.deployments) {
            writer.block(`Deployment_Node(${writer.alias(node.id)}, ${text(node.name)}, ${text(node.nodeType)})`, () => hosted.forEach((h) => writer.element(h)));
        }
    } else if (view.level === 'context') {
        const boundary = [...model.elements.values()].find((e) => e.kind === 'enterprise-boundary');
        const outsideEnterprise = (e: C4Element) => e.external.includes('outside-enterprise') || e.external.includes('mapped-external');
        if (boundary) {
            writer.block(`Enterprise_Boundary(${writer.alias(boundary.id)}, ${text(boundary.name)})`, () =>
                view.outside.filter((e) => !outsideEnterprise(e)).forEach((e) => writer.element(e)),
            );
            view.outside.filter(outsideEnterprise).forEach((e) => writer.element(e));
        } else {
            view.outside.forEach((e) => writer.element(e));
        }
    } else if (view.scope) {
        const kind = view.scope.kind === 'container' ? 'Container_Boundary' : 'System_Boundary';
        writer.block(`${kind}(${writer.alias(view.scope.id)}, ${text(view.scope.name)})`, () => view.inside.forEach((e) => writer.element(e)));
        view.outside.forEach((e) => writer.element(e));
    }

    for (const relationship of view.relationships) {
        const label = relationship.count > 1 ? `${relationship.label} (${relationship.count} relationships)` : relationship.label;
        const technology = relationship.technology ? `, ${text(relationship.technology)}` : '';
        writer.line(`Rel(${writer.alias(relationship.source)}, ${writer.alias(relationship.target)}, ${text(label)}${technology})`);
    }
    return [MERMAID_DIAGRAM[view.level], ...writer.lines];
}

export const C4DiagramWidget: CalmWidget<ArchitectureLike, C4DiagramOptions, C4DiagramViewModel> = {
    id: 'c4-diagram',
    templatePartial: 'c4-diagram-template.hbs',

    transformToViewModel: (architecture, options) => {
        const level = (options?.level ?? 'context') as C4Level;
        if (!C4_LEVELS.includes(level)) {
            throw new Error(`c4-diagram level must be one of ${C4_LEVELS.join(', ')}, not '${options?.level}'`);
        }
        const model = projectC4(toInput(architecture), configuredMapping ?? defaultC4Mapping());
        const scopes = c4Scopes(model, level);
        const scope = options?.scope === undefined ? scopes[0] : scopes.find((s) => s.id === options.scope);
        if (level !== 'deployment' && !scope) {
            const known = scopes.map((s) => s.id).join(', ') || 'none';
            throw new Error(`c4-diagram has no ${level} diagram for scope '${options?.scope ?? ''}'. Scopes at this level: ${known}`);
        }
        return { lines: writeView(c4View(model, level, scope?.id), model, options?.title) };
    },

    validateContext: (context): context is ArchitectureLike => isArchitecture(context),
};
