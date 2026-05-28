import type { CalmArchitectureSchema, CalmTimelineSchema } from '../types/index.js';
import { describe, it, expect, vi } from 'vitest';
import { CalmTimeline } from '../model/timeline.js';
import { diffTimelineAdjacent, diffTimelineMoments } from './timeline-diff.js';
import {
    resolveMomentArchitecture,
    type ArchitectureResolver,
    type MomentLike,
} from './architecture-resolver.js';

const node = (id: string, name = id): CalmArchitectureSchema['nodes'][number] => ({
    'unique-id': id,
    'node-type': 'service',
    name,
    description: `${name} node`,
});

// Three architectures forming a chain of changes:
//   arch1 -> arch2 adds node 'b'
//   arch2 -> arch3 removes 'a' and modifies 'b'
const arch1: CalmArchitectureSchema = {
    nodes: [node('a')],
    relationships: [],
};
const arch2: CalmArchitectureSchema = {
    nodes: [node('a'), node('b')],
    relationships: [],
};
const arch3: CalmArchitectureSchema = {
    nodes: [node('b', 'b-renamed-name')],
    relationships: [],
};

const architecturesByRef: Record<string, CalmArchitectureSchema> = {
    'arch1.json': arch1,
    'arch2.json': arch2,
    'arch3.json': arch3,
};

const stubResolver: ArchitectureResolver = async (reference) => {
    const arch = architecturesByRef[reference];
    if (!arch) {
        throw new Error(`unexpected reference: ${reference}`);
    }
    return arch;
};

const stringRefTimeline: CalmTimelineSchema = {
    'current-moment': 'm3',
    moments: [
        {
            'unique-id': 'm1',
            'node-type': 'moment',
            name: 'Moment 1',
            description: 'first',
            details: { 'detailed-architecture': 'arch1.json' },
        },
        {
            'unique-id': 'm2',
            'node-type': 'moment',
            name: 'Moment 2',
            description: 'second',
            details: { 'detailed-architecture': 'arch2.json' },
        },
        {
            'unique-id': 'm3',
            'node-type': 'moment',
            name: 'Moment 3',
            description: 'third',
            details: { 'detailed-architecture': 'arch3.json' },
        },
    ],
};

describe('resolveMomentArchitecture', () => {
    it('returns an inline architecture object directly without calling the resolver', async () => {
        const resolver = vi.fn();
        const moment: MomentLike = {
            'unique-id': 'm1',
            details: { 'detailed-architecture': arch1 },
        };
        const result = await resolveMomentArchitecture(moment, resolver);
        expect(result).toBe(arch1);
        expect(resolver).not.toHaveBeenCalled();
    });

    it('resolves a string reference via the injected resolver', async () => {
        const resolver = vi.fn(stubResolver);
        const moment: MomentLike = {
            'unique-id': 'm2',
            details: { 'detailed-architecture': 'arch2.json' },
        };
        const result = await resolveMomentArchitecture(moment, resolver);
        expect(result).toBe(arch2);
        expect(resolver).toHaveBeenCalledWith('arch2.json');
    });

    it('throws when there is no detailed-architecture', async () => {
        const moment: MomentLike = { 'unique-id': 'm1', details: {} };
        await expect(resolveMomentArchitecture(moment, stubResolver)).rejects.toThrow(
            /no details.detailed-architecture/,
        );
    });

    it('throws when a string reference is given but no resolver is provided', async () => {
        const moment: MomentLike = {
            'unique-id': 'm1',
            details: { 'detailed-architecture': 'arch1.json' },
        };
        await expect(resolveMomentArchitecture(moment)).rejects.toThrow(/no resolver/);
    });

    it('throws for an unsupported reference type', async () => {
        const moment = {
            'unique-id': 'm1',
            details: { 'detailed-architecture': 42 },
        } as unknown as MomentLike;
        await expect(resolveMomentArchitecture(moment, stubResolver)).rejects.toThrow(
            /unsupported detailed-architecture/,
        );
    });

    it('reports <unknown> for a moment with no unique-id', async () => {
        const moment: MomentLike = { details: {} };
        await expect(resolveMomentArchitecture(moment, stubResolver)).rejects.toThrow(
            /'<unknown>'/,
        );
    });
});

describe('diffTimelineAdjacent', () => {
    it('diffs each consecutive pair across three moments (two pairs)', async () => {
        const results = await diffTimelineAdjacent(stringRefTimeline, stubResolver);
        expect(results).toHaveLength(2);

        expect(results[0].from).toBe('m1');
        expect(results[0].to).toBe('m2');
        expect(results[0].diff.nodesAdded.map((n) => n['unique-id'])).toEqual(['b']);

        expect(results[1].from).toBe('m2');
        expect(results[1].to).toBe('m3');
        expect(results[1].diff.nodesRemoved.map((n) => n['unique-id'])).toEqual(['a']);
        expect(results[1].diff.nodesModified.map((n) => n.original['unique-id'])).toEqual(['b']);
    });

    it('returns no pairs for a single-moment timeline', async () => {
        const single: CalmTimelineSchema = {
            moments: [stringRefTimeline.moments[0]],
        };
        const results = await diffTimelineAdjacent(single, stubResolver);
        expect(results).toEqual([]);
    });

    it('returns no pairs for an empty timeline', async () => {
        const results = await diffTimelineAdjacent({ moments: [] }, stubResolver);
        expect(results).toEqual([]);
    });

    it('accepts a hydrated CalmTimeline as well as raw schema', async () => {
        const timeline = CalmTimeline.fromSchema(stringRefTimeline);
        const results = await diffTimelineAdjacent(timeline, stubResolver);
        expect(results).toHaveLength(2);
        expect(results.map((r) => `${r.from}->${r.to}`)).toEqual(['m1->m2', 'm2->m3']);
    });

    it('works with inline architecture references (no resolver needed)', async () => {
        const inlineTimeline: CalmTimelineSchema = {
            moments: [
                {
                    'unique-id': 'm1',
                    'node-type': 'moment',
                    name: 'M1',
                    description: 'first',
                    details: { 'detailed-architecture': arch1 },
                },
                {
                    'unique-id': 'm2',
                    'node-type': 'moment',
                    name: 'M2',
                    description: 'second',
                    details: { 'detailed-architecture': arch2 },
                },
            ],
        };
        const results = await diffTimelineAdjacent(inlineTimeline);
        expect(results).toHaveLength(1);
        expect(results[0].diff.nodesAdded.map((n) => n['unique-id'])).toEqual(['b']);
    });
});

describe('diffTimelineMoments', () => {
    it('diffs any two moments by id (first vs last)', async () => {
        const result = await diffTimelineMoments(stringRefTimeline, 'm1', 'm3', stubResolver);
        expect(result.from).toBe('m1');
        expect(result.to).toBe('m3');
        // arch1 ('a') -> arch3 ('b' with different name): 'a' removed, 'b' added.
        expect(result.diff.nodesRemoved.map((n) => n['unique-id'])).toEqual(['a']);
        expect(result.diff.nodesAdded.map((n) => n['unique-id'])).toEqual(['b']);
    });

    it('throws for an unknown from moment id', async () => {
        await expect(
            diffTimelineMoments(stringRefTimeline, 'nope', 'm3', stubResolver),
        ).rejects.toThrow(/'nope' was not found/);
    });

    it('throws for an unknown to moment id', async () => {
        await expect(
            diffTimelineMoments(stringRefTimeline, 'm1', 'nope', stubResolver),
        ).rejects.toThrow(/'nope' was not found/);
    });

    it('accepts a hydrated CalmTimeline', async () => {
        const timeline = CalmTimeline.fromSchema(stringRefTimeline);
        const result = await diffTimelineMoments(timeline, 'm1', 'm2', stubResolver);
        expect(result.diff.nodesAdded.map((n) => n['unique-id'])).toEqual(['b']);
    });
});
