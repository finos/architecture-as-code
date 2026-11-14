import { AlertTriangle, CheckCircle2, Info, XCircle, type LucideIcon } from 'lucide-react';
import { THEME } from '../theme.js';
import type { DecoratorView, OverlayStatus } from '../../../contracts/contracts.js';
import { extensionMarkerColour } from '../../../../extensions/extensionIdentity.js';

interface OverlayStyle {
    /** Hex, for borders, strokes and `${accent}20` tints. */
    accent: string;
    /** The text role: see the contrast note in src/theme/colors.ts. */
    text: string;
    icon: LucideIcon;
    /** The glyph on an edge badge, where an icon would crowd the label. */
    glyph: string;
}

export const OVERLAY_STYLES: Record<OverlayStatus, OverlayStyle> = {
    ok: { accent: THEME.colors.success, text: THEME.colors.successText, icon: CheckCircle2, glyph: '✓' },
    warn: { accent: THEME.colors.warning, text: THEME.colors.warningText, icon: AlertTriangle, glyph: '!' },
    error: { accent: THEME.colors.error, text: THEME.colors.errorText, icon: XCircle, glyph: '✗' },
    info: { accent: THEME.colors.info, text: THEME.colors.infoText, icon: Info, glyph: 'i' },
};

/** Only a status that needs attention recolours an element; ok and info show as a badge alone. */
export const overlayOutline = (status: OverlayStatus | undefined): string | undefined =>
    status === 'error' || status === 'warn' ? OVERLAY_STYLES[status].accent : undefined;

export const STATUS_NAMES: Record<OverlayStatus, string> = { ok: 'OK', warn: 'Warning', error: 'Error', info: 'Info' };

/** A view takes its extension's marker colour; a view with no known extension is hashed by its own id. */
export const viewMarkerColour = (view: DecoratorView): string => extensionMarkerColour(view.source?.id ?? view.id);
