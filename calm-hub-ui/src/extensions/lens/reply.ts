import type { DiagramLensContribution, LensControl, LensLink, LensReply } from '../../model/lens.js';

/** The limits of lens.schema.json. A larger reply shows a message, so one reply cannot lock the browser. */
export const LENS_LIMITS = { nodes: 500, edges: 2000, groups: 200 } as const;

export type ParsedReply = { reply: LensReply; problem?: never } | { reply?: never; problem: string };

// The other bounds of lens.schema.json. Hub renders each part on the main thread, so it checks every bound first.
const MAX = { text: 500, label: 200, short: 40, port: 64, tags: 16, tag: 64, calm: 32, calmId: 256, badges: 4, fields: 8,
    sections: 4, sectionItems: 50, params: 8, param: 128, href: 2048, controls: 8, controlItems: 200, panels: 4,
    panelTitle: 100, blocks: 20 } as const;

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string';
const isText = (max: number = MAX.text) => (value: unknown): value is string => isString(value) && value.length <= max;
const isListOf = (max: number, check: (value: unknown) => boolean) => (value: unknown) =>
    value === undefined || (Array.isArray(value) && value.length <= max && value.every(check));
const isTags = isListOf(MAX.tags, isText(MAX.tag));
const isCalmIds = isListOf(MAX.calm, isText(MAX.calmId));
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isOptional = (value: unknown, check: (value: unknown) => boolean) => value === undefined || check(value);
const isRecordOf = (max: number, check: (value: unknown) => boolean) => (value: unknown) =>
    value === undefined || (isObject(value) && Object.keys(value).length <= max && Object.values(value).every(check));
const isPosition = (value: unknown) => isObject(value) && isNumber(value.x) && isNumber(value.y);
const isLink = (value: unknown): value is LensLink => {
    if (!isObject(value)) return false;
    const kinds = ['params', 'hub', 'href'].filter((key) => value[key] !== undefined);
    if (kinds.length !== 1) return false;
    if (value.params !== undefined) return isObject(value.params) && isRecordOf(MAX.params, isText(MAX.param))(value.params);
    if (value.href !== undefined) return isText(MAX.href)(value.href) && value.href.startsWith('https://');
    const hub = value.hub;
    return isObject(hub) && isString(hub.namespace) && isString(hub.type) && isString(hub.id) && isOptional(hub.version, isString);
};

/**
 * Checks a lens reply before Hub lays it out. The problem names the first fault, for the author of the extension:
 * the renderer reads ids, labels and references without further checks.
 */
export function parseLensReply(value: unknown, hubApi: number, lens: DiagramLensContribution): ParsedReply {
    if (!isObject(value) || value.hubApi !== hubApi || value.kind !== 'graph' || !isObject(value.graph)) {
        return { problem: `The reply is not a hubApi ${hubApi} graph.` };
    }
    const { nodes = undefined, edges = [], groups = [] } = value.graph;
    if (!Array.isArray(nodes) || !Array.isArray(edges) || !Array.isArray(groups)) {
        return { problem: 'The graph needs arrays of nodes, edges and groups.' };
    }
    for (const [name, list] of [['nodes', nodes], ['edges', edges], ['groups', groups]] as const) {
        if (list.length > LENS_LIMITS[name]) {
            return { problem: `The graph has ${list.length} ${name}. A lens can show at most ${LENS_LIMITS[name]}.` };
        }
    }
    const ids = new Set<string>();
    const groupIds = new Set<string>();
    const claim = (id: unknown, what: string) => {
        if (!isString(id) || id === '' || id.length > 128) return `A ${what} has no id, or an id over 128 characters.`;
        if (ids.has(id)) return `The id '${id}' is used twice.`;
        ids.add(id);
        return undefined;
    };
    for (const group of groups) {
        const problem = !isObject(group) ? 'A group is not an object.' : claim(group.id, 'group');
        if (problem) return { problem };
        groupIds.add(group.id as string);
    }
    for (const group of groups as Record<string, unknown>[]) {
        if (!isOptional(group.label, isText(MAX.label)) || !isTags(group.tags) || !isCalmIds(group.calm)
            || !isOptional(group.position, isPosition)) {
            return { problem: `Group '${group.id}' has a field of the wrong type.` };
        }
        if (group.parent !== undefined && !groupIds.has(group.parent as string)) {
            return { problem: `Group '${group.id}' has an unknown parent '${String(group.parent)}'.` };
        }
    }
    const parents = new Map((groups as { id: string; parent?: string }[]).map((group) => [group.id, group.parent]));
    for (const id of groupIds) {
        const seen = new Set<string>();
        for (let at: string | undefined = id; at !== undefined; at = parents.get(at)) {
            if (seen.has(at)) return { problem: `Group '${id}' is inside itself.` };
            seen.add(at);
        }
    }
    for (const node of nodes) {
        const problem = !isObject(node) ? 'A node is not an object.' : claim(node.id, 'node');
        if (problem) return { problem };
        const valid = isText(MAX.label)(node.label) && node.label !== ''
            && [node.metadata, node.description, node.tooltip].every((text) => isOptional(text, isText()))
            && isTags(node.tags) && isCalmIds(node.calm)
            && isRecordOf(MAX.fields, isText())(node.fields)
            && isRecordOf(MAX.sections, isListOf(MAX.sectionItems, isText(MAX.label)))(node.sections)
            && isListOf(MAX.badges, (badge) => isObject(badge) && isText(MAX.short)(badge.text))(node.badges)
            && isOptional(node.link, isLink) && isOptional(node.position, isPosition);
        if (!valid) return { problem: `Node '${node.id}' has a field of the wrong type.` };
        if (node.group !== undefined && !groupIds.has(node.group as string)) {
            return { problem: `Node '${node.id}' is in an unknown group '${String(node.group)}'.` };
        }
    }
    // An edge joins a node or a group. Edge ids are unique among edges only.
    const ends = new Set(ids);
    ids.clear();
    for (const edge of edges) {
        const problem = !isObject(edge) ? 'An edge is not an object.' : claim(edge.id, 'edge');
        if (problem) return { problem };
        for (const end of ['source', 'target'] as const) {
            if (!isString(edge[end]) || !ends.has(edge[end])) {
                return { problem: `Edge '${edge.id}' has an unknown ${end} '${String(edge[end])}'.` };
            }
        }
        const valid = isOptional(edge.label, isText()) && isOptional(edge.tooltip, isText())
            && isOptional(edge.technology, isText(MAX.label))
            && [edge.startLabel, edge.endLabel].every((text) => isOptional(text, isText(MAX.short)))
            && [edge.sourcePort, edge.targetPort].every((text) => isOptional(text, isText(MAX.port)))
            && isTags(edge.tags) && isCalmIds(edge.calm);
        if (!valid) return { problem: `Edge '${edge.id}' has a field of the wrong type.` };
    }
    const controls = value.controls ?? [];
    if (!isListOf(MAX.controls, (control) => isControl(control, lens))(controls)) {
        return { problem: 'A control is not valid, or sets a parameter that the lens does not declare.' };
    }
    const panels = value.panels ?? [];
    if (!isListOf(MAX.panels, (panel) => isObject(panel) && isText(MAX.panelTitle)(panel.title)
        && Array.isArray(panel.blocks) && panel.blocks.length <= MAX.blocks)(panels)) {
        return { problem: 'A panel needs a title and a list of blocks.' };
    }
    if (!isOptional(value.title, isText(MAX.label))) return { problem: 'The title is not a string of at most 200 characters.' };
    const reply = { ...value, graph: { nodes, edges, groups }, controls, panels } as unknown as LensReply;
    return { reply };
}

function isControl(value: unknown, lens: DiagramLensContribution): value is LensControl {
    return isObject(value) && ['segmented', 'select', 'breadcrumb'].includes(value.type as string)
        && isString(value.param) && !!lens.params?.[value.param] && isOptional(value.label, isText(MAX.port))
        && Array.isArray(value.items) && value.items.length > 0 && value.items.length <= MAX.controlItems
        && value.items.every((item) => isObject(item) && isText(MAX.param)(item.value) && item.value !== '' && isText(100)(item.label) && item.label !== '')
        && (value.value === undefined || value.items.some((item) => isObject(item) && item.value === value.value));
}

function accepts(param: { values?: string[]; pattern?: string }, value: string): boolean {
    if (param.values) return param.values.includes(value);
    if (param.pattern === undefined) return false;
    try {
        return new RegExp(param.pattern, 'u').test(value);
    } catch {
        return false;
    }
}

/**
 * The view parameters to send: each one that the lens declares, with a value that its `values` or `pattern` allows,
 * else its default. Other parameters never reach the route.
 */
export function lensParams(lens: DiagramLensContribution, requested: Record<string, string | undefined>): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [name, param] of Object.entries(lens.params ?? {})) {
        const value = requested[name];
        if (value !== undefined && accepts(param, value)) result[name] = value;
        else if (param.default !== undefined) result[name] = param.default;
    }
    return result;
}

/** Whether a link may set these parameters: each must be declared and allowed. */
export function isParamsLinkAllowed(lens: DiagramLensContribution, params: Record<string, string>): boolean {
    return Object.entries(params).every(([name, value]) => {
        const param = lens.params?.[name];
        return !!param && accepts(param, value);
    });
}
