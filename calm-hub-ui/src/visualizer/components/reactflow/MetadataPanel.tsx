import { useState, useRef, useCallback } from 'react';
import { THEME } from './theme';
import { FlowsPanel, Flow } from './FlowsPanel';
import { ControlsPanel, Control } from './ControlsPanel';
import { FiChevronDown, FiChevronUp } from 'react-icons/fi';

interface MetadataPanelProps {
    flows: Flow[];
    controls: Record<string, Control>;
    onTransitionClick?: (relationshipId: string) => void;
    onNodeClick?: (nodeId: string) => void;
    onControlClick?: (controlId: string) => void;
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    height: number;
    onHeightChange: (height: number) => void;
}

type TabType = 'flows' | 'controls';

export function MetadataPanel({
    flows,
    controls,
    onTransitionClick,
    onNodeClick,
    onControlClick,
    isCollapsed,
    onToggleCollapse,
    height,
    onHeightChange,
}: MetadataPanelProps) {
    const hasFlows = flows.length > 0;
    const hasControls = Object.keys(controls).length > 0;
    const [activeTab, setActiveTab] = useState<TabType>(hasFlows ? 'flows' : 'controls');
    const [isDragging, setIsDragging] = useState(false);
    const dragStartY = useRef<number>(0);
    const dragStartHeight = useRef<number>(0);

    const handleMouseDown = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            setIsDragging(true);
            dragStartY.current = e.clientY;
            dragStartHeight.current = height;

            const handleMouseMove = (e: MouseEvent) => {
                const deltaY = dragStartY.current - e.clientY;
                const newHeight = Math.max(100, Math.min(500, dragStartHeight.current + deltaY));
                onHeightChange(newHeight);
            };

            const handleMouseUp = () => {
                setIsDragging(false);
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        },
        [height, onHeightChange]
    );

    if (!hasFlows && !hasControls) {
        return null;
    }

    // Collapsed view - just a thin bar at the bottom
    if (isCollapsed) {
        return (
            <div
                style={{
                    height: '48px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 16px',
                    borderTop: `1px solid ${THEME.colors.border}`,
                    background: THEME.colors.backgroundSecondary,
                }}
            >
                <div style={{ display: 'flex', gap: '8px', fontSize: '13px', color: THEME.colors.muted }}>
                    {hasFlows && <span>Flows ({flows.length})</span>}
                    {hasFlows && hasControls && <span>•</span>}
                    {hasControls && <span>Controls ({Object.keys(controls).length})</span>}
                </div>
                <button
                    onClick={onToggleCollapse}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '6px',
                        border: 'none',
                        borderRadius: '4px',
                        background: 'transparent',
                        cursor: 'pointer',
                        color: THEME.colors.muted,
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = THEME.colors.border;
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                    }}
                    aria-label="Expand metadata panel"
                >
                    <FiChevronUp style={{ width: '16px', height: '16px' }} />
                </button>
            </div>
        );
    }

    // Expanded view
    return (
        <div
            style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderTop: `1px solid ${THEME.colors.border}`,
                background: THEME.colors.card,
            }}
        >
            {/* Resize Handle */}
            <div
                onMouseDown={handleMouseDown}
                style={{
                    height: '8px',
                    background: isDragging ? THEME.colors.accent : THEME.colors.backgroundSecondary,
                    borderBottom: `1px solid ${THEME.colors.border}`,
                    cursor: 'ns-resize',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => {
                    if (!isDragging) {
                        e.currentTarget.style.background = THEME.colors.border;
                    }
                }}
                onMouseLeave={(e) => {
                    if (!isDragging) {
                        e.currentTarget.style.background = THEME.colors.backgroundSecondary;
                    }
                }}
                title="Drag to resize"
            >
                {/* Drag indicator dots */}
                <div
                    style={{
                        display: 'flex',
                        gap: '3px',
                    }}
                >
                    <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: THEME.colors.muted }} />
                    <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: THEME.colors.muted }} />
                    <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: THEME.colors.muted }} />
                </div>
            </div>

            {/* Header with title and collapse button */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 16px',
                    borderBottom: `1px solid ${THEME.colors.border}`,
                    background: THEME.colors.backgroundSecondary,
                }}
            >
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: THEME.colors.foreground, margin: 0 }}>Metadata</h3>
                <button
                    onClick={onToggleCollapse}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '6px',
                        border: 'none',
                        borderRadius: '4px',
                        background: 'transparent',
                        cursor: 'pointer',
                        color: THEME.colors.muted,
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = THEME.colors.border;
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                    }}
                    aria-label="Collapse metadata panel"
                >
                    <FiChevronDown style={{ width: '16px', height: '16px' }} />
                </button>
            </div>

            {/* Tab Bar */}
            <div
                style={{
                    display: 'flex',
                    gap: '4px',
                    padding: '8px 16px',
                    borderBottom: `1px solid ${THEME.colors.border}`,
                }}
            >
                {hasFlows && (
                    <button
                        onClick={() => setActiveTab('flows')}
                        style={{
                            padding: '6px 12px',
                            borderRadius: '4px',
                            border: 'none',
                            background: activeTab === 'flows' ? THEME.colors.accent : 'transparent',
                            color: activeTab === 'flows' ? '#ffffff' : THEME.colors.foreground,
                            fontSize: '13px',
                            fontWeight: 500,
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                        }}
                        onMouseEnter={(e) => {
                            if (activeTab !== 'flows') {
                                e.currentTarget.style.background = THEME.colors.backgroundSecondary;
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (activeTab !== 'flows') {
                                e.currentTarget.style.background = 'transparent';
                            }
                        }}
                    >
                        Flows ({flows.length})
                    </button>
                )}
                {hasControls && (
                    <button
                        onClick={() => setActiveTab('controls')}
                        style={{
                            padding: '6px 12px',
                            borderRadius: '4px',
                            border: 'none',
                            background: activeTab === 'controls' ? THEME.colors.accent : 'transparent',
                            color: activeTab === 'controls' ? '#ffffff' : THEME.colors.foreground,
                            fontSize: '13px',
                            fontWeight: 500,
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                        }}
                        onMouseEnter={(e) => {
                            if (activeTab !== 'controls') {
                                e.currentTarget.style.background = THEME.colors.backgroundSecondary;
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (activeTab !== 'controls') {
                                e.currentTarget.style.background = 'transparent';
                            }
                        }}
                    >
                        Controls ({Object.keys(controls).length})
                    </button>
                )}
            </div>

            {/* Tab Content */}
            <div style={{ flex: 1, overflow: 'hidden', padding: '12px' }}>
                {activeTab === 'flows' && hasFlows && <FlowsPanel flows={flows} onTransitionClick={onTransitionClick} />}
                {activeTab === 'controls' && hasControls && (
                    <ControlsPanel controls={controls} onNodeClick={onNodeClick} onControlClick={onControlClick} />
                )}
            </div>
        </div>
    );
}
