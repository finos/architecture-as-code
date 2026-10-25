import { CheckCircle2, XCircle } from 'lucide-react';
import { THEME } from './theme.js';

/** The Met or Not met badge an evaluated node shows beside its label. */
export function EvaluationBadge({ status, presenting }: { status: 'met' | 'not-met'; presenting: boolean }) {
    const notMet = status === 'not-met';
    const label = notMet ? 'Not met' : 'Met';
    // Hex for the tint, the text token for the label: see the contrast note in src/theme/colors.ts.
    const color = notMet ? THEME.colors.error : THEME.colors.success;
    const icon = presenting ? '18px' : '12px';
    return (
        <div
            data-testid="control-evaluation-badge"
            data-status={status}
            // role="img" so the label is announced: aria-label is not allowed on a plain div.
            role="img"
            aria-label={`Control evaluation: ${label}`}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: presenting ? '3px 8px' : '2px 6px',
                borderRadius: '4px',
                fontSize: presenting ? '18px' : '12px',
                fontWeight: 600,
                background: `${color}20`,
                color: notMet ? THEME.colors.errorText : THEME.colors.successText,
            }}
        >
            {notMet
                ? <XCircle aria-hidden="true" style={{ width: icon, height: icon }} />
                : <CheckCircle2 aria-hidden="true" style={{ width: icon, height: icon }} />}
            <span>{label}</span>
        </div>
    );
}
