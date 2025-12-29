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

    if (style.strokeWidth !== undefined) {
        parts.push(`stroke-width:${style.strokeWidth}px`);
    }

    if (style.fontSize) {
        parts.push(`font-size:${style.fontSize}`);
    }

    // Always set text color to black for visibility
    parts.push('color:#000');

    return `classDef ${className} ${parts.join(',')};`;
}

/**
 * Generate all classDef statements from a theme object
 */
export function buildThemeClassDefs(theme: ThemeColors, renderNodeTypeShapes: boolean): string[] {
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
