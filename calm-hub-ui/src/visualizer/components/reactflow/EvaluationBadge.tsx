import { CheckCircle2, XCircle } from 'lucide-react';
import { THEME } from './theme.js';
import { scalePx } from '../../../theme/useDiagramTextScale.js';

/** The Met or Not met badge an evaluated node shows beside its label. */
export function EvaluationBadge({ status, presenting, scale }: { status: 'met' | 'not-met'; presenting: boolean; scale: number }) {
    const notMet = status === 'not-met';
    const label = notMet ? 'Not met' : 'Met';
    // Hex for the tint, the text token for the label: see the contrast note in src/theme/colors.ts.
    const color = notMet ? THEME.colors.error : THEME.colors.success;
    const size = scalePx(presenting ? 18 : 12, scale);
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
                fontSize: size,
                fontWeight: 600,
                background: `${color}20`,
                color: notMet ? THEME.colors.errorText : THEME.colors.successText,
            }}
        >
            {notMet
                ? <XCircle aria-hidden="true" style={{ width: size, height: size }} />
                : <CheckCircle2 aria-hidden="true" style={{ width: size, height: size }} />}
            <span>{label}</span>
        </div>
    );
}
