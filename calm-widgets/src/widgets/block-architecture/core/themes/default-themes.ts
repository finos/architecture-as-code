import { ThemeColors } from '../../types';

interface ThemeBuilderDetails {
    darkMode: boolean;
    fontSize?: string;
    strokeWidth?: number;
    background: string[];
    tonal: string[];
    warning: string[];
    text: string[];
    main: string[];
};

function buildTheme(base: ThemeBuilderDetails): ThemeColors {
    return {
        base: {
            darkMode: base.darkMode ?? false,
            edgeLabelBackground: base.background[2],
            fontSize: base.fontSize ?? '14px',
            lineColor: base.text[0]
        },
        boundary: {
            fill: base.background[1],
            stroke: base.main[4],
            strokeWidth: base.strokeWidth ?? 1,
            strokeDasharray: '5 4',
            color: base.text[0],
        },
        node: {
            fill: base.background[0],
            stroke: base.main[0],
            strokeWidth: base.strokeWidth ?? 1,
            color: base.text[0],
        },
        iface: {
            fill: base.tonal[0],
            stroke: base.tonal[1],
            strokeWidth: base.strokeWidth ?? 1,
            fontSize: '10px',
            color: base.text[0],
        },
        highlight: {
            fill: base.warning[2],
            stroke: base.warning[0],
            strokeWidth: base.strokeWidth ?? 1,
            color: base.text[0],
        },
        actor: {
            fill: base.background[0],
            stroke: base.main[0],
            strokeWidth: base.strokeWidth ?? 1,
            color: base.text[0],
        },
        webclient: {
            fill: base.background[0],
            stroke: base.main[1],
            strokeWidth: base.strokeWidth ?? 1,
            color: base.text[0],
        },
        service: {
            fill: base.background[0],
            stroke: base.main[2],
            strokeWidth: base.strokeWidth ?? 1,
            color: base.text[0],
        },
        messagebus: {
            fill: base.background[0],
            stroke: base.main[2],
            strokeWidth: base.strokeWidth ?? 1,
            color: base.text[0],
        },
        database: {
            fill: base.background[0],
            stroke: base.main[3],
            strokeWidth: base.strokeWidth ?? 1,
            color: base.text[0],
        },
        system: {
            fill: base.background[0],
            stroke: base.main[4],
            strokeWidth: base.strokeWidth ?? 1,
            color: base.text[0],
        },
    };
}

// -------------- Theme Presets ---------------- //
// WCAG 2.1 AA requires a minimum contrast ratio of 4.5:1 for normal text.
// WCAG 2.1 AAA requires a minimum contrast ratio of 7:1 for normal text.

/**
 * Light theme - based on #007dff (CALM blue)
 * https://colorffy.com/light-theme-generator?colors=007dff-eef1ff&success=1B7F5C&warning=F0C060&danger=B13535&info=1E56A3&primaryCount=6&surfaceCount=6
 * Min contrast ratio of 10.35 exceeds WCAG 2.1 AAA requirements
 */
export const lightTheme: ThemeColors = buildTheme({
    darkMode: false,
    main: ['#007dff', '#156edf', '#1c60c0', '#2052a2', '#204485'], /* colorffy primary colors a0 to a40 */
    tonal: [/*0*/'#f0f0f0', '#b6b6b6'], /* min contrast of 10.35, colorffy surface tonal colors a0 and a50 */
    background: ['#eef1ff', '#e1e4f0', '#d5d7e1'], /* min contrast ratio of 14.63, colorffy surface colors a0 to a20 */
    warning: ['#f0c060', '#f7dca6', '#fdf7ec'], /* bg2 has 19.69 contrast ratio with black text, colorffy warning colors a0 to a20 */
    text: ['#000000']
});

/**
 * High-contrast light theme - accessibility-focused with strong color differentiation
 * https://colorffy.com/light-theme-generator?colors=007dff-ffffff&success=1B7F5C&warning=F0C060&danger=B13535&info=1E56A3&primaryCount=6&surfaceCount=6
 * Tint calc for warning[2] color: https://colorffy.com/color-scheme-generator?color=f0c060
 * Min contrast ratio of 16.05 exceeds WCAG 2.1 AAA requirements
 */
export const highContrastLightTheme: ThemeColors = buildTheme({
    darkMode: false,
    strokeWidth: 2,
    main: ['#007dff', '#156edf', '#1c60c0', '#2052a2', '#204485'],
    tonal: [/*0*/'#eef1ff', '#afb1b6'], /* min contrast of 18.66 */
    background: ['#ffffff', '#f0f0f0', '#e1e1e1'], /* min contrast ratio of 16.05 */
    warning: ['#f0c060', '#f7dca6', '#feedd1'], /* bg2 has 19.59 contrast ratio, warning[2] is tint 5 of warning[0] */
    text: ['#000000']
});

/**
 * Dark theme - based on #007dff (CALM blue)
 * https://colorffy.com/dark-theme-generator?colors=007dff-2f2f2f&success=22946E&warning=F0C060&danger=9C2121&info=21498A&primaryCount=6&surfaceCount=6
 * Monochromatic calc for warning[2] color: https://colorffy.com/color-scheme-generator?color=f0c060
 * Min contrast ratio of 8.67 exceeds WCAG 2.1 AAA requirements
 */
export const darkTheme: ThemeColors = buildTheme({
    darkMode: true,
    main: ['#007dff', '#4a8aff', '#6b98ff', '#85a6ff', '#9cb4ff'],
    tonal: [/*0*/'#343641', /*50*/'#9e9fa5'], /* min contrast of 10.35 */
    background: ['#2f2f2f', '#434343', '#585858'], /* min contrast ratio of 9.89 */
    warning: ['#f0c060', '#f9e5bd', '#5a4929'], /* bg2 has 8.67 contrast ratio, warning[2] is monochromatic a40 of warning[0] */
    text: ['#ffffff']
});

/**
 * High-contrast dark theme - accessibility-focused with strong color differentiation
 * https://colorffy.com/dark-theme-generator?colors=007dff-000000&success=22946E&warning=F0C060&danger=9C2121&info=21498A&primaryCount=6&surfaceCount=6
 * Monochromatic calc for warning[2] color: https://colorffy.com/color-scheme-generator?color=f0c060
 * Min contrast ratio of 12.26 exceeds WCAG 2.1 AAA requirements
 */
export const highContrastDarkTheme: ThemeColors = buildTheme({
    darkMode: true,
    strokeWidth: 2,
    main: ['#007dff', '#4a8aff', '#6b98ff', '#85a6ff', '#9cb4ff'],
    tonal: [/*0*/'#0f111c', /*50*/'#8a8b91'], /* min contrast of 18.79 */
    background: ['#000000', '#1e1e1e', '#353535'], /* min contrast ratio of 12.26 */
    warning: ['#f0c060', '#f9e5bd', '#2f2719'], /* bg2 has 14.73 contrast ratio, warning[2] is monochromatic a50 of warning[0] */
    text: ['#ffffff']
});

/**
 * Get a theme by preset name
 */
export function getThemeByName(name: string): ThemeColors {
    switch (name) {
    case 'dark':
        return darkTheme;
    case 'high-contrast-dark':
        return highContrastDarkTheme;
    case 'high-contrast-light':
        return highContrastLightTheme;
    case 'light':
    default:
        return lightTheme;
    }
}
