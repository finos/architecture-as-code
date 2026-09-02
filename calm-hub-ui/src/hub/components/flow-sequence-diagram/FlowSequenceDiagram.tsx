import { useEffect, useMemo, useState } from 'react';
import { FlowCommentary } from './FlowCommentary.js';
import { FlowHeader } from './FlowHeader.js';
import { PlaybackControls } from './PlaybackControls.js';
import { SequenceMinimap } from './SequenceMinimap.js';
import { ZoomControls } from './ZoomControls.js';
import { useFlowPlayback } from './useFlowPlayback.js';
import { useSvgZoomPan } from './useSvgZoomPan.js';
import { FlowSequenceHelper, orientEndpoints } from './flow-sequence-helper.js';
import {
    IDLE_STEP,
    activeSequenceNumber,
    describeStep,
    visitedSequenceNumbers,
} from './flow-step.js';
import { COMMENTARY_PANEL_WIDTH, DIAGRAM_CARD_CLASS } from './flow-layout.js';
import './flow-animation.css';
import type { Architecture } from '@finos/calm-models/model';
import type { CalmFlowSchema, CalmFlowTransitionSchema } from '@finos/calm-models/types';

interface FlowSequenceDiagramProps {
    flowJson: Partial<CalmFlowSchema>;
    architecture: Architecture | null;
}

interface SequenceMessage {
    sx: number;
    dx: number;
    y: number;
    isReturn: boolean;
    seq: number;
    desc?: string;
}

const COL_WIDTH = 150;
const COL_GAP = 40;
const HEADER_HEIGHT = 70;
const ROW_HEIGHT = 56;
const FIRST_COL_X = 50;
const CANVAS_PAD_X = 80;
const CANVAS_PAD_Y = 60;
const LIFELINE_INSET = 10;
const MESSAGE_TOP_OFFSET = 10;
const MESSAGE_LABEL_OFFSET = 10;
const PARTICIPANT_BOX_Y = 8;
const PARTICIPANT_BOX_HEIGHT = 44;
const PARTICIPANT_BOX_RADIUS = 8;
const PARTICIPANT_LABEL_Y = 35;
const PARTICIPANT_FONT_SIZE = 13;
const MESSAGE_FONT_SIZE = 11;
const PULSE_RADIUS = 4;
const PULSE_DURATION = '1s';
const LIFELINE_DASH = '6,4';
const RETURN_DASH = '6,3';

/** Messages outside the visited set stay faint. They do not disappear. */
const HIDDEN_OPACITY = 0.12;

/** Session-scoped, to match the architecture tab's minimap preference. */
const MINIMAP_HIDDEN_KEY = 'calmHub.sequenceMinimapHidden';

function readMinimapHidden(): boolean {
    try {
        return sessionStorage.getItem(MINIMAP_HIDDEN_KEY) === '1';
    } catch {
        return false;
    }
}

export function FlowSequenceDiagram({ flowJson, architecture }: FlowSequenceDiagramProps) {
    const flowHelper = useMemo(() => new FlowSequenceHelper(), []);

    const data = useMemo(() => {
        const transitions: CalmFlowTransitionSchema[] = flowJson?.transitions || [];
        if (transitions.length === 0) return null;

        const seqNumbers = [...new Set(transitions.map(t => t['sequence-number']))].sort((a, b) => a - b);

        const participantSet = new Set<string>();
        transitions.forEach((t) => {
            if (architecture) {
                const src = flowHelper.getSourceFromRelationship(t['relationship-unique-id'], architecture);
                const dst = flowHelper.getTargetFromRelationship(t['relationship-unique-id'], architecture);
                if (src !== FlowSequenceHelper.UNKNOWN_NODE) participantSet.add(src);
                if (dst !== FlowSequenceHelper.UNKNOWN_NODE) participantSet.add(dst);
            } else {
                participantSet.add(t['relationship-unique-id']);
            }
        });
        const participants = Array.from(participantSet);

        const totalW = participants.length * (COL_WIDTH + COL_GAP) + CANVAS_PAD_X;
        const totalH = HEADER_HEIGHT + transitions.length * ROW_HEIGHT + CANVAS_PAD_Y;

        const pPositions: Record<string, number> = {};
        participants.forEach((p, i) => {
            pPositions[p] = FIRST_COL_X + i * (COL_WIDTH + COL_GAP) + COL_WIDTH / 2;
        });

        // flatMap, not map+filter. Unresolvable transitions drop out and the element
        // type stays narrow.
        const messages = transitions.flatMap<SequenceMessage>((t, i) => {
            const isReturn = t.direction === 'destination-to-source';
            let rawSrc: string;
            let rawDst: string;

            if (architecture) {
                rawSrc = flowHelper.getSourceFromRelationship(t['relationship-unique-id'], architecture);
                rawDst = flowHelper.getTargetFromRelationship(t['relationship-unique-id'], architecture);
            } else {
                rawSrc = t['relationship-unique-id'];
                rawDst = participants[(participants.indexOf(rawSrc) + 1) % participants.length];
            }

            const [srcName, dstName] = orientEndpoints(rawSrc, rawDst, isReturn);
            const sx = pPositions[srcName];
            const dx = pPositions[dstName];
            if (sx === undefined || dx === undefined) return [];

            return [{
                sx,
                dx,
                y: HEADER_HEIGHT + MESSAGE_TOP_OFFSET + i * ROW_HEIGHT,
                isReturn,
                seq: t['sequence-number'],
                desc: t.description,
            }];
        });

        return { participants, pPositions, messages, totalW, totalH, transitions, seqNumbers };
    }, [flowJson, architecture, flowHelper]);

    const maxStep = data ? data.seqNumbers.length - 1 : 0;
    const playback = useFlowPlayback({ maxStep }, flowJson);
    const zoom = useSvgZoomPan();
    const [minimapHidden, setMinimapHidden] = useState(readMinimapHidden);

    const toggleMinimap = () => {
        setMinimapHidden((prev) => {
            const next = !prev;
            try {
                sessionStorage.setItem(MINIMAP_HIDDEN_KEY, next ? '1' : '0');
            } catch {
                /* ignore unavailable storage */
            }
            return next;
        });
    };

    // At high zoom a long diagram moves the active step off-screen and the animation
    // becomes invisible. Follow the step as playback continues.
    const { panIntoView } = zoom;
    const currentStep = playback.step;
    useEffect(() => {
        panIntoView('[data-active-step]');
    }, [currentStep, panIntoView]);

    if (!data) {
        return (
            <div className="flex items-center justify-center h-full text-base-content/50">
                No transitions to display
            </div>
        );
    }

    const { participants, pPositions, messages, totalW, totalH, transitions, seqNumbers } = data;
    const { step, isCompleted, stopPlaying, setStep } = playback;
    const activeSeqNum = activeSequenceNumber(step, seqNumbers);
    const visitedSeqNums = visitedSequenceNumbers(step, seqNumbers);
    const statusText = describeStep(activeSeqNum, transitions, isCompleted);

    const activeParticipants = new Set<string>();
    if (activeSeqNum != null && architecture) {
        transitions.filter(t => t['sequence-number'] === activeSeqNum).forEach(t => {
            const src = flowHelper.getSourceFromRelationship(t['relationship-unique-id'], architecture);
            const dst = flowHelper.getTargetFromRelationship(t['relationship-unique-id'], architecture);
            if (src !== FlowSequenceHelper.UNKNOWN_NODE) activeParticipants.add(src);
            if (dst !== FlowSequenceHelper.UNKNOWN_NODE) activeParticipants.add(dst);
        });
    }

    return (
        <div className="w-full h-full flex flex-col bg-base-200">
            <FlowHeader description={flowJson.description} />

            <div className="flex-1 flex min-h-0">
                <div className="flex-1 px-6 pb-2 min-w-0 min-h-0">
                    <div
                        ref={zoom.containerRef}
                        {...zoom.panHandlers}
                        className={`relative touch-none ${DIAGRAM_CARD_CLASS}`}
                        style={{ cursor: zoom.isPanning ? 'grabbing' : 'grab' }}
                    >
                        {/* The padding stays outside the transform, so the border does not scale. */}
                        <div
                            className="w-full h-full p-6"
                            style={{
                                transform: `translate(${zoom.transform.x}px, ${zoom.transform.y}px) scale(${zoom.transform.scale})`,
                                transformOrigin: '0 0',
                            }}
                        >
                            <svg
                                ref={zoom.contentRef}
                                viewBox={`0 0 ${totalW} ${totalH}`}
                                preserveAspectRatio="xMinYMin meet"
                                className="w-full h-full"
                            >
                                <defs>
                                    <marker id="arrow-fwd" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                                        <polygon points="0 0,10 3.5,0 7" className="fill-primary" />
                                    </marker>
                                    <marker id="arrow-ret" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                                        <polygon points="0 0,10 3.5,0 7" className="fill-success" />
                                    </marker>
                                    <marker id="arrow-active" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                                        <polygon points="0 0,10 3.5,0 7" className="fill-info" />
                                    </marker>
                                </defs>

                                {participants.map((p) => {
                                    const cx = pPositions[p];
                                    return (
                                        <line
                                            key={`life-${p}`}
                                            x1={cx} y1={HEADER_HEIGHT - LIFELINE_INSET}
                                            x2={cx} y2={totalH - LIFELINE_INSET}
                                            className="stroke-base-content/40"
                                            strokeWidth={1.5}
                                            strokeDasharray={LIFELINE_DASH}
                                        />
                                    );
                                })}

                                {participants.map((p) => {
                                    const cx = pPositions[p];
                                    const isActive = activeParticipants.has(p);
                                    return (
                                        <g key={`part-${p}`}>
                                            <rect
                                                x={cx - COL_WIDTH / 2}
                                                y={PARTICIPANT_BOX_Y}
                                                width={COL_WIDTH}
                                                height={PARTICIPANT_BOX_HEIGHT}
                                                rx={PARTICIPANT_BOX_RADIUS}
                                                className={isActive ? 'fill-info/15 stroke-info' : 'fill-primary/10 stroke-primary'}
                                                strokeWidth={isActive ? 2 : 1.5}
                                                style={{ transition: 'stroke-width 0.3s ease' }}
                                            />
                                            <text
                                                x={cx}
                                                y={PARTICIPANT_LABEL_Y}
                                                textAnchor="middle"
                                                className={isActive ? 'fill-info' : 'fill-base-content'}
                                                fontSize={PARTICIPANT_FONT_SIZE}
                                                fontWeight={600}
                                            >
                                                {p}
                                            </text>
                                        </g>
                                    );
                                })}

                                {messages.map((m, i) => {
                                    const { sx, dx, y, isReturn, seq, desc } = m;
                                    const mx = (sx + dx) / 2;

                                    const isVisible = (activeSeqNum == null && !isCompleted) || visitedSeqNums.has(seq) || isCompleted;
                                    const isCurrent = seq === activeSeqNum;
                                    const opacity = isVisible || step === IDLE_STEP ? 1 : HIDDEN_OPACITY;

                                    return (
                                        <g
                                            key={`msg-${i}`}
                                            data-active-step={isCurrent || undefined}
                                            style={{ opacity, transition: 'opacity 0.3s ease' }}
                                        >
                                            <line
                                                x1={sx} y1={y}
                                                x2={dx} y2={y}
                                                className={isCurrent ? 'stroke-info' : isReturn ? 'stroke-success' : 'stroke-primary'}
                                                strokeWidth={isReturn ? 1.5 : 2}
                                                strokeDasharray={isReturn && !isCurrent ? RETURN_DASH : undefined}
                                                markerEnd={isCurrent ? 'url(#arrow-active)' : isReturn ? 'url(#arrow-ret)' : 'url(#arrow-fwd)'}
                                            />
                                            {isCurrent && (
                                                <circle
                                                    r={PULSE_RADIUS}
                                                    fill="var(--flow-active-light)"
                                                    style={{ filter: 'drop-shadow(0 0 4px var(--flow-active-glow))' }}
                                                >
                                                    <animate
                                                        attributeName="cx"
                                                        from={String(sx)}
                                                        to={String(dx)}
                                                        dur={PULSE_DURATION}
                                                        repeatCount="indefinite"
                                                    />
                                                    <animate
                                                        attributeName="cy"
                                                        from={String(y)}
                                                        to={String(y)}
                                                        dur={PULSE_DURATION}
                                                        repeatCount="indefinite"
                                                    />
                                                    <animate
                                                        attributeName="opacity"
                                                        values="0;1;1;0"
                                                        keyTimes="0;0.1;0.9;1"
                                                        dur={PULSE_DURATION}
                                                        repeatCount="indefinite"
                                                    />
                                                </circle>
                                            )}
                                            <text
                                                x={mx}
                                                y={y - MESSAGE_LABEL_OFFSET}
                                                textAnchor="middle"
                                                fontSize={MESSAGE_FONT_SIZE}
                                                fontWeight={isCurrent ? 600 : 400}
                                                className={isCurrent ? 'fill-info' : 'fill-base-content'}
                                            >
                                                <tspan className={isCurrent ? 'fill-warning' : 'fill-base-content/50'} fontWeight={700}>
                                                    {seq}.{' '}
                                                </tspan>
                                                {desc}
                                            </text>
                                        </g>
                                    );
                                })}
                            </svg>
                        </div>

                        <ZoomControls
                            onZoomIn={zoom.zoomIn}
                            onZoomOut={zoom.zoomOut}
                            onReset={zoom.reset}
                            isInteractive={zoom.isInteractive}
                            onToggleInteractive={zoom.toggleInteractive}
                            minimapHidden={minimapHidden}
                            onToggleMinimap={toggleMinimap}
                        />

                        {!minimapHidden && (
                            <SequenceMinimap
                                participantXs={participants.map((p) => pPositions[p])}
                                messages={messages}
                                totalW={totalW}
                                totalH={totalH}
                                activeSeq={activeSeqNum}
                                visitedSeqs={visitedSeqNums}
                                viewport={zoom.viewport}
                                onJump={zoom.panToFraction}
                            />
                        )}
                    </div>
                </div>

                <div className={COMMENTARY_PANEL_WIDTH}>
                    <FlowCommentary
                        transitions={transitions}
                        architecture={architecture}
                        currentStep={step}
                        onStepSelect={i => { stopPlaying(); setStep(i); }}
                    />
                </div>
            </div>

            <PlaybackControls playback={playback} totalSteps={seqNumbers.length} statusText={statusText} />
        </div>
    );
}
