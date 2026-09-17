import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SequenceMinimap } from './SequenceMinimap.js';

const baseProps = {
    participantXs: [50, 240],
    messages: [
        { y: 100, sx: 50, dx: 240, seq: 1 },
        { y: 160, sx: 240, dx: 50, seq: 2 },
    ],
    totalW: 400,
    totalH: 300,
    activeSeq: null as number | null,
    visitedSeqs: new Set<number>(),
    viewport: { left: 0, top: 0, width: 1, height: 1 },
    onJump: () => {},
};

describe('SequenceMinimap', () => {
    it('draws a lifeline per participant and a row per message', () => {
        const { container } = render(<SequenceMinimap {...baseProps} />);
        const lines = container.querySelectorAll('line');
        expect(lines).toHaveLength(baseProps.participantXs.length + baseProps.messages.length);
    });

    it('scales the viewport rectangle into diagram coordinates', () => {
        render(
            <SequenceMinimap
                {...baseProps}
                viewport={{ left: 0.25, top: 0.5, width: 0.5, height: 0.25 }}
            />
        );
        const rect = screen.getByTestId('minimap-viewport');
        expect(rect).toHaveAttribute('x', '100'); // 0.25 * 400
        expect(rect).toHaveAttribute('y', '150'); // 0.5  * 300
        expect(rect).toHaveAttribute('width', '200');
        expect(rect).toHaveAttribute('height', '75');
    });

    it('reports the clicked position as 0-1 fractions', () => {
        const onJump = vi.fn();
        render(<SequenceMinimap {...baseProps} onJump={onJump} />);
        const svg = screen.getByTestId('sequence-minimap');

        vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
            left: 1000,
            top: 500,
            width: 200,
            height: 150,
            right: 1200,
            bottom: 650,
            x: 1000,
            y: 500,
            toJSON: () => '',
        } as DOMRect);

        fireEvent.click(svg, { clientX: 1050, clientY: 575 });
        expect(onJump).toHaveBeenCalledWith(0.25, 0.5);
    });

    it('highlights the active step more heavily than visited ones', () => {
        const { container } = render(
            <SequenceMinimap {...baseProps} activeSeq={1} visitedSeqs={new Set([1])} />
        );
        const [, , active, future] = container.querySelectorAll('line');
        expect(active.getAttribute('class')).toContain('stroke-info');
        expect(future.getAttribute('class')).toContain('stroke-base-content/30');
    });
});

