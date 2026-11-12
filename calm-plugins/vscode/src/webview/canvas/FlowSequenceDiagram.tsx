import React, { useMemo, useState, useRef, useCallback, useId } from 'react';
import type { CalmFlow } from '../../core/types';
import type { CalmArchitecture } from '../transforms/calm-editor-transformer';
import { getSourceNodeId, getTargetNodeId, getNodeName, orientEndpoints } from './flow-sequence-helper';
import { getNodeStyleOverride } from '../utils/standard-node-style';
import { getFlowPlaybackState } from './flow-playback';

interface FlowSequenceDiagramProps {
    flow: CalmFlow;
    architecture: CalmArchitecture;
    flowColor?: string;
    currentStep?: number;
    transitionColors?: Map<string, string>;
}

const COL_WIDTH = 180;
const COL_GAP = 30;
const MAX_CHARS_PER_LINE = 20;
const HEADER_HEIGHT = 70;
const ROW_HEIGHT = 56;
const FIRST_COL_X = 50;
const CANVAS_PAD_X = 80;
const CANVAS_PAD_Y = 60;
const LIFELINE_INSET = 10;
const MESSAGE_TOP_OFFSET = 10;
const MESSAGE_LABEL_OFFSET = 10;
const PARTICIPANT_BOX_Y = 8;
const PARTICIPANT_LINE_HEIGHT = 16;
const PARTICIPANT_BOX_PADDING = 12;
const PARTICIPANT_BOX_RADIUS = 8;
const PARTICIPANT_FONT_SIZE = 13;
const MESSAGE_FONT_SIZE = 11;
const LIFELINE_DASH = '6,4';
const RETURN_DASH = '6,3';
const DEFAULT_COLOR = '#60a5fa';

interface Participant {
    id: string;
    label: string;
}

interface SequenceMessage {
    sx: number;
    dx: number;
    y: number;
    isReturn: boolean;
    seq: number;
    desc?: string;
    relId?: string;
}

function wrapText(text: string, maxChars: number): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
        if (current && (current.length + 1 + word.length) > maxChars) {
            lines.push(current);
            current = word;
        } else {
            current = current ? `${current} ${word}` : word;
        }
    }
    if (current) lines.push(current);
    return lines.length > 0 ? lines : [text];
}

function getNodeColor(nodeId: string, arch: CalmArchitecture): { bg: string; text: string; border: string } | undefined {
    const node = arch.nodes?.find(n => n['unique-id'] === nodeId);
    if (!node) return undefined;
    const style = getNodeStyleOverride(node);
    if (style.background) return { bg: style.background, text: style.text ?? '#ffffff', border: style.background };
    return undefined;
}

export function FlowSequenceDiagram({ flow, architecture, flowColor, currentStep = 0, transitionColors }: FlowSequenceDiagramProps) {
    const color = flowColor || DEFAULT_COLOR;
    const markerPrefix = useId().replace(/:/g, '-');

    const data = useMemo(() => {
        const transitions = flow.transitions ?? [];
        if (transitions.length === 0) return null;

        const participantMap = new Map<string, string>();
        for (const t of transitions) {
            const relId = t['relationship-unique-id'];
            const srcId = getSourceNodeId(relId, architecture);
            const dstId = getTargetNodeId(relId, architecture);
            if (srcId !== 'unknown') {
                participantMap.set(srcId, getNodeName(srcId, architecture));
            }
            if (dstId !== 'unknown') {
                participantMap.set(dstId, getNodeName(dstId, architecture));
            }
            if (srcId === 'unknown' && dstId === 'unknown' && relId) {
                const syntheticSrc = `${relId}:src`;
                const syntheticDst = `${relId}:dst`;
                if (!participantMap.has(syntheticSrc)) participantMap.set(syntheticSrc, relId.split('-').slice(0, 3).join('-'));
                if (!participantMap.has(syntheticDst)) participantMap.set(syntheticDst, '?');
            }
        }
        const participants: Participant[] = Array.from(participantMap, ([id, label]) => ({ id, label }));

        const pPositions: Record<string, number> = {};
        participants.forEach(({ id }, i) => {
            pPositions[id] = FIRST_COL_X + i * (COL_WIDTH + COL_GAP) + COL_WIDTH / 2;
        });
        const totalW = participants.length * (COL_WIDTH + COL_GAP) + CANVAS_PAD_X;
        const BOTTOM_HEADER_GAP = 40;
        const totalH = HEADER_HEIGHT + transitions.length * ROW_HEIGHT + BOTTOM_HEADER_GAP + HEADER_HEIGHT + CANVAS_PAD_Y;

        const messages = transitions.flatMap<SequenceMessage>((t, i) => {
            const isReturn = t.direction === 'destination-to-source';
            const relId = t['relationship-unique-id'];
            let rawSrc = getSourceNodeId(relId, architecture);
            let rawDst = getTargetNodeId(relId, architecture);
            if (rawSrc === 'unknown' && rawDst === 'unknown' && relId) {
                rawSrc = `${relId}:src`;
                rawDst = `${relId}:dst`;
            }
            const [srcName, dstName] = orientEndpoints(rawSrc, rawDst, isReturn);
            const sx = pPositions[srcName];
            const dx = pPositions[dstName];
            if (sx === undefined || dx === undefined) return [];
            return [{
                sx, dx,
                y: HEADER_HEIGHT + MESSAGE_TOP_OFFSET + i * ROW_HEIGHT,
                isReturn,
                seq: t['sequence-number'],
                desc: t.description,
                relId,
            }];
        });

        return { participants, pPositions, messages, totalW, totalH };
    }, [flow, architecture]);

    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [panning, setPanning] = useState(false);
    const isPanning = useRef(false);
    const panStart = useRef({ x: 0, y: 0 });

    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        setZoom(prev => Math.min(4, Math.max(0.2, prev - e.deltaY * 0.001)));
    }, []);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button !== 0) return;
        isPanning.current = true;
        setPanning(true);
        panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }, [pan]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isPanning.current) return;
        setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
    }, []);

    const handleMouseUp = useCallback(() => { isPanning.current = false; setPanning(false); }, []);

    const handleReset = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, []);

    if (!data) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--calm-fg-muted)' }}>
                No transitions to display
            </div>
        );
    }

    const { participants, pPositions, messages, totalW, totalH } = data;
    const { activeSequence: activeSeqNum, visitedSequences: visitedSeqNums } = getFlowPlaybackState(flow.transitions ?? [], currentStep);
    const DIMMED_OPACITY = 0.12;
    const VISITED_OPACITY = 0.5;
    const activeParticipantIds = new Set<string>();
    const visitedParticipantIds = new Set<string>();
    if (currentStep > 0) {
        for (const m of messages) {
            const srcId = participants.find(p => pPositions[p.id] === m.sx)?.id;
            const dstId = participants.find(p => pPositions[p.id] === m.dx)?.id;
            if (m.seq === activeSeqNum) {
                if (srcId) activeParticipantIds.add(srcId);
                if (dstId) activeParticipantIds.add(dstId);
            }
            if (visitedSeqNums.has(m.seq)) {
                if (srcId) visitedParticipantIds.add(srcId);
                if (dstId) visitedParticipantIds.add(dstId);
            }
        }
    }

    return (
        <div
            data-sequence-svg=""
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ width: '100%', height: '100%', overflow: 'hidden', background: 'var(--calm-bg)', cursor: panning ? 'grabbing' : 'grab', position: 'relative' }}
        >
            <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '4px', zIndex: 10 }}>
                <button type="button" onClick={() => setZoom(z => Math.min(4, z + 0.2))} style={zoomBtn}>+</button>
                <button type="button" onClick={() => setZoom(z => Math.max(0.2, z - 0.2))} style={zoomBtn}>-</button>
                <button type="button" onClick={handleReset} style={zoomBtn}>Fit</button>
            </div>
            <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0', transition: panning ? undefined : 'transform 0.1s' }}>
            <svg
                viewBox={`0 0 ${totalW} ${totalH}`}
                preserveAspectRatio="xMinYMin meet"
                style={{ width: '100%', minHeight: totalH }}
            >
                {/* Lifelines */}
                {participants.map(({ id }) => {
                    const cx = pPositions[id];
                    const pOpacity = currentStep === 0 ? 1
                        : activeParticipantIds.has(id) ? 1
                        : visitedParticipantIds.has(id) ? VISITED_OPACITY
                        : DIMMED_OPACITY;
                    return (
                        <line
                            key={`life-${id}`}
                            x1={cx} y1={HEADER_HEIGHT - LIFELINE_INSET}
                            x2={cx} y2={totalH - LIFELINE_INSET}
                            style={{ stroke: 'var(--calm-border)', opacity: pOpacity, transition: 'opacity 0.3s' }}
                            strokeWidth={1.5}
                            strokeDasharray={LIFELINE_DASH}
                        />
                    );
                })}

                {/* Participant boxes */}
                {participants.map(({ id, label }) => {
                    const cx = pPositions[id];
                    const pOpacity = currentStep === 0 ? 1
                        : activeParticipantIds.has(id) ? 1
                        : visitedParticipantIds.has(id) ? VISITED_OPACITY
                        : DIMMED_OPACITY;
                    const lines = wrapText(label, MAX_CHARS_PER_LINE);
                    const boxHeight = lines.length * PARTICIPANT_LINE_HEIGHT + PARTICIPANT_BOX_PADDING * 2;
                    const textStartY = PARTICIPANT_BOX_Y + PARTICIPANT_BOX_PADDING + PARTICIPANT_FONT_SIZE;
                    const nodeColor = getNodeColor(id, architecture);
                    return (
                        <g key={`part-${id}`} style={{ opacity: pOpacity, transition: 'opacity 0.3s' }}>
                            <rect
                                x={cx - COL_WIDTH / 2}
                                y={PARTICIPANT_BOX_Y}
                                width={COL_WIDTH}
                                height={boxHeight}
                                rx={PARTICIPANT_BOX_RADIUS}
                                fill={nodeColor?.bg ?? undefined}
                                style={nodeColor ? undefined : { fill: 'var(--calm-bg-input)' }}
                                stroke={nodeColor?.border ?? '#64748b'}
                                strokeWidth={1.5}
                            />
                            <text
                                x={cx}
                                textAnchor="middle"
                                fill={nodeColor?.text ?? undefined}
                                style={nodeColor ? undefined : { fill: 'var(--calm-fg)' }}
                                fontSize={PARTICIPANT_FONT_SIZE}
                                fontWeight={600}
                            >
                                {lines.map((line, li) => (
                                    <tspan key={li} x={cx} y={textStartY + li * PARTICIPANT_LINE_HEIGHT}>{line}</tspan>
                                ))}
                            </text>
                        </g>
                    );
                })}

                {/* Messages */}
                {messages.map((m, i) => {
                    const { sx, dx, y, isReturn, seq, desc, relId: msgRelId } = m;
                    const mx = (sx + dx) / 2;
                    const isSelfLoop = sx === dx;
                    const msgColor = (transitionColors && msgRelId ? transitionColors.get(msgRelId) : undefined) ?? color;

                    const isActive = seq === activeSeqNum;
                    const isVisited = visitedSeqNums.has(seq);
                    const msgOpacity = currentStep === 0 ? 1
                        : isActive ? 1
                        : isVisited ? VISITED_OPACITY
                        : DIMMED_OPACITY;
                    const msgStrokeWidth = isActive ? 3 : isReturn ? 1 : 1.5;
                    const msgFilter = isActive ? `drop-shadow(0 0 4px ${msgColor})` : undefined;
                    const markerId = `${markerPrefix}-arrow-${i}`;
                    const marker = (
                        <defs>
                            <marker id={markerId} markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                                <polygon points="0 0,10 3.5,0 7" fill={msgColor} opacity={isReturn && !isActive ? 0.6 : 1} />
                            </marker>
                        </defs>
                    );

                    if (isSelfLoop) {
                        const loopW = 40;
                        const loopH = 20;
                        return (
                            <g key={`msg-${i}`} style={{ opacity: msgOpacity, transition: 'opacity 0.3s' }}>
                                {marker}
                                <path
                                    d={`M ${sx} ${y} L ${sx + loopW} ${y} L ${sx + loopW} ${y + loopH} L ${sx + 2} ${y + loopH}`}
                                    fill="none"
                                    stroke={msgColor}
                                    strokeWidth={msgStrokeWidth}
                                    strokeDasharray={isReturn ? RETURN_DASH : undefined}
                                    markerEnd={`url(#${markerId})`}
                                    style={msgFilter ? { filter: msgFilter } : undefined}
                                />
                                {isActive && (
                                    <circle r={4} fill={msgColor} style={{ filter: `drop-shadow(0 0 4px ${msgColor})` }}>
                                        <animate attributeName="cx" values={`${sx};${sx + loopW};${sx + loopW};${sx + 2}`} keyTimes="0;0.33;0.66;1" dur="1.2s" repeatCount="indefinite" />
                                        <animate attributeName="cy" values={`${y};${y};${y + loopH};${y + loopH}`} keyTimes="0;0.33;0.66;1" dur="1.2s" repeatCount="indefinite" />
                                        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="1.2s" repeatCount="indefinite" />
                                    </circle>
                                )}
                                <text
                                    x={sx + loopW + 4}
                                    y={y + loopH / 2 + 3}
                                    fontSize={MESSAGE_FONT_SIZE}
                                    style={{ fill: 'var(--calm-fg)' }}
                                >
                                    <tspan fontWeight={700} style={{ fill: msgColor }}>{seq}. </tspan>
                                    {desc && desc.length > 60 ? desc.slice(0, 60) + '...' : desc}
                                </text>
                            </g>
                        );
                    }

                    return (
                        <g key={`msg-${i}`} style={{ opacity: msgOpacity, transition: 'opacity 0.3s' }}>
                            {marker}
                            <line
                                x1={sx} y1={y}
                                x2={dx} y2={y}
                                stroke={msgColor}
                                strokeWidth={msgStrokeWidth}
                                strokeDasharray={isReturn && !isActive ? RETURN_DASH : undefined}
                                markerEnd={`url(#${markerId})`}
                                style={msgFilter ? { filter: msgFilter } : undefined}
                            />
                            {isActive && (
                                <circle r={4} fill={msgColor} style={{ filter: `drop-shadow(0 0 4px ${msgColor})` }}>
                                    <animate attributeName="cx" from={String(sx)} to={String(dx)} dur="1s" repeatCount="indefinite" />
                                    <animate attributeName="cy" from={String(y)} to={String(y)} dur="1s" repeatCount="indefinite" />
                                    <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="1s" repeatCount="indefinite" />
                                </circle>
                            )}
                            <text
                                x={mx}
                                y={y - MESSAGE_LABEL_OFFSET}
                                textAnchor="middle"
                                fontSize={MESSAGE_FONT_SIZE}
                                style={{ fill: 'var(--calm-fg)' }}
                            >
                                <tspan fontWeight={700} style={{ fill: msgColor }}>{seq}. </tspan>
                                {desc && desc.length > 60 ? desc.slice(0, 60) + '...' : desc}
                            </text>
                        </g>
                    );
                })}

                {/* Bottom participant boxes */}
                {participants.map(({ id, label }) => {
                    const cx = pPositions[id];
                    const bottomY = totalH - CANVAS_PAD_Y - LIFELINE_INSET;
                    const lines = wrapText(label, MAX_CHARS_PER_LINE);
                    const boxHeight = lines.length * PARTICIPANT_LINE_HEIGHT + PARTICIPANT_BOX_PADDING * 2;
                    const textStartY = bottomY + PARTICIPANT_BOX_PADDING + PARTICIPANT_FONT_SIZE;
                    const nodeColor = getNodeColor(id, architecture);
                    return (
                        <g key={`part-bottom-${id}`}>
                            <rect
                                x={cx - COL_WIDTH / 2}
                                y={bottomY}
                                width={COL_WIDTH}
                                height={boxHeight}
                                rx={PARTICIPANT_BOX_RADIUS}
                                fill={nodeColor?.bg ?? undefined}
                                style={nodeColor ? undefined : { fill: 'var(--calm-bg-input)' }}
                                stroke={nodeColor?.border ?? '#64748b'}
                                strokeWidth={1.5}
                            />
                            <text
                                x={cx}
                                textAnchor="middle"
                                fill={nodeColor?.text ?? undefined}
                                style={nodeColor ? undefined : { fill: 'var(--calm-fg)' }}
                                fontSize={PARTICIPANT_FONT_SIZE}
                                fontWeight={600}
                            >
                                {lines.map((line, li) => (
                                    <tspan key={li} x={cx} y={textStartY + li * PARTICIPANT_LINE_HEIGHT}>{line}</tspan>
                                ))}
                            </text>
                        </g>
                    );
                })}
            </svg>
            </div>
        </div>
    );
}

const zoomBtn: React.CSSProperties = {
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--calm-fg)',
    background: 'var(--calm-bg)',
    border: '1px solid var(--calm-border-input)',
    borderRadius: '4px',
    cursor: 'pointer',
};
