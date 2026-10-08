import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { CalmFlowSchema } from '@finos/calm-models/types';
import { FlowSequenceDiagram } from './FlowSequenceDiagram.js';
import { useMotion, type UseMotionResult } from '../../../theme/useMotion.js';

vi.mock('../../../theme/useMotion.js', () => ({ useMotion: vi.fn() }));

// Pin playback on the first step so the pulse circle is eligible to render.
vi.mock('./useFlowPlayback.js', () => ({
    useFlowPlayback: () => ({
        step: 0,
        playing: false,
        speed: 1,
        isCompleted: false,
        setStep: vi.fn(),
        setSpeed: vi.fn(),
        togglePlay: vi.fn(),
        stepFwd: vi.fn(),
        stepBk: vi.fn(),
        reset: vi.fn(),
        showAll: vi.fn(),
        stopPlaying: vi.fn(),
    }),
}));

const flowJson = {
    transitions: [
        {
            'relationship-unique-id': 'rel-1',
            'sequence-number': 1,
            description: 'Client calls the service',
            direction: 'source-to-destination',
        },
    ],
} as unknown as Partial<CalmFlowSchema>;

function mockMotion(motion: UseMotionResult['motion']) {
    vi.mocked(useMotion).mockReturnValue({
        motion,
        toggleMotion: vi.fn(),
    });
}

describe('FlowSequenceDiagram motion', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // jsdom does not implement scrollIntoView; FlowCommentary calls it on step change.
        window.HTMLElement.prototype.scrollIntoView = vi.fn();
    });

    it('animates the active message with a pulse when motion is full', () => {
        mockMotion('full');
        const { container } = render(<FlowSequenceDiagram flowJson={flowJson} architecture={null} />);

        expect(container.querySelectorAll('animate').length).toBeGreaterThan(0);
    });

    it('draws no SMIL animation when motion is paused', () => {
        mockMotion('reduced');
        const { container } = render(<FlowSequenceDiagram flowJson={flowJson} architecture={null} />);

        expect(container.querySelectorAll('animate')).toHaveLength(0);
    });
});
