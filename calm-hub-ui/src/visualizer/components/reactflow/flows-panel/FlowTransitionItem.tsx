import { FiChevronRight } from 'react-icons/fi';
import { THEME } from '../theme';
import type { FlowTransition } from '../FlowsPanel';

interface FlowTransitionItemProps {
    transition: FlowTransition;
    onClick?: (relationshipId: string) => void;
}

export function FlowTransitionItem({ transition, onClick }: FlowTransitionItemProps) {
    return (
        <div
            onClick={() => onClick?.(transition['relationship-unique-id'])}
            style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                padding: '6px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.background = `${THEME.colors.accent}08`;
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
            }}
        >
            <SequenceBadge sequenceNumber={transition['sequence-number']} />
            <TransitionContent
                description={transition.description}
                relationshipId={transition['relationship-unique-id']}
            />
            <FiChevronRight
                style={{
                    width: '16px',
                    height: '16px',
                    color: THEME.colors.muted,
                    flexShrink: 0,
                    opacity: 0.5,
                }}
            />
        </div>
    );
}

function SequenceBadge({ sequenceNumber }: { sequenceNumber: number }) {
    return (
        <div
            style={{
                flexShrink: 0,
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: `${THEME.colors.accent}20`,
                color: THEME.colors.accent,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: 500,
            }}
        >
            {sequenceNumber}
        </div>
    );
}

interface TransitionContentProps {
    description?: string;
    relationshipId: string;
}

function TransitionContent({ description, relationshipId }: TransitionContentProps) {
    return (
        <div style={{ flex: 1, minWidth: 0 }}>
            <p
                style={{
                    fontSize: '12px',
                    color: THEME.colors.foreground,
                    margin: 0,
                    lineHeight: 1.4,
                }}
            >
                {description}
            </p>
            {relationshipId && (
                <span
                    style={{
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        color: THEME.colors.muted,
                    }}
                >
                    {relationshipId}
                </span>
            )}
        </div>
    );
}
