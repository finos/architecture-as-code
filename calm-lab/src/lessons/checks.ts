import type { CommandOutcome, OutcomeCommand } from '../cli/outcome';
import type { CalmDocLike, LessonState } from './types';

type Item = Record<string, unknown>;

const items = (value: unknown): Item[] =>
    Array.isArray(value) ? value.filter((item): item is Item => typeof item === 'object' && item !== null) : [];

export const nodes = (doc: CalmDocLike | null | undefined): Item[] => items(doc?.nodes);
export const relationships = (doc: CalmDocLike | null | undefined): Item[] => items(doc?.relationships);

export function nodeById(doc: CalmDocLike | null | undefined, id: unknown): Item | undefined {
    return typeof id === 'string' ? nodes(doc).find((node) => node['unique-id'] === id) : undefined;
}

export function nodesOfType(doc: CalmDocLike | null | undefined, type: string): Item[] {
    return nodes(doc).filter((node) => node['node-type'] === type);
}

const typeOf = (doc: CalmDocLike | null | undefined, id: unknown) => nodeById(doc, id)?.['node-type'];

function relationshipsOf(doc: CalmDocLike | null | undefined, kind: string): Item[] {
    return relationships(doc)
        .map((relationship) => (relationship['relationship-type'] as Item | null | undefined)?.[kind])
        .filter((detail): detail is Item => typeof detail === 'object' && detail !== null);
}

export function connectsBetween(doc: CalmDocLike | null | undefined, sourceType: string, destinationType: string): boolean {
    return relationshipsOf(doc, 'connects').some((connects) =>
        typeOf(doc, (connects.source as Item | undefined)?.node) === sourceType &&
        typeOf(doc, (connects.destination as Item | undefined)?.node) === destinationType);
}

export function interactsWith(doc: CalmDocLike | null | undefined, actorType: string, nodeType: string): boolean {
    return relationshipsOf(doc, 'interacts').some((interacts) =>
        typeOf(doc, interacts.actor) === actorType &&
        Array.isArray(interacts.nodes) && interacts.nodes.some((id) => typeOf(doc, id) === nodeType));
}

export function composedOf(doc: CalmDocLike | null | undefined, containerType: string, memberTypes: string[]): boolean {
    return relationshipsOf(doc, 'composed-of').some((composed) => {
        if (typeOf(doc, composed.container) !== containerType || !Array.isArray(composed.nodes)) {
            return false;
        }
        const types = composed.nodes.map((id) => typeOf(doc, id));
        return memberTypes.every((type) => types.includes(type));
    });
}

export function freshOutcomes(outcomes: CommandOutcome[], read: (path: string) => string | null): CommandOutcome[] {
    return outcomes.filter((outcome) => Object.entries(outcome.snapshot).every(([path, content]) => read(path) === content));
}

function matching(state: LessonState, command: OutcomeCommand, files: Record<string, string> = {}): CommandOutcome[] {
    return state.commands.filter((outcome) =>
        outcome.command === command && Object.entries(files).every(([key, path]) => outcome.files[key] === path));
}

export const ranOk = (state: LessonState, command: OutcomeCommand, files?: Record<string, string>) =>
    matching(state, command, files).some((outcome) => outcome.ok);

export const ranFailed = (state: LessonState, command: OutcomeCommand, files?: Record<string, string>) =>
    matching(state, command, files).some((outcome) => !outcome.ok);

export const validatedEditorFile = (state: LessonState) => ranOk(state, 'validate', { architecture: state.editorFile });
