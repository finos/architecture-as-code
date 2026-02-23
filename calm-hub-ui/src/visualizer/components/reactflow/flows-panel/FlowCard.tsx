import { THEME } from '../theme';
import { FlowTransitionItem } from './FlowTransitionItem';
import { AIGFGovernanceSection } from './AIGFGovernanceSection';
import type { Flow } from '../FlowsPanel';

interface FlowCardProps {
    flow: Flow;
    onTransitionClick?: (relationshipId: string) => void;
}

export function FlowCard({ flow, onTransitionClick }: FlowCardProps) {
    return (
        <div
            style={{
                borderRadius: '8px',
                border: `1px solid ${THEME.colors.border}`,
                background: THEME.colors.card,
                overflow: 'hidden',
            }}
        >
            <FlowCardHeader name={flow.name} description={flow.description} />

            <TransitionsList
                transitions={flow.transitions}
                onTransitionClick={onTransitionClick}
            />

            {flow['aigf-governance'] && (
                <AIGFGovernanceSection governance={flow['aigf-governance']} />
            )}
        </div>
    );
}

interface FlowCardHeaderProps {
    name: string;
    description?: string;
}

function FlowCardHeader({ name, description }: FlowCardHeaderProps) {
    return (
        <div
            style={{
                padding: '8px 12px',
                background: `${THEME.colors.accent}10`,
                borderBottom: `1px solid ${THEME.colors.border}`,
            }}
        >
            <h3
                style={{
                    fontWeight: 600,
                    fontSize: '13px',
                    marginBottom: '2px',
                    color: THEME.colors.foreground,
                }}
            >
                {name}
            </h3>
            {description && (
                <p style={{ fontSize: '12px', color: THEME.colors.muted, margin: 0 }}>
                    {description}
                </p>
            )}
        </div>
    );
}

interface TransitionsListProps {
    transitions?: Flow['transitions'];
    onTransitionClick?: (relationshipId: string) => void;
}

function TransitionsList({ transitions, onTransitionClick }: TransitionsListProps) {
    if (!transitions?.length) return null;

    return (
        <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {transitions.map((transition, idx) => (
                <FlowTransitionItem
                    key={idx}
                    transition={transition}
                    onClick={onTransitionClick}
                />
            ))}
        </div>
    );
}
