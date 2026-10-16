import { useId, type ReactNode } from 'react';
import { FiExternalLink } from 'react-icons/fi';
import { THEME } from './theme.js';
import { resolveStandardRef, type PatternRules } from './utils/patternRules.js';

interface PatternRulesStateProps {
    rules: PatternRules;
}

const linkStyle = { color: THEME.colors.accentText };

function StandardItem({ standardRef }: { standardRef: string }) {
    const { label, route, href } = resolveStandardRef(standardRef);
    if (route) {
        return <a href={`#${route}`} className="hover:underline" style={linkStyle}>{label}</a>;
    }
    if (href) {
        return (
            <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline" style={linkStyle}>
                {label}
                <FiExternalLink style={{ flexShrink: 0, width: '12px', height: '12px' }} aria-hidden="true" />
            </a>
        );
    }
    return <span>{label}</span>;
}

const renderStandard = (ref: string) => <StandardItem standardRef={ref} />;

function RuleList({ title, items, render }: { title: string; items: string[]; render: (item: string) => ReactNode }) {
    const headingId = useId();
    if (items.length === 0) return null;
    return (
        <div style={{ marginTop: '16px' }}>
            <h3 id={headingId} style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: THEME.colors.foreground }}>
                {title}
            </h3>
            <ul aria-labelledby={headingId} style={{ margin: '4px 0 0', paddingLeft: '20px', listStyle: 'disc' }}>
                {items.map((item) => (
                    <li key={item}>{render(item)}</li>
                ))}
            </ul>
        </div>
    );
}

export function PatternRulesState({ rules }: PatternRulesStateProps) {
    const headingId = useId();
    return (
        <div
            style={{
                height: '100%',
                overflowY: 'auto',
                display: 'flex',
                padding: '16px',
                background: THEME.colors.background,
            }}
        >
            <section
                aria-labelledby={headingId}
                data-testid="pattern-rules-state"
                style={{
                    margin: 'auto',
                    width: '100%',
                    maxWidth: '560px',
                    padding: '24px',
                    background: THEME.colors.backgroundSecondary,
                    borderRadius: '8px',
                    border: `1px solid ${THEME.colors.border}`,
                    color: THEME.colors.muted,
                    fontSize: '14px',
                    lineHeight: 1.5,
                    overflowWrap: 'anywhere',
                }}
            >
                <h2 id={headingId} style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: THEME.colors.foreground }}>
                    This pattern sets rules, not a structure
                </h2>
                <p style={{ margin: '8px 0 0' }}>
                    It has no fixed nodes or relationships to draw. An architecture that uses it can have any shape, but must
                    follow the rules below.
                </p>
                {rules.description && <p style={{ margin: '12px 0 0', color: THEME.colors.foreground }}>{rules.description}</p>}
                <RuleList title="Every node must follow" items={rules.nodeStandards} render={renderStandard} />
                <RuleList title="Every relationship must follow" items={rules.relationshipStandards} render={renderStandard} />
                <RuleList title="Required controls" items={rules.requiredControls} render={(id) => <code>{id}</code>} />
                <p style={{ margin: '16px 0 0' }}>See the JSON view for the full schema.</p>
            </section>
        </div>
    );
}
