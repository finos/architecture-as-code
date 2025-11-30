import { FiExternalLink } from 'react-icons/fi';
import { THEME } from '../theme';
import type { ControlRequirement } from '../ControlsPanel';

interface ControlRequirementItemProps {
    requirement: ControlRequirement;
    onNodeClick?: (nodeId: string) => void;
}

export function ControlRequirementItem({ requirement, onNodeClick }: ControlRequirementItemProps) {
    return (
        <div
            style={{
                borderRadius: '6px',
                background: THEME.colors.backgroundSecondary,
                border: `1px solid ${THEME.colors.border}`,
                padding: '8px',
            }}
        >
            {requirement['requirement-url'] && (
                <RequirementLink url={requirement['requirement-url']} />
            )}

            {requirement['config-url'] && (
                <ConfigLink url={requirement['config-url']} />
            )}

            {requirement.config && (
                <ConfigSection config={requirement.config} onNodeClick={onNodeClick} />
            )}
        </div>
    );
}

function RequirementLink({ url }: { url: string }) {
    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                color: THEME.colors.info,
                textDecoration: 'none',
                marginBottom: '4px',
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.textDecoration = 'underline';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.textDecoration = 'none';
            }}
        >
            <FiExternalLink style={{ width: '12px', height: '12px' }} />
            <span style={{ wordBreak: 'break-all' }}>{url}</span>
        </a>
    );
}

function ConfigLink({ url }: { url: string }) {
    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                color: THEME.colors.info,
                textDecoration: 'none',
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.textDecoration = 'underline';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.textDecoration = 'none';
            }}
        >
            <FiExternalLink style={{ width: '12px', height: '12px' }} />
            <span>Config: {url}</span>
        </a>
    );
}

interface ConfigSectionProps {
    config: NonNullable<ControlRequirement['config']>;
    onNodeClick?: (nodeId: string) => void;
}

function ConfigSection({ config, onNodeClick }: ConfigSectionProps) {
    const otherConfig = Object.fromEntries(
        Object.entries(config).filter(([key]) => key !== 'appliesTo')
    );

    return (
        <div style={{ marginTop: '8px' }}>
            <span
                style={{
                    display: 'block',
                    fontSize: '11px',
                    fontWeight: 500,
                    color: THEME.colors.muted,
                    marginBottom: '4px',
                }}
            >
                Configuration:
            </span>

            {config.appliesTo && (
                <AppliesToSection appliesTo={config.appliesTo} onNodeClick={onNodeClick} />
            )}

            <pre
                style={{
                    fontSize: '10px',
                    color: THEME.colors.foreground,
                    background: THEME.colors.card,
                    padding: '8px',
                    borderRadius: '4px',
                    overflow: 'auto',
                    maxHeight: '100px',
                    margin: 0,
                }}
            >
                {JSON.stringify(otherConfig, null, 2)}
            </pre>
        </div>
    );
}

interface AppliesToSectionProps {
    appliesTo: NonNullable<NonNullable<ControlRequirement['config']>['appliesTo']>;
    onNodeClick?: (nodeId: string) => void;
}

function AppliesToSection({ appliesTo, onNodeClick }: AppliesToSectionProps) {
    return (
        <div style={{ marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', color: THEME.colors.muted }}>Applies to:</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                {appliesTo.nodes?.map((nodeId) => (
                    <NodeTag key={nodeId} nodeId={nodeId} onClick={onNodeClick} />
                ))}
                {appliesTo.relationships?.map((relId) => (
                    <RelationshipTag key={relId} relId={relId} />
                ))}
            </div>
        </div>
    );
}

function NodeTag({ nodeId, onClick }: { nodeId: string; onClick?: (nodeId: string) => void }) {
    return (
        <span
            onClick={(e) => {
                e.stopPropagation();
                onClick?.(nodeId);
            }}
            style={{
                display: 'inline-block',
                padding: '2px 6px',
                borderRadius: '4px',
                background: THEME.colors.card,
                border: `1px solid ${THEME.colors.border}`,
                fontSize: '10px',
                color: THEME.colors.foreground,
                cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.background = `${THEME.colors.accent}20`;
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.background = THEME.colors.card;
            }}
        >
            {nodeId}
        </span>
    );
}

function RelationshipTag({ relId }: { relId: string }) {
    return (
        <span
            style={{
                display: 'inline-block',
                padding: '2px 6px',
                borderRadius: '4px',
                background: 'transparent',
                border: `1px solid ${THEME.colors.border}`,
                fontSize: '10px',
                color: THEME.colors.foreground,
            }}
        >
            {relId}
        </span>
    );
}
