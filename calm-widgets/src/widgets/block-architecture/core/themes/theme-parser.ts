import { ThemeColors } from '../../types';
import { getThemeByName } from './default-themes';

/**
 * Parse and validate theme options
 */
export function parseTheme(
    themeOption?: string,
    themeColorsOption?: string | ThemeColors
): { theme: string; themeColors?: ThemeColors } {
    let theme: string = 'light';
    let themeColors: ThemeColors | undefined;

    // Parse theme preset
    if (themeOption) {
        theme = themeOption.toLowerCase().trim();
    }

    // Parse custom theme colors
    if (themeColorsOption) {
        try {
            if (typeof themeColorsOption === 'string') {
                themeColors = JSON.parse(themeColorsOption);
            } else {
                themeColors = themeColorsOption;
            }

            // Validate that it has required base properties
            if (themeColors && (!themeColors.boundary || !themeColors.node || !themeColors.iface || !themeColors.highlight)) {
                console.warn('Custom theme-colors missing required properties (boundary, node, iface, highlight), using preset theme');
                themeColors = undefined;
            }
        } catch (error) {
            console.warn(`Failed to parse theme-colors JSON: ${error instanceof Error ? error.message : 'unknown error'}`);
            themeColors = undefined;
        }
    }

    return { theme, themeColors };
}

/**
 * Resolve the final theme colors to use
 * Custom colors take precedence, otherwise use preset
 */
export function resolveThemeColors(theme: string, customColors?: ThemeColors): ThemeColors {
    if (customColors) {
        // Merge custom colors with preset to fill in any missing properties
        const baseTheme = getThemeByName(theme);
        return {
            base: customColors.base || baseTheme.base,
            boundary: customColors.boundary || baseTheme.boundary,
            node: customColors.node || baseTheme.node,
            iface: customColors.iface || baseTheme.iface,
            highlight: customColors.highlight || baseTheme.highlight,
            actor: customColors.actor || baseTheme.actor,
            database: customColors.database || baseTheme.database,
            webclient: customColors.webclient || baseTheme.webclient,
            service: customColors.service || baseTheme.service,
            messagebus: customColors.messagebus || baseTheme.messagebus,
            system: customColors.system || baseTheme.system,
        };
    }

    return getThemeByName(theme);
}
