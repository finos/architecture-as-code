import type { C4Element } from '@finos/calm-models/c4';
import { colors } from '../../../../theme/colors.js';

/** The query parameters of the C4 tab. */
export const C4_LEVEL_PARAM = 'level';
export const C4_SCOPE_PARAM = 'scope';
export const C4_TAB_PARAMS = [C4_LEVEL_PARAM, C4_SCOPE_PARAM] as const;

export const C4_KIND_LABEL: Record<string, string> = {
    person: 'Person',
    'software-system': 'Software System',
    container: 'Container',
    component: 'Component',
};

export const C4_EXTERNAL_LABEL: Record<string, string> = {
    'outside-enterprise': 'outside the enterprise',
    'mapped-external': 'external type',
    'other-team': 'owned by another team',
};

export function c4Fill(element: C4Element): string {
    if (element.external.length > 0) return colors.c4.external;
    switch (element.kind) {
    case 'person':
        return colors.c4.person;
    case 'software-system':
        return colors.c4.softwareSystem;
    case 'component':
        return colors.c4.component;
    default:
        return colors.c4.container;
    }
}

/** The first sentence, cut to `max` characters. CALM descriptions are often long (#3184). */
export function shortLabel(text: string, max = 60): string {
    const firstSentence = text.split(/(?<=\.)\s/)[0].replace(/\.$/, '');
    return firstSentence.length > max ? `${firstSentence.slice(0, max - 1).trimEnd()}…` : firstSentence;
}
