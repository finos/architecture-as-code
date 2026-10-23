import { useCallback, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react';
import { IoCubeOutline, IoGitNetworkOutline, IoEyeOutline, IoCodeOutline } from 'react-icons/io5';
import { JsonRenderer } from '../../../hub/components/json-renderer/JsonRenderer.js';
import { NodeDetails } from './NodeDetails.js';
import { RelationshipDetails } from './RelationshipDetails.js';
import { CloseButton } from './CloseButton.js';
import { isCALMNode, isCALMRelationship } from './calm-type-guards.js';
import type { SidebarProps } from '../../contracts/visualizer-contracts.js';

/** The details panel's width on wide screens, kept for the session so it survives closing and reopening the panel. */
const WIDTH_KEY = 'calmHub.detailsPanelWidth';
const DEFAULT_WIDTH = 384;
const MIN_WIDTH = 320;
const KEY_STEP = 32;

const maxWidth = () => Math.max(MIN_WIDTH, Math.round(window.innerWidth * 0.6));
const clampWidth = (width: number) => Math.min(maxWidth(), Math.max(MIN_WIDTH, Math.round(width)));

function readWidth(storage: Storage): number {
    try {
        const stored = Number(storage.getItem(WIDTH_KEY));
        return stored ? clampWidth(stored) : DEFAULT_WIDTH;
    } catch {
        return DEFAULT_WIDTH;
    }
}

function saveWidth(width: number, storage: Storage) {
    try {
        storage.setItem(WIDTH_KEY, String(width));
    } catch {
        // Storage can be unavailable (private mode); the width then lasts only as long as the panel.
    }
}

export function Sidebar({ selectedData, closeSidebar, storage = sessionStorage }: SidebarProps) {
    const [activeTab, setActiveTab] = useState<'details' | 'json'>('details');
    const [width, setWidth] = useState(() => readWidth(storage));
    const drag = useRef<{ startX: number; startWidth: number } | null>(null);
    const isNode = isCALMNode(selectedData);
    const isRelationship = isCALMRelationship(selectedData);

    const resize = useCallback((next: number) => {
        const clamped = clampWidth(next);
        setWidth(clamped);
        saveWidth(clamped, storage);
    }, [storage]);

    // The panel sits on the right, so dragging its left edge leftwards makes it wider.
    const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        drag.current = { startX: e.clientX, startWidth: width };
    };
    const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
        if (drag.current) resize(drag.current.startWidth + drag.current.startX - e.clientX);
    };
    const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
        drag.current = null;
        if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    };
    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'ArrowLeft') resize(width + KEY_STEP);
        else if (e.key === 'ArrowRight') resize(width - KEY_STEP);
        else return;
        e.preventDefault();
    };

    return (
        <div
            className="relative h-full w-full lg:w-(--details-width) shrink-0 lg:p-4 lg:pl-2"
            style={{ '--details-width': `${width}px` } as CSSProperties}
        >
            <div
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize details panel"
                aria-valuenow={width}
                aria-valuemin={MIN_WIDTH}
                tabIndex={0}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onKeyDown={onKeyDown}
                onDoubleClick={() => resize(DEFAULT_WIDTH)}
                title="Drag to resize; double-click to reset"
                className="group hidden lg:flex absolute left-0 top-4 bottom-4 w-3 -ml-1 z-10 items-center justify-center cursor-col-resize touch-none focus:outline-none"
            >
                <span className="h-12 w-1 rounded-full bg-base-content/25 group-hover:bg-accent group-focus-visible:bg-accent transition-colors" />
            </div>
            <div className="h-full bg-base-100 lg:rounded-box lg:shadow-xl flex flex-col overflow-hidden">
                <div className="bg-base-200 px-6 py-4 border-b border-base-300 flex items-center justify-between">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        {isNode ? (
                            <IoCubeOutline className="text-accent" />
                        ) : isRelationship ? (
                            <IoGitNetworkOutline className="text-accent" />
                        ) : null}
                        {isNode
                            ? 'Node'
                            : isRelationship
                              ? 'Relationship'
                              : 'Details'}
                    </h2>
                    <div className="flex items-center gap-1">
                        <div className="inline-flex rounded-lg bg-base-300 p-0.5">
                            <button
                                role="tab"
                                aria-label="Details"
                                onClick={() => setActiveTab('details')}
                                className={`p-1.5 rounded-md transition-colors ${activeTab === 'details' ? 'bg-accent text-accent-content' : 'text-base-content/50 hover:text-base-content'}`}
                            >
                                <IoEyeOutline size={14} />
                            </button>
                            <button
                                role="tab"
                                aria-label="JSON"
                                onClick={() => setActiveTab('json')}
                                className={`p-1.5 rounded-md transition-colors ${activeTab === 'json' ? 'bg-accent text-accent-content' : 'text-base-content/50 hover:text-base-content'}`}
                            >
                                <IoCodeOutline size={14} />
                            </button>
                        </div>
                        <CloseButton
                            onClick={(e) => {
                                e.stopPropagation();
                                closeSidebar();
                            }}
                        />
                    </div>
                </div>

                <div className="flex-1 min-h-0 overflow-hidden">
                    {activeTab === 'details' ? (
                        (isNode || isRelationship) ? (
                            <div className="h-full overflow-auto">
                                {isNode ? (
                                    <NodeDetails data={selectedData} />
                                ) : (
                                    <RelationshipDetails data={selectedData} />
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full text-base-content/60">
                                <p>Unknown Selected Entity</p>
                            </div>
                        )
                    ) : (
                        <div className="h-full bg-base-200 overflow-auto">
                            <JsonRenderer json={selectedData} showLineNumbers={false} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
