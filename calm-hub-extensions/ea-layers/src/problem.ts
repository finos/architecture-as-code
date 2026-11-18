/** A failure that the lens shows to the user, as application/problem+json. */
export class Problem extends Error {
    constructor(readonly status: number, readonly title: string, readonly detail?: string) {
        super(detail ? `${title}: ${detail}` : title);
    }
}

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const isId = (value: unknown) => typeof value === 'string' && value !== '';
const isOptionalText = (value: unknown) => value === undefined || typeof value === 'string';
const isIdList = (value: unknown) => Array.isArray(value) && value.every(isId);
const isListOf = (value: unknown, check: (entry: Record<string, unknown>) => boolean) =>
    value === undefined || (Array.isArray(value) && value.every((entry) => isRecord(entry) && check(entry)));
const isEnd = (value: unknown) => isRecord(value) && isId(value.node);
const isGroup = (value: unknown) => value === undefined || (isRecord(value) && isId(value.container) && isIdList(value.nodes));

function isRelationshipType(type: unknown): boolean {
    if (!isRecord(type)) return false;
    const { connects, interacts } = type;
    return (connects === undefined || (isRecord(connects) && isEnd(connects.source) && isEnd(connects.destination)))
        && (interacts === undefined || (isRecord(interacts) && isId(interacts.actor) && isIdList(interacts.nodes)))
        && isGroup(type['composed-of']) && isGroup(type['deployed-in']);
}

/** True when each node and relationship has the fields that the lens reads, so a bad document is a 400, not a crash. */
export function hasArchitectureShape(value: unknown): boolean {
    return isRecord(value)
        && isOptionalText(value.title)
        && isListOf(value.nodes, (node) => isId(node['unique-id']) && typeof node['node-type'] === 'string'
            && isOptionalText(node.name) && isOptionalText(node.description))
        && isListOf(value.relationships, (relationship) => isId(relationship['unique-id'])
            && isOptionalText(relationship.description) && isOptionalText(relationship.protocol)
            && isRelationshipType(relationship['relationship-type']));
}
