/** Both flow tabs use the same card chrome, so the two views line up exactly. */
export const DIAGRAM_CARD_CLASS =
    'bg-base-100 rounded-xl shadow-sm border border-base-300 h-full w-full overflow-hidden';

export const COMMENTARY_PANEL_WIDTH = 'w-72 shrink-0';

/** SVG stroke widths for sequence diagram elements */
export const STROKE_WIDTH = {
    THIN: 1.5,
    NORMAL: 2,
} as const;

/** Animation and transition timings */
export const TIMING = {
    TRANSITION: '0.3s ease',
} as const;
