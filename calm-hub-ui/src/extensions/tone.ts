import { Tone } from '../model/extensions.js';

const BADGE_CLASS: Record<Tone, string> = {
    positive: 'badge-success',
    negative: 'badge-error',
    warning: 'badge-warning',
    info: 'badge-info',
    neutral: 'badge-ghost',
};

const ALERT_CLASS: Record<Tone, string> = {
    positive: 'alert-success',
    negative: 'alert-error',
    warning: 'alert-warning',
    info: 'alert-info',
    neutral: '',
};

// An extension can send any value. Own keys only, so a tone such as "constructor" does not read the prototype.
const lookup = (classes: Record<Tone, string>, tone: unknown, fallback: Tone) =>
    typeof tone === 'string' && Object.hasOwn(classes, tone) ? classes[tone as Tone] : classes[fallback];

export const badgeClass = (tone: unknown) => lookup(BADGE_CLASS, tone, 'neutral');

export const alertClass = (tone: unknown) => lookup(ALERT_CLASS, tone, 'info');
