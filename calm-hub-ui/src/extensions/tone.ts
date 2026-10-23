import { Tone } from '../model/extensions.js';

export const BADGE_CLASS: Record<Tone, string> = {
    positive: 'badge-success',
    negative: 'badge-error',
    warning: 'badge-warning',
    info: 'badge-info',
    neutral: 'badge-ghost',
};

export const ALERT_CLASS: Record<Tone, string> = {
    positive: 'alert-success',
    negative: 'alert-error',
    warning: 'alert-warning',
    info: 'alert-info',
    neutral: '',
};
