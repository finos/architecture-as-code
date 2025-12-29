import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseTheme, resolveThemeColors } from './theme-parser';
import { ThemeColors } from '../../types';
import { lightTheme, darkTheme, highContrastTheme } from './default-themes';

describe('theme-parser', () => {
    // Mock console.warn to verify warnings
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
    });

    afterEach(() => {
        consoleWarnSpy.mockRestore();
    });

    describe('parseTheme', () => {
        describe('theme preset parsing', () => {
            it('returns light theme by default when no options provided', () => {
                const result = parseTheme();
                expect(result.theme).toBe('light');
                expect(result.themeColors).toBeUndefined();
            });

            it('returns light theme when undefined is passed', () => {
                const result = parseTheme(undefined, undefined);
                expect(result.theme).toBe('light');
                expect(result.themeColors).toBeUndefined();
            });

            it('parses "light" theme (lowercase)', () => {
                const result = parseTheme('light');
                expect(result.theme).toBe('light');
                expect(result.themeColors).toBeUndefined();
            });

            it('parses "Light" theme (mixed case)', () => {
                const result = parseTheme('Light');
                expect(result.theme).toBe('light');
            });

            it('parses " light " with whitespace trimming', () => {
                const result = parseTheme('  light  ');
                expect(result.theme).toBe('light');
            });

            it('parses "dark" theme', () => {
                const result = parseTheme('dark');
                expect(result.theme).toBe('dark');
            });

            it('parses "Dark" theme (mixed case)', () => {
                const result = parseTheme('Dark');
                expect(result.theme).toBe('dark');
            });

            it('parses "DARK" theme (uppercase)', () => {
                const result = parseTheme('DARK');
                expect(result.theme).toBe('dark');
            });

            it('parses "high-contrast" theme', () => {
                const result = parseTheme('high-contrast');
                expect(result.theme).toBe('high-contrast');
            });

            it('parses "High-Contrast" theme (mixed case)', () => {
                const result = parseTheme('High-Contrast');
                expect(result.theme).toBe('high-contrast');
            });

            it('parses "HIGH-CONTRAST" theme (uppercase)', () => {
                const result = parseTheme('HIGH-CONTRAST');
                expect(result.theme).toBe('high-contrast');
            });

            it('falls back to light for unknown theme preset', () => {
                const result = parseTheme('unknown-theme');
                expect(result.theme).toBe('light');
                expect(consoleWarnSpy).toHaveBeenCalledWith(
                    'Unknown theme preset "unknown-theme", falling back to "light"'
                );
            });

            it('falls back to light for empty string', () => {
                const result = parseTheme('');
                expect(result.theme).toBe('light');
            });

            it('falls back to light for invalid preset "custom"', () => {
                const result = parseTheme('custom');
                expect(result.theme).toBe('light');
                expect(consoleWarnSpy).toHaveBeenCalledWith(
                    'Unknown theme preset "custom", falling back to "light"'
                );
            });
        });

        describe('theme colors parsing from JSON string', () => {
            it('parses valid JSON string to theme colors', () => {
                const customColors = {
                    boundary: { fill: '#fff', stroke: '#000', strokeWidth: 2 },
                    node: { fill: '#eee', stroke: '#111', strokeWidth: 1 },
                    iface: { fill: '#ddd', stroke: '#222', strokeWidth: 1 },
                    highlight: { fill: '#ff0', stroke: '#f00', strokeWidth: 2 }
                };
                const result = parseTheme('light', JSON.stringify(customColors));
                expect(result.theme).toBe('light');
                expect(result.themeColors).toEqual(customColors);
            });

            it('parses theme colors with optional node type properties', () => {
                const customColors = {
                    boundary: { fill: '#fff', stroke: '#000', strokeWidth: 2 },
                    node: { fill: '#eee', stroke: '#111', strokeWidth: 1 },
                    iface: { fill: '#ddd', stroke: '#222', strokeWidth: 1 },
                    highlight: { fill: '#ff0', stroke: '#f00', strokeWidth: 2 },
                    actor: { fill: '#00f', stroke: '#000', strokeWidth: 2 },
                    database: { fill: '#0f0', stroke: '#000', strokeWidth: 2 }
                };
                const result = parseTheme('dark', JSON.stringify(customColors));
                expect(result.theme).toBe('dark');
                expect(result.themeColors).toEqual(customColors);
            });

            it('handles whitespace in JSON string', () => {
                const jsonString = `
                {
                    "boundary": { "fill": "#fff", "stroke": "#000", "strokeWidth": 2 },
                    "node": { "fill": "#eee", "stroke": "#111", "strokeWidth": 1 },
                    "iface": { "fill": "#ddd", "stroke": "#222", "strokeWidth": 1 },
                    "highlight": { "fill": "#ff0", "stroke": "#f00", "strokeWidth": 2 }
                }
                `;
                const result = parseTheme('light', jsonString);
                expect(result.theme).toBe('light');
                expect(result.themeColors).toBeDefined();
                expect(result.themeColors?.boundary.fill).toBe('#fff');
            });

            it('rejects invalid JSON with warning', () => {
                const result = parseTheme('light', '{invalid json}');
                expect(result.theme).toBe('light');
                expect(result.themeColors).toBeUndefined();
                expect(consoleWarnSpy).toHaveBeenCalledWith(
                    expect.stringContaining('Failed to parse theme-colors JSON:')
                );
            });

            it('rejects theme colors missing boundary property', () => {
                const incompleteColors = {
                    node: { fill: '#eee', stroke: '#111', strokeWidth: 1 },
                    iface: { fill: '#ddd', stroke: '#222', strokeWidth: 1 },
                    highlight: { fill: '#ff0', stroke: '#f00', strokeWidth: 2 }
                };
                const result = parseTheme('light', JSON.stringify(incompleteColors));
                expect(result.theme).toBe('light');
                expect(result.themeColors).toBeUndefined();
                expect(consoleWarnSpy).toHaveBeenCalledWith(
                    'Custom theme-colors missing required properties (boundary, node, iface, highlight), using preset theme'
                );
            });

            it('rejects theme colors missing node property', () => {
                const incompleteColors = {
                    boundary: { fill: '#fff', stroke: '#000', strokeWidth: 2 },
                    iface: { fill: '#ddd', stroke: '#222', strokeWidth: 1 },
                    highlight: { fill: '#ff0', stroke: '#f00', strokeWidth: 2 }
                };
                const result = parseTheme('light', JSON.stringify(incompleteColors));
                expect(result.themeColors).toBeUndefined();
                expect(consoleWarnSpy).toHaveBeenCalledWith(
                    'Custom theme-colors missing required properties (boundary, node, iface, highlight), using preset theme'
                );
            });

            it('rejects theme colors missing iface property', () => {
                const incompleteColors = {
                    boundary: { fill: '#fff', stroke: '#000', strokeWidth: 2 },
                    node: { fill: '#eee', stroke: '#111', strokeWidth: 1 },
                    highlight: { fill: '#ff0', stroke: '#f00', strokeWidth: 2 }
                };
                const result = parseTheme('light', JSON.stringify(incompleteColors));
                expect(result.themeColors).toBeUndefined();
                expect(consoleWarnSpy).toHaveBeenCalledWith(
                    'Custom theme-colors missing required properties (boundary, node, iface, highlight), using preset theme'
                );
            });

            it('rejects theme colors missing highlight property', () => {
                const incompleteColors = {
                    boundary: { fill: '#fff', stroke: '#000', strokeWidth: 2 },
                    node: { fill: '#eee', stroke: '#111', strokeWidth: 1 },
                    iface: { fill: '#ddd', stroke: '#222', strokeWidth: 1 }
                };
                const result = parseTheme('light', JSON.stringify(incompleteColors));
                expect(result.themeColors).toBeUndefined();
                expect(consoleWarnSpy).toHaveBeenCalledWith(
                    'Custom theme-colors missing required properties (boundary, node, iface, highlight), using preset theme'
                );
            });

            it('accepts theme colors with all required properties even if optional ones missing', () => {
                const minimalColors = {
                    boundary: { fill: '#fff', stroke: '#000', strokeWidth: 2 },
                    node: { fill: '#eee', stroke: '#111', strokeWidth: 1 },
                    iface: { fill: '#ddd', stroke: '#222', strokeWidth: 1 },
                    highlight: { fill: '#ff0', stroke: '#f00', strokeWidth: 2 }
                };
                const result = parseTheme('light', JSON.stringify(minimalColors));
                expect(result.themeColors).toEqual(minimalColors);
                expect(consoleWarnSpy).not.toHaveBeenCalled();
            });
        });

        describe('theme colors parsing from object', () => {
            it('accepts theme colors object directly', () => {
                const customColors: ThemeColors = {
                    boundary: { fill: '#fff', stroke: '#000', strokeWidth: 2 },
                    node: { fill: '#eee', stroke: '#111', strokeWidth: 1 },
                    iface: { fill: '#ddd', stroke: '#222', strokeWidth: 1 },
                    highlight: { fill: '#ff0', stroke: '#f00', strokeWidth: 2 }
                };
                const result = parseTheme('light', customColors);
                expect(result.theme).toBe('light');
                expect(result.themeColors).toEqual(customColors);
            });

            it('validates object has required properties', () => {
                const incompleteColors = {
                    boundary: { fill: '#fff', stroke: '#000', strokeWidth: 2 },
                    node: { fill: '#eee', stroke: '#111', strokeWidth: 1 }
                    // missing iface and highlight
                } as unknown as ThemeColors;
                const result = parseTheme('dark', incompleteColors);
                expect(result.themeColors).toBeUndefined();
                expect(consoleWarnSpy).toHaveBeenCalledWith(
                    'Custom theme-colors missing required properties (boundary, node, iface, highlight), using preset theme'
                );
            });
        });

        describe('combined theme preset and custom colors', () => {
            it('returns both theme preset and custom colors', () => {
                const customColors = {
                    boundary: { fill: '#fff', stroke: '#000', strokeWidth: 2 },
                    node: { fill: '#eee', stroke: '#111', strokeWidth: 1 },
                    iface: { fill: '#ddd', stroke: '#222', strokeWidth: 1 },
                    highlight: { fill: '#ff0', stroke: '#f00', strokeWidth: 2 }
                };
                const result = parseTheme('dark', JSON.stringify(customColors));
                expect(result.theme).toBe('dark');
                expect(result.themeColors).toEqual(customColors);
            });

            it('combines high-contrast preset with custom colors', () => {
                const customColors = {
                    boundary: { fill: '#fff', stroke: '#000', strokeWidth: 3 },
                    node: { fill: '#fff', stroke: '#000', strokeWidth: 2 },
                    iface: { fill: '#eee', stroke: '#000', strokeWidth: 2 },
                    highlight: { fill: '#ff0', stroke: '#000', strokeWidth: 3 }
                };
                const result = parseTheme('high-contrast', JSON.stringify(customColors));
                expect(result.theme).toBe('high-contrast');
                expect(result.themeColors).toEqual(customColors);
            });
        });

        describe('edge cases', () => {
            it('handles empty string for theme colors', () => {
                const result = parseTheme('light', '');
                expect(result.theme).toBe('light');
                expect(result.themeColors).toBeUndefined();
            });

            it('handles null as theme option', () => {
                const result = parseTheme(null as unknown as string);
                expect(result.theme).toBe('light');
            });

            it('handles undefined for both parameters', () => {
                const result = parseTheme(undefined, undefined);
                expect(result.theme).toBe('light');
                expect(result.themeColors).toBeUndefined();
            });

            it('handles malformed JSON with nested error', () => {
                const result = parseTheme('dark', '{"boundary":}');
                expect(result.themeColors).toBeUndefined();
                expect(consoleWarnSpy).toHaveBeenCalledWith(
                    expect.stringContaining('Failed to parse theme-colors JSON:')
                );
            });
        });
    });

    describe('resolveThemeColors', () => {
        describe('preset themes without custom colors', () => {
            it('returns light theme colors when no custom colors provided', () => {
                const result = resolveThemeColors('light');
                expect(result).toEqual(lightTheme);
            });

            it('returns dark theme colors when no custom colors provided', () => {
                const result = resolveThemeColors('dark');
                expect(result).toEqual(darkTheme);
            });

            it('returns high-contrast theme colors when no custom colors provided', () => {
                const result = resolveThemeColors('high-contrast');
                expect(result).toEqual(highContrastTheme);
            });

            it('returns light theme when undefined custom colors', () => {
                const result = resolveThemeColors('light', undefined);
                expect(result).toEqual(lightTheme);
            });
        });

        describe('merging custom colors with preset themes', () => {
            it('merges custom colors with light theme, filling in missing properties', () => {
                const customColors: ThemeColors = {
                    boundary: { fill: '#custom', stroke: '#custom', strokeWidth: 5 },
                    node: { fill: '#node', stroke: '#node', strokeWidth: 3 },
                    iface: { fill: '#iface', stroke: '#iface', strokeWidth: 2 },
                    highlight: { fill: '#highlight', stroke: '#highlight', strokeWidth: 4 }
                    // Missing optional node type properties
                };
                const result = resolveThemeColors('light', customColors);

                // Custom properties should be preserved
                expect(result.boundary).toEqual(customColors.boundary);
                expect(result.node).toEqual(customColors.node);
                expect(result.iface).toEqual(customColors.iface);
                expect(result.highlight).toEqual(customColors.highlight);

                // Missing properties should be filled from light theme
                expect(result.actor).toEqual(lightTheme.actor);
                expect(result.database).toEqual(lightTheme.database);
                expect(result.webclient).toEqual(lightTheme.webclient);
                expect(result.service).toEqual(lightTheme.service);
                expect(result.messagebus).toEqual(lightTheme.messagebus);
                expect(result.system).toEqual(lightTheme.system);
            });

            it('merges custom colors with dark theme', () => {
                const customColors: ThemeColors = {
                    boundary: { fill: '#111', stroke: '#fff', strokeWidth: 2 },
                    node: { fill: '#222', stroke: '#eee', strokeWidth: 1 },
                    iface: { fill: '#333', stroke: '#ddd', strokeWidth: 1 },
                    highlight: { fill: '#f00', stroke: '#ff0', strokeWidth: 2 },
                    actor: { fill: '#00f', stroke: '#0ff', strokeWidth: 2 }
                    // Some optional properties provided
                };
                const result = resolveThemeColors('dark', customColors);

                expect(result.boundary).toEqual(customColors.boundary);
                expect(result.actor).toEqual(customColors.actor);
                // Missing properties from dark theme
                expect(result.database).toEqual(darkTheme.database);
                expect(result.webclient).toEqual(darkTheme.webclient);
            });

            it('merges all custom properties including node types with high-contrast theme', () => {
                const customColors: ThemeColors = {
                    boundary: { fill: '#fff', stroke: '#000', strokeWidth: 5 },
                    node: { fill: '#fff', stroke: '#000', strokeWidth: 3 },
                    iface: { fill: '#eee', stroke: '#000', strokeWidth: 3 },
                    highlight: { fill: '#ff0', stroke: '#000', strokeWidth: 5 },
                    actor: { fill: '#aaf', stroke: '#00f', strokeWidth: 4 },
                    database: { fill: '#faa', stroke: '#f00', strokeWidth: 4 },
                    webclient: { fill: '#faf', stroke: '#f0f', strokeWidth: 4 },
                    service: { fill: '#afa', stroke: '#0f0', strokeWidth: 4 },
                    messagebus: { fill: '#ffa', stroke: '#ff0', strokeWidth: 4 },
                    system: { fill: '#aff', stroke: '#0ff', strokeWidth: 4 }
                };
                const result = resolveThemeColors('high-contrast', customColors);

                // All custom properties should be used
                expect(result).toEqual(customColors);
            });

            it('uses preset fallback for undefined custom property', () => {
                const customColors: Partial<ThemeColors> = {
                    boundary: { fill: '#custom', stroke: '#custom', strokeWidth: 2 },
                    node: { fill: '#custom', stroke: '#custom', strokeWidth: 1 },
                    iface: { fill: '#custom', stroke: '#custom', strokeWidth: 1 },
                    highlight: { fill: '#custom', stroke: '#custom', strokeWidth: 2 },
                    actor: undefined // Explicitly undefined
                };
                const result = resolveThemeColors('light', customColors as ThemeColors);

                expect(result.boundary.fill).toBe('#custom');
                expect(result.actor).toEqual(lightTheme.actor);
            });

            it('preserves all strokeDasharray and fontSize properties from custom colors', () => {
                const customColors: ThemeColors = {
                    boundary: { fill: '#fff', stroke: '#000', strokeWidth: 2, strokeDasharray: '10 5' },
                    node: { fill: '#eee', stroke: '#111', strokeWidth: 1 },
                    iface: { fill: '#ddd', stroke: '#222', strokeWidth: 1, fontSize: '12px' },
                    highlight: { fill: '#ff0', stroke: '#f00', strokeWidth: 2 }
                };
                const result = resolveThemeColors('light', customColors);

                expect(result.boundary.strokeDasharray).toBe('10 5');
                expect(result.iface.fontSize).toBe('12px');
            });
        });

        describe('complete custom color override', () => {
            it('uses all custom colors when complete theme provided', () => {
                const completeCustomTheme: ThemeColors = {
                    boundary: { fill: '#010', stroke: '#101', strokeWidth: 1 },
                    node: { fill: '#020', stroke: '#202', strokeWidth: 1 },
                    iface: { fill: '#030', stroke: '#303', strokeWidth: 1 },
                    highlight: { fill: '#040', stroke: '#404', strokeWidth: 1 },
                    actor: { fill: '#050', stroke: '#505', strokeWidth: 1 },
                    database: { fill: '#060', stroke: '#606', strokeWidth: 1 },
                    webclient: { fill: '#070', stroke: '#707', strokeWidth: 1 },
                    service: { fill: '#080', stroke: '#808', strokeWidth: 1 },
                    messagebus: { fill: '#090', stroke: '#909', strokeWidth: 1 },
                    system: { fill: '#0a0', stroke: '#a0a', strokeWidth: 1 }
                };
                const result = resolveThemeColors('dark', completeCustomTheme);

                // Should use all custom colors, no fallback to dark theme
                expect(result).toEqual(completeCustomTheme);
            });
        });

        describe('integration with different presets', () => {
            it('merges same custom partial with each preset differently', () => {
                const partialCustom: ThemeColors = {
                    boundary: { fill: '#custom', stroke: '#custom', strokeWidth: 2 },
                    node: { fill: '#custom', stroke: '#custom', strokeWidth: 1 },
                    iface: { fill: '#custom', stroke: '#custom', strokeWidth: 1 },
                    highlight: { fill: '#custom', stroke: '#custom', strokeWidth: 2 }
                };

                const lightResult = resolveThemeColors('light', partialCustom);
                const darkResult = resolveThemeColors('dark', partialCustom);
                const hcResult = resolveThemeColors('high-contrast', partialCustom);

                // Custom parts should be same
                expect(lightResult.boundary).toEqual(partialCustom.boundary);
                expect(darkResult.boundary).toEqual(partialCustom.boundary);
                expect(hcResult.boundary).toEqual(partialCustom.boundary);

                // But filled parts should differ based on preset
                expect(lightResult.actor).toEqual(lightTheme.actor);
                expect(darkResult.actor).toEqual(darkTheme.actor);
                expect(hcResult.actor).toEqual(highContrastTheme.actor);

                expect(lightResult.actor).not.toEqual(darkResult.actor);
                expect(darkResult.actor).not.toEqual(hcResult.actor);
            });
        });
    });
});
