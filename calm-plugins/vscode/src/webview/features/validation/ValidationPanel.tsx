import React from 'react';
import type { ValidationIssue } from '../../stores/canvas-store';

interface ValidationPanelProps {
    issues: ValidationIssue[];
    onClose: () => void;
    onIssueClick: (issue: ValidationIssue) => void;
}

export function ValidationPanel({ issues, onClose, onIssueClick }: ValidationPanelProps) {
    return (
        <div style={panelStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderBottom: '1px solid var(--calm-border)' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--calm-fg)' }}>Validation Results</span>
                <button onClick={onClose} style={{ border: 'none', background: 'transparent', color: 'var(--calm-fg)', cursor: 'pointer', fontSize: '16px' }}>&times;</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
                {issues.length === 0 && <div style={{ padding: '12px 14px', color: 'var(--vscode-testing-iconPassed, #4ec9b0)', fontSize: '12px' }}>Architecture is valid</div>}
                {issues.map((issue, idx) => (
                    <button key={idx} type="button" onClick={() => onIssueClick(issue)} style={{ ...issueRowStyle, cursor: 'pointer' }}>
                        <span style={{ color: issue.severity === 'error' ? 'var(--vscode-editorError-foreground, #f14c4c)' : issue.severity === 'warning' ? 'var(--vscode-editorWarning-foreground, #cca700)' : 'var(--vscode-testing-iconPassed, #4ec9b0)', fontSize: '12px' }}>{issue.severity === 'error' ? '⊘' : issue.severity === 'warning' ? '⚠' : '✓'}</span>
                        <div>
                            <div style={{ fontSize: '11px', color: 'var(--calm-fg)' }}>{issue.message}</div>
                            {issue.nodeId && <div style={{ fontSize: '10px', color: 'var(--calm-fg-muted)', fontFamily: 'monospace' }}>Node: {issue.nodeId}</div>}
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}

const panelStyle: React.CSSProperties = { position: 'absolute', bottom: 0, left: 0, right: 0, maxHeight: '40%', display: 'flex', flexDirection: 'column', background: 'var(--calm-bg)', borderTop: '1px solid var(--calm-border-heavy)', zIndex: 100, boxShadow: '0 -2px 8px var(--vscode-widget-shadow, rgba(0, 0, 0, 0.36))' };
const issueRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: '8px', width: '100%', padding: '6px 14px', border: 'none', borderBottom: '1px solid var(--calm-border)', background: 'transparent', color: 'inherit', font: 'inherit', textAlign: 'left' };