import { IFunctionResult, RulesetFunctionContext } from '@stoplight/spectral-core';
import { listCandidates, type Candidate, type SchemaNode } from '@finos/calm-models/pattern';
import { listNodeInterfaces } from './candidate-helpers';

// Spectral's IFunctionResult.path is an array of path segments, not a pointer string.
// candidate.path stops at the candidate's own schema object, so the message and the
// reported path both need this suffix to point at the value that actually collided.
const UNIQUE_ID_PATH_SUFFIX = ['properties', 'unique-id', 'const'];

interface DuplicateCheckEntry {
    uniqueId: string;
    path: (string | number)[];
}

function toEntry(candidate: Candidate): DuplicateCheckEntry {
    return { uniqueId: candidate.uniqueId, path: candidate.path };
}

function detectDuplicateEntries(entries: DuplicateCheckEntry[], seenIds: Set<string>, messages: IFunctionResult[]): void {
    for (const entry of entries) {
        if (seenIds.has(entry.uniqueId)) {
            const path = [...entry.path, ...UNIQUE_ID_PATH_SUFFIX];
            messages.push({
                message: `Duplicate unique-id detected. ID: ${entry.uniqueId}, path: /${path.join('/')}`,
                path,
            });
        } else {
            seenIds.add(entry.uniqueId);
        }
    }
}

/**
 * Checks that every node, relationship and interface unique-id in the pattern is unique.
 * Node/relationship ids and their nested interface ids all share one `seenIds` set, so an
 * id reused across nodes, relationships and interfaces is flagged too, not just within
 * one of those.
 */
export default (input: unknown, _: unknown, context: RulesetFunctionContext): IFunctionResult[] => {
    if (!input) {
        return [];
    }

    const pattern = context.document.data as SchemaNode;
    const nodeCandidates = listCandidates(pattern, 'nodes');
    const relationshipCandidates = listCandidates(pattern, 'relationships');

    const interfaceEntries: DuplicateCheckEntry[] = nodeCandidates.flatMap((nodeCandidate) =>
        listNodeInterfaces(nodeCandidate.node).map((iface) => ({
            uniqueId: iface.uniqueId,
            path: [...nodeCandidate.path, 'properties', 'interfaces', 'prefixItems', iface.index],
        }))
    );

    const seenIds = new Set<string>();
    const messages: IFunctionResult[] = [];

    detectDuplicateEntries(nodeCandidates.map(toEntry), seenIds, messages);
    detectDuplicateEntries(relationshipCandidates.map(toEntry), seenIds, messages);
    detectDuplicateEntries(interfaceEntries, seenIds, messages);

    return messages;
};
