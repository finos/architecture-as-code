import { ThemeClassStyle, ThemeColors } from '../../types';

/**
 * Convert a ThemeClassStyle to a Mermaid classDef string
 */
function styleToClassDef(className: string, style: ThemeClassStyle): string {
    const parts: string[] = [];

    parts.push(`fill:${style.fill}`);
    parts.push(`stroke:${style.stroke}`);

    if (style.strokeDasharray) {
        parts.push(`stroke-dasharray: ${style.strokeDasharray}`);
    }

    parts.push(`stroke-width:${style.strokeWidth}px`);

    if (style.fontSize) {
        parts.push(`font-size:${style.fontSize}`);
    }

    // Default to black text
    parts.push(`color:${style.color ?? "#000000"}`);

    return `classDef ${className} ${parts.join(',')};`;
}

/**
 * Generate all classDef statements from a theme object
 */
function buildThemeClassDefs(theme: ThemeColors, renderNodeTypeShapes: boolean): string[] {
    const classDefs: string[] = [];

    // Base styles (always included)
    classDefs.push(styleToClassDef('boundary', theme.boundary));
    classDefs.push(styleToClassDef('node', theme.node));
    classDefs.push(styleToClassDef('iface', theme.iface));
    classDefs.push(styleToClassDef('highlight', theme.highlight));

    // Node-type styles (conditional)
    if (renderNodeTypeShapes) {
        if (theme.actor) {
            classDefs.push(styleToClassDef('actor', theme.actor));
        }
        if (theme.database) {
            classDefs.push(styleToClassDef('database', theme.database));
        }
        if (theme.webclient) {
            classDefs.push(styleToClassDef('webclient', theme.webclient));
        }
        if (theme.service) {
            classDefs.push(styleToClassDef('service', theme.service));
        }
        if (theme.messagebus) {
            classDefs.push(styleToClassDef('messagebus', theme.messagebus));
        }
        if (theme.system) {
            classDefs.push(styleToClassDef('system', theme.system));
        }
    }

    return classDefs;
}

/**
 * Generate classDef statements as a single multi-line string
 */
export function buildThemeClassDefsString(theme: ThemeColors, renderNodeTypeShapes: boolean): string {
    return buildThemeClassDefs(theme, renderNodeTypeShapes).join('\n');
}

/**
 * Mermaid frontmatter to configure a theme
 */
export function buildThemeFrontMatter(theme: ThemeColors): string {
    const lines: string[] = [];
    lines.push('---');
    lines.push('config:');
    lines.push('  theme: base');
    lines.push('  themeVariables:');
    lines.push(`    fontFamily: -apple-system, BlinkMacSystemFont, 'Segoe WPC', 'Segoe UI', system-ui, 'Ubuntu', sans-serif`)
    if (theme.base !== undefined) {
        if (theme.base.darkMode !== undefined) {
            lines.push(`    darkMode: ${theme.base.darkMode}`);
        }
        if (theme.base.fontSize !== undefined) {
            lines.push(`    fontSize: ${theme.base.fontSize ?? '14px'}`);
        }
        if (theme.base.edgeLabelBackground !== undefined) {
            lines.push(`    edgeLabelBackground: '${theme.base.edgeLabelBackground}'`);
        }
        if (theme.base.lineColor !== undefined) {
            lines.push(`    lineColor: '${theme.base.lineColor}'`);
        }
    }
    lines.push('---');
    return lines.join('\n');
}