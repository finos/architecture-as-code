/**
 * Theme constants for ReactFlow graph visualization
 *
 * NOTE: The primary, accent, and accentLight colors are defined in src/index.css
 * as CSS variables. These hex values MUST be kept in sync with:
 *   --color-primary: #000063
 *   --color-accent: #007dff
 *   --color-accent-light: #b2d8f5
 *
 * We use hex values here instead of CSS variables because:
 * 1. ReactFlow and inline styles need direct color values
 * 2. We need to create transparent variants (e.g., `${color}20`)
 * 3. These are used in SVG markers which don't support CSS variables
 */

// Import the CSS variable values - keep these in sync with src/index.css
const CSS_COLORS = {
  primary: '#000063',      // --color-primary
  accent: '#007dff',       // --color-accent
  accentLight: '#b2d8f5',  // --color-accent-light
} as const;

export const THEME = {
  colors: {
    // Brand colors (from CSS variables in src/index.css)
    primary: CSS_COLORS.primary,
    accent: CSS_COLORS.accent,
    accentLight: CSS_COLORS.accentLight,

    // Background colors
    background: '#ffffff',
    backgroundSecondary: '#f8fafc',  // slate-50
    card: '#ffffff',

    // Text colors
    foreground: '#1e293b',     // slate-800
    muted: '#64748b',          // slate-500
    mutedForeground: '#94a3b8', // slate-400

    // Border colors
    border: '#e2e8f0',         // slate-200
    borderDark: '#cbd5e1',     // slate-300

    // Node type colors (blue-based palette)
    nodeTypes: {
      actor: '#8b5cf6',          // violet-500
      ecosystem: '#0ea5e9',      // sky-500
      system: '#3b82f6',         // blue-500
      service: '#06b6d4',        // cyan-500
      database: '#10b981',       // emerald-500
      network: '#f59e0b',        // amber-500
      ldap: '#a855f7',           // purple-500
      webclient: '#0891b2',      // cyan-600
      'data-asset': '#14b8a6',   // teal-500
      interface: '#d946ef',      // fuchsia-500
      'external-service': '#ec4899', // pink-500
      default: '#64748b',        // slate-500
    },

    // Risk level colors
    risk: {
      critical: '#dc2626',       // red-600
      high: '#ea580c',           // orange-600
      medium: '#ca8a04',         // yellow-600
      low: '#16a34a',            // green-600
    },

    // Status colors
    success: '#16a34a',          // green-600
    warning: '#ca8a04',          // yellow-600
    error: '#dc2626',            // red-600
    info: '#0284c7',             // sky-600

    // Edge colors
    edge: {
      default: '#94a3b8',        // slate-400
      selected: CSS_COLORS.accent,
      interacts: '#8b5cf6',      // violet-500
      backward: '#a855f7',       // purple-500
    },

    // Group/container colors
    group: {
      background: '#f8fafc',     // slate-50
      border: '#cbd5e1',         // slate-300
      label: '#64748b',          // slate-500
    },
  },

  // Shadow definitions
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  },
} as const;

/**
 * Get the color for a specific node type
 */
export function getNodeTypeColor(nodeType: string): string {
  const type = nodeType.toLowerCase();
  return THEME.colors.nodeTypes[type as keyof typeof THEME.colors.nodeTypes]
    || THEME.colors.nodeTypes.default;
}

/**
 * Get the color for a risk level
 */
export function getRiskLevelColor(riskLevel: string): string {
  const level = riskLevel.toLowerCase();
  return THEME.colors.risk[level as keyof typeof THEME.colors.risk]
    || THEME.colors.muted;
}
