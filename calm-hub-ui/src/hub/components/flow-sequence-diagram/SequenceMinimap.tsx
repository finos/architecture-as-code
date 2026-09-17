import { colors } from '../../../theme/colors.js';
import type { ViewportFraction } from './useSvgZoomPan.js';

interface MinimapMessage {
    y: number;
    sx: number;
    dx: number;
    seq: number;
}

interface SequenceMinimapProps {
    participantXs: number[];
    messages: MinimapMessage[];
    totalW: number;
    totalH: number;
    activeSeq: number | null;
    visitedSeqs: Set<number>;
    viewport: ViewportFraction;
    onJump: (fx: number, fy: number) => void;
}

/** Matches the architecture tab's minimap footprint (ArchitectureGraph). */
const WIDTH = 132;
const HEIGHT = 84;
const RIGHT_OFFSET = 14;
/**
 * ReactFlow adds a margin to the architecture minimap's `bottom: 16`. The result is
 * 30px above the pane. This value comes from measurement, so the minimap does not
 * move when you change tab.
 */
const BOTTOM_OFFSET = 30;
const BORDER_RADIUS = 8;
const BOX_SHADOW = '0 2px 6px rgba(16,24,40,.06)';

// Strokes are a fraction of the diagram, not a pixel value. The minimap box
// compresses the SVG. A fixed width becomes too thick on short diagrams and
// disappears on long ones.
const LIFELINE_STROKE_RATIO = 1 / 200;
const ACTIVE_MESSAGE_STROKE_RATIO = 1 / 60;
const MESSAGE_STROKE_RATIO = 1 / 110;
const VIEWPORT_STROKE_RATIO = 1 / 250;

/**
 * Schematic overview of the sequence diagram. Lifelines are columns and messages are
 * rows. It is not a scaled copy: labels are not readable at this size, and the
 * structure is what shows your position in a long flow.
 */
export function SequenceMinimap({
    participantXs,
    messages,
    totalW,
    totalH,
    activeSeq,
    visitedSeqs,
    viewport,
    onJump,
}: SequenceMinimapProps) {
    const jump = (e: React.MouseEvent<SVGSVGElement>) => {
        const box = e.currentTarget.getBoundingClientRect();
        onJump((e.clientX - box.left) / box.width, (e.clientY - box.top) / box.height);
    };

    return (
        <div
            className="absolute overflow-hidden"
            style={{
                bottom: BOTTOM_OFFSET,
                right: RIGHT_OFFSET,
                width: WIDTH,
                height: HEIGHT,
                background: colors.redesign.surface,
                border: `1px solid ${colors.redesign.borderStrong}`,
                borderRadius: BORDER_RADIUS,
                boxShadow: BOX_SHADOW,
            }}
            // The pane starts a drag-pan on pointerdown. The minimap handles its own clicks.
            onPointerDown={(e) => e.stopPropagation()}
        >
            <svg
                viewBox={`0 0 ${totalW} ${totalH}`}
                preserveAspectRatio="none"
                className="h-full w-full cursor-pointer"
                onClick={jump}
                role="presentation"
                data-testid="sequence-minimap"
            >
                {participantXs.map((x, i) => (
                    <line
                        key={`mm-life-${i}`}
                        x1={x}
                        y1={0}
                        x2={x}
                        y2={totalH}
                        className="stroke-base-content/25"
                        strokeWidth={totalW * LIFELINE_STROKE_RATIO}
                    />
                ))}

                {messages.map((m, i) => {
                    const isActive = m.seq === activeSeq;
                    const isVisited = visitedSeqs.has(m.seq);
                    return (
                        <line
                            key={`mm-msg-${i}`}
                            x1={Math.min(m.sx, m.dx)}
                            y1={m.y}
                            x2={Math.max(m.sx, m.dx)}
                            y2={m.y}
                            className={
                                isActive
                                    ? 'stroke-info'
                                    : isVisited
                                      ? 'stroke-success/70'
                                      : 'stroke-base-content/30'
                            }
                            strokeWidth={
                                totalH * (isActive ? ACTIVE_MESSAGE_STROKE_RATIO : MESSAGE_STROKE_RATIO)
                            }
                        />
                    );
                })}

                <rect
                    x={viewport.left * totalW}
                    y={viewport.top * totalH}
                    width={viewport.width * totalW}
                    height={viewport.height * totalH}
                    className="fill-info/10 stroke-info"
                    strokeWidth={totalW * VIEWPORT_STROKE_RATIO}
                    data-testid="minimap-viewport"
                />
            </svg>
        </div>
    );
}
