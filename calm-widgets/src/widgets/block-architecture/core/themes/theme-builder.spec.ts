import { describe, it, expect } from 'vitest';
import { buildThemeFrontMatter, buildThemeClassDefsString } from './theme-builder';
import { ThemeColors } from '../../types';

describe('buildThemeFrontMatter', () => {
    it('should generate basic frontmatter with no base theme variables', () => {
        const theme: ThemeColors = {
            boundary: {
                fill: '#ffffff',
                stroke: '#000000',
                strokeWidth: 2,
            },
            node: {
                fill: '#e0e0e0',
                stroke: '#000000',
                strokeWidth: 2,
            },
            iface: {
                fill: '#ffd700',
                stroke: '#000000',
                strokeWidth: 2,
            },
            highlight: {
                fill: '#ff0000',
                stroke: '#000000',
                strokeWidth: 3,
            },
        };

        const result = buildThemeFrontMatter(theme);

        expect(result).toContain('---');
        expect(result).toContain('config:');
        expect(result).toContain('  theme: base');
        expect(result).toContain('  themeVariables:');
        expect(result).toContain("    fontFamily: -apple-system, BlinkMacSystemFont, 'Segoe WPC', 'Segoe UI', system-ui, 'Ubuntu', sans-serif");
        expect(result).toMatch(/^---\n.*\n---$/s);
    });

    it('should include darkMode when specified', () => {
        const theme: ThemeColors = {
            boundary: {
                fill: '#ffffff',
                stroke: '#000000',
                strokeWidth: 2,
            },
            node: {
                fill: '#e0e0e0',
                stroke: '#000000',
                strokeWidth: 2,
            },
            iface: {
                fill: '#ffd700',
                stroke: '#000000',
                strokeWidth: 2,
            },
            highlight: {
                fill: '#ff0000',
                stroke: '#000000',
                strokeWidth: 3,
            },
            base: {
                darkMode: true,
            },
        };

        const result = buildThemeFrontMatter(theme);

        expect(result).toContain('    darkMode: true');
    });

    it('should include fontSize when specified', () => {
        const theme: ThemeColors = {
            boundary: {
                fill: '#ffffff',
                stroke: '#000000',
                strokeWidth: 2,
            },
            node: {
                fill: '#e0e0e0',
                stroke: '#000000',
                strokeWidth: 2,
            },
            iface: {
                fill: '#ffd700',
                stroke: '#000000',
                strokeWidth: 2,
            },
            highlight: {
                fill: '#ff0000',
                stroke: '#000000',
                strokeWidth: 3,
            },
            base: {
                fontSize: '16px',
            },
        };

        const result = buildThemeFrontMatter(theme);

        expect(result).toContain('    fontSize: 16px');
    });

    it('should include edgeLabelBackground when specified', () => {
        const theme: ThemeColors = {
            boundary: {
                fill: '#ffffff',
                stroke: '#000000',
                strokeWidth: 2,
            },
            node: {
                fill: '#e0e0e0',
                stroke: '#000000',
                strokeWidth: 2,
            },
            iface: {
                fill: '#ffd700',
                stroke: '#000000',
                strokeWidth: 2,
            },
            highlight: {
                fill: '#ff0000',
                stroke: '#000000',
                strokeWidth: 3,
            },
            base: {
                edgeLabelBackground: '#f0f0f0',
            },
        };

        const result = buildThemeFrontMatter(theme);

        expect(result).toContain("    edgeLabelBackground: '#f0f0f0'");
    });

    it('should include lineColor when specified', () => {
        const theme: ThemeColors = {
            boundary: {
                fill: '#ffffff',
                stroke: '#000000',
                strokeWidth: 2,
            },
            node: {
                fill: '#e0e0e0',
                stroke: '#000000',
                strokeWidth: 2,
            },
            iface: {
                fill: '#ffd700',
                stroke: '#000000',
                strokeWidth: 2,
            },
            highlight: {
                fill: '#ff0000',
                stroke: '#000000',
                strokeWidth: 3,
            },
            base: {
                lineColor: '#333333',
            },
        };

        const result = buildThemeFrontMatter(theme);

        expect(result).toContain("    lineColor: '#333333'");
    });

    it('should include all base theme variables when specified', () => {
        const theme: ThemeColors = {
            boundary: {
                fill: '#ffffff',
                stroke: '#000000',
                strokeWidth: 2,
            },
            node: {
                fill: '#e0e0e0',
                stroke: '#000000',
                strokeWidth: 2,
            },
            iface: {
                fill: '#ffd700',
                stroke: '#000000',
                strokeWidth: 2,
            },
            highlight: {
                fill: '#ff0000',
                stroke: '#000000',
                strokeWidth: 3,
            },
            base: {
                darkMode: false,
                fontSize: '14px',
                edgeLabelBackground: '#ffffff',
                lineColor: '#000000',
            },
        };

        const result = buildThemeFrontMatter(theme);

        expect(result).toContain('    darkMode: false');
        expect(result).toContain('    fontSize: 14px');
        expect(result).toContain("    edgeLabelBackground: '#ffffff'");
        expect(result).toContain("    lineColor: '#000000'");
    });

    it('should return valid YAML format', () => {
        const theme: ThemeColors = {
            boundary: {
                fill: '#ffffff',
                stroke: '#000000',
                strokeWidth: 2,
            },
            node: {
                fill: '#e0e0e0',
                stroke: '#000000',
                strokeWidth: 2,
            },
            iface: {
                fill: '#ffd700',
                stroke: '#000000',
                strokeWidth: 2,
            },
            highlight: {
                fill: '#ff0000',
                stroke: '#000000',
                strokeWidth: 3,
            },
            base: {
                darkMode: true,
                fontSize: '16px',
            },
        };

        const result = buildThemeFrontMatter(theme);
        const lines = result.split('\n');

        expect(lines[0]).toBe('---');
        expect(lines[lines.length - 1]).toBe('---');
        expect(lines[1]).toBe('config:');
        expect(lines[2]).toBe('  theme: base');
        expect(lines[3]).toBe('  themeVariables:');
    });

    it('should handle empty base object', () => {
        const theme: ThemeColors = {
            boundary: {
                fill: '#ffffff',
                stroke: '#000000',
                strokeWidth: 2,
            },
            node: {
                fill: '#e0e0e0',
                stroke: '#000000',
                strokeWidth: 2,
            },
            iface: {
                fill: '#ffd700',
                stroke: '#000000',
                strokeWidth: 2,
            },
            highlight: {
                fill: '#ff0000',
                stroke: '#000000',
                strokeWidth: 3,
            },
            base: {},
        };

        const result = buildThemeFrontMatter(theme);

        expect(result).toContain('---');
        expect(result).toContain('config:');
        expect(result).toContain('  theme: base');
        expect(result).toContain('  themeVariables:');
        expect(result).not.toContain('darkMode');
        expect(result).not.toContain('fontSize');
        expect(result).not.toContain('edgeLabelBackground');
        expect(result).not.toContain('lineColor');
    });
});

describe('buildThemeClassDefsString', () => {
    it('should generate basic classDef statements', () => {
        const theme: ThemeColors = {
            boundary: {
                fill: '#ffffff',
                stroke: '#000000',
                strokeWidth: 2,
            },
            node: {
                fill: '#e0e0e0',
                stroke: '#000000',
                strokeWidth: 2,
            },
            iface: {
                fill: '#ffd700',
                stroke: '#000000',
                strokeWidth: 2,
            },
            highlight: {
                fill: '#ff0000',
                stroke: '#000000',
                strokeWidth: 3,
            },
        };

        const result = buildThemeClassDefsString(theme, false);

        expect(result).toContain('classDef boundary');
        expect(result).toContain('classDef node');
        expect(result).toContain('classDef iface');
        expect(result).toContain('classDef highlight');
    });

    it('should not include node type styles when renderNodeTypeShapes is false', () => {
        const theme: ThemeColors = {
            boundary: {
                fill: '#ffffff',
                stroke: '#000000',
                strokeWidth: 2,
            },
            node: {
                fill: '#e0e0e0',
                stroke: '#000000',
                strokeWidth: 2,
            },
            iface: {
                fill: '#ffd700',
                stroke: '#000000',
                strokeWidth: 2,
            },
            highlight: {
                fill: '#ff0000',
                stroke: '#000000',
                strokeWidth: 3,
            },
            actor: {
                fill: '#aaffaa',
                stroke: '#000000',
                strokeWidth: 2,
            },
            database: {
                fill: '#aaaaff',
                stroke: '#000000',
                strokeWidth: 2,
            },
        };

        const result = buildThemeClassDefsString(theme, false);

        expect(result).not.toContain('classDef actor');
        expect(result).not.toContain('classDef database');
    });

    it('should include node type styles when renderNodeTypeShapes is true', () => {
        const theme: ThemeColors = {
            boundary: {
                fill: '#ffffff',
                stroke: '#000000',
                strokeWidth: 2,
            },
            node: {
                fill: '#e0e0e0',
                stroke: '#000000',
                strokeWidth: 2,
            },
            iface: {
                fill: '#ffd700',
                stroke: '#000000',
                strokeWidth: 2,
            },
            highlight: {
                fill: '#ff0000',
                stroke: '#000000',
                strokeWidth: 3,
            },
            actor: {
                fill: '#aaffaa',
                stroke: '#000000',
                strokeWidth: 2,
            },
            database: {
                fill: '#aaaaff',
                stroke: '#000000',
                strokeWidth: 2,
            },
            webclient: {
                fill: '#ffaaaa',
                stroke: '#000000',
                strokeWidth: 2,
            },
            service: {
                fill: '#aaffff',
                stroke: '#000000',
                strokeWidth: 2,
            },
            messagebus: {
                fill: '#ffaaff',
                stroke: '#000000',
                strokeWidth: 2,
            },
            system: {
                fill: '#ffffaa',
                stroke: '#000000',
                strokeWidth: 2,
            },
        };

        const result = buildThemeClassDefsString(theme, true);

        expect(result).toContain('classDef actor');
        expect(result).toContain('classDef database');
        expect(result).toContain('classDef webclient');
        expect(result).toContain('classDef service');
        expect(result).toContain('classDef messagebus');
        expect(result).toContain('classDef system');
    });

    it('should include strokeDasharray when specified', () => {
        const theme: ThemeColors = {
            boundary: {
                fill: '#ffffff',
                stroke: '#000000',
                strokeWidth: 2,
                strokeDasharray: '5 5',
            },
            node: {
                fill: '#e0e0e0',
                stroke: '#000000',
                strokeWidth: 2,
            },
            iface: {
                fill: '#ffd700',
                stroke: '#000000',
                strokeWidth: 2,
            },
            highlight: {
                fill: '#ff0000',
                stroke: '#000000',
                strokeWidth: 3,
            },
        };

        const result = buildThemeClassDefsString(theme, false);

        expect(result).toContain('stroke-dasharray: 5 5');
    });

    it('should include fontSize when specified', () => {
        const theme: ThemeColors = {
            boundary: {
                fill: '#ffffff',
                stroke: '#000000',
                strokeWidth: 2,
                fontSize: '14px',
            },
            node: {
                fill: '#e0e0e0',
                stroke: '#000000',
                strokeWidth: 2,
            },
            iface: {
                fill: '#ffd700',
                stroke: '#000000',
                strokeWidth: 2,
            },
            highlight: {
                fill: '#ff0000',
                stroke: '#000000',
                strokeWidth: 3,
            },
        };

        const result = buildThemeClassDefsString(theme, false);

        expect(result).toContain('font-size:14px');
    });

    it('should use default black color when not specified', () => {
        const theme: ThemeColors = {
            boundary: {
                fill: '#ffffff',
                stroke: '#000000',
                strokeWidth: 2,
            },
            node: {
                fill: '#e0e0e0',
                stroke: '#000000',
                strokeWidth: 2,
            },
            iface: {
                fill: '#ffd700',
                stroke: '#000000',
                strokeWidth: 2,
            },
            highlight: {
                fill: '#ff0000',
                stroke: '#000000',
                strokeWidth: 3,
            },
        };

        const result = buildThemeClassDefsString(theme, false);

        expect(result).toContain('color:#000000');
    });

    it('should use custom color when specified', () => {
        const theme: ThemeColors = {
            boundary: {
                fill: '#ffffff',
                stroke: '#000000',
                strokeWidth: 2,
                color: '#ff0000',
            },
            node: {
                fill: '#e0e0e0',
                stroke: '#000000',
                strokeWidth: 2,
            },
            iface: {
                fill: '#ffd700',
                stroke: '#000000',
                strokeWidth: 2,
            },
            highlight: {
                fill: '#ff0000',
                stroke: '#000000',
                strokeWidth: 3,
            },
        };

        const result = buildThemeClassDefsString(theme, false);

        expect(result).toContain('color:#ff0000');
    });
});
