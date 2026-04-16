import { useState, useRef, useCallback, useEffect } from 'react';
import { THEME } from './theme.js';
import { FlowsPanel } from './FlowsPanel.js';
import { ControlsPanel } from './ControlsPanel.js';
import { DeploymentPanel } from './DeploymentPanel.js';
import { AdrsPanel } from './AdrsPanel.js';
import { TabButton } from './TabButton.js';
import { FiChevronDown, FiChevronUp } from 'react-icons/fi';
import type { DeploymentDecorator, MetadataPanelProps, MetadataPanelTabType } from '../../contracts/contracts.js';

export function MetadataPanel({
    flows,
    controls,
    decorators,
    adrs,
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
    const hasDeployment = decorators.length > 0;
    const hasAdrs = adrs.length > 0;
    const defaultTab: MetadataPanelTabType = hasFlows ? 'flows' : hasControls ? 'controls' : hasDeployment ? 'deployment' : 'adrs';
    const [activeTab, setActiveTab] = useState<MetadataPanelTabType>(defaultTab);

    useEffect(() => {
        const tabAvailable: Record<MetadataPanelTabType, boolean> = {
            flows: hasFlows,
            controls: hasControls,
            deployment: hasDeployment,
            adrs: hasAdrs,
        };
        if (!tabAvailable[activeTab]) {
            setActiveTab(defaultTab);
        }
    }, [hasFlows, hasControls, hasDeployment, hasAdrs, activeTab, defaultTab]);

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

    if (!hasFlows && !hasControls && !hasDeployment && !hasAdrs) {
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
                <div style={{ display: 'flex', gap: '8px', fontSize: '13px', fontWeight: 600, color: THEME.colors.foreground }}>
                    {hasFlows && <span>Flows ({flows.length})</span>}
                    {hasFlows && hasControls && <span style={{ color: THEME.colors.muted }}>•</span>}
                    {hasControls && <span>Controls ({Object.keys(controls).length})</span>}
                    {(hasFlows || hasControls) && hasDeployment && <span style={{ color: THEME.colors.muted }}>•</span>}
                    {hasDeployment && <span>Deployment ({decorators.length})</span>}
                    {(hasFlows || hasControls || hasDeployment) && hasAdrs && <span style={{ color: THEME.colors.muted }}>•</span>}
                    {hasAdrs && <span>ADRs ({adrs.length})</span>}
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
                    <TabButton isActive={activeTab === 'flows'} onClick={() => setActiveTab('flows')}>
                        Flows ({flows.length})
                    </TabButton>
                )}
                {hasControls && (
                    <TabButton isActive={activeTab === 'controls'} onClick={() => setActiveTab('controls')}>
                        Controls ({Object.keys(controls).length})
                    </TabButton>
                )}
                {hasDeployment && (
                    <TabButton isActive={activeTab === 'deployment'} onClick={() => setActiveTab('deployment')}>
                        Deployment
                    </TabButton>
                )}
                {hasAdrs && (
                    <TabButton isActive={activeTab === 'adrs'} onClick={() => setActiveTab('adrs')}>
                        ADRs ({adrs.length})
                    </TabButton>
                )}
            </div>

            {/* Tab Content */}
            <div style={{ flex: 1, overflow: 'hidden', padding: '12px' }}>
                {activeTab === 'flows' && hasFlows && <FlowsPanel flows={flows} onTransitionClick={onTransitionClick} />}
                {activeTab === 'controls' && hasControls && (
                    <ControlsPanel controls={controls} onNodeClick={onNodeClick} onControlClick={onControlClick} />
                )}
                {activeTab === 'deployment' && (
                    <DeploymentPanel decorators={decorators as DeploymentDecorator[]} />
                )}
                {activeTab === 'adrs' && hasAdrs && <AdrsPanel adrs={adrs} />}
            </div>
        </div>
    );
}
