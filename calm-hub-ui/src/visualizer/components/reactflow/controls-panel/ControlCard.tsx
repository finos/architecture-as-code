import { FiShield } from 'react-icons/fi';
import { THEME } from '../theme';
import { ControlRequirementItem } from './ControlRequirementItem';
import { AIGFMappingSection } from './AIGFMappingSection';
import type { Control } from '../ControlsPanel';

interface ControlCardProps {
    controlId: string;
    control: Control;
    onNodeClick?: (nodeId: string) => void;
    onControlClick?: (controlId: string) => void;
}

export function ControlCard({ controlId, control, onNodeClick, onControlClick }: ControlCardProps) {
    return (
        <div
            onClick={() => onControlClick?.(controlId)}
            style={{
                borderRadius: '8px',
                border: `1px solid ${THEME.colors.border}`,
                background: THEME.colors.card,
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'border-color 0.15s',
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = `${THEME.colors.accent}80`;
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = THEME.colors.border;
            }}
            title="Click to view control details"
        >
            <ControlCardHeader
                controlId={controlId}
                control={control}
                onNodeClick={onNodeClick}
            />

            {control.requirements && control.requirements.length > 0 && (
                <RequirementsSection
                    requirements={control.requirements}
                    onNodeClick={onNodeClick}
                />
            )}

            <AIGFMappingSection
                mitigations={control['aigf-mitigations']}
                risks={control['aigf-risks']}
            />
        </div>
    );
}

interface ControlCardHeaderProps {
    controlId: string;
    control: Control;
    onNodeClick?: (nodeId: string) => void;
}

function ControlCardHeader({ controlId, control, onNodeClick }: ControlCardHeaderProps) {
    return (
        <div
            style={{
                padding: '12px',
                background: `${THEME.colors.success}10`,
                borderBottom: `1px solid ${THEME.colors.border}`,
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <FiShield style={{ width: '14px', height: '14px', color: THEME.colors.success }} />
                <span
                    style={{
                        fontFamily: 'monospace',
                        fontSize: '12px',
                        color: THEME.colors.muted,
                    }}
                >
                    {controlId}
                </span>
            </div>

            {control.nodeName && (
                <NodeBadge
                    nodeName={control.nodeName}
                    nodeId={control.appliesTo}
                    onClick={onNodeClick}
                />
            )}

            {control.relationshipDescription && (
                <RelationshipBadge description={control.relationshipDescription} />
            )}

            {control.description && (
                <p style={{ fontSize: '12px', color: THEME.colors.foreground, margin: '4px 0 0 0' }}>
                    {control.description}
                </p>
            )}
        </div>
    );
}

interface NodeBadgeProps {
    nodeName: string;
    nodeId?: string;
    onClick?: (nodeId: string) => void;
}

function NodeBadge({ nodeName, nodeId, onClick }: NodeBadgeProps) {
    return (
        <div style={{ marginTop: '6px', marginBottom: '8px' }}>
            <span
                onClick={(e) => {
                    e.stopPropagation();
                    if (nodeId) onClick?.(nodeId);
                }}
                style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: THEME.colors.backgroundSecondary,
                    border: `1px solid ${THEME.colors.border}`,
                    fontSize: '11px',
                    color: THEME.colors.foreground,
                    cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = `${THEME.colors.accent}20`;
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = THEME.colors.backgroundSecondary;
                }}
            >
                Node: {nodeName}
            </span>
        </div>
    );
}

function RelationshipBadge({ description }: { description: string }) {
    return (
        <div style={{ marginTop: '6px', marginBottom: '8px' }}>
            <span
                style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: 'transparent',
                    border: `1px solid ${THEME.colors.border}`,
                    fontSize: '11px',
                    color: THEME.colors.foreground,
                }}
            >
                Relationship: {description}
            </span>
        </div>
    );
}

interface RequirementsSectionProps {
    requirements: NonNullable<Control['requirements']>;
    onNodeClick?: (nodeId: string) => void;
}

function RequirementsSection({ requirements, onNodeClick }: RequirementsSectionProps) {
    return (
        <div style={{ padding: '12px' }}>
            <h4
                style={{
                    fontSize: '11px',
                    fontWeight: 500,
                    color: THEME.colors.muted,
                    textTransform: 'uppercase',
                    marginBottom: '8px',
                }}
            >
                Requirements
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {requirements.map((req, idx) => (
                    <ControlRequirementItem
                        key={idx}
                        requirement={req}
                        onNodeClick={onNodeClick}
                    />
                ))}
            </div>
        </div>
    );
}
