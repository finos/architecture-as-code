/**
 * Application-wide constants
 * Centralizes magic numbers and configuration values used throughout the application
 */

/**
 * Graph layout constants
 * Used by ArchitectureGraph component for Dagre layout configuration
 */
export const GRAPH_LAYOUT = {
  /** Standard node width in pixels */
  NODE_WIDTH: 250,
  /** Standard node height in pixels */
  NODE_HEIGHT: 100,
  /** Default width for system container nodes */
  SYSTEM_NODE_DEFAULT_WIDTH: 300,
  /** Default height for system container nodes */
  SYSTEM_NODE_DEFAULT_HEIGHT: 200,
  /** Padding around nodes within system containers */
  SYSTEM_NODE_PADDING: 80,
  /** Horizontal spacing between ranks (left-to-right spacing) */
  RANK_SEPARATION: 200,
  /** Vertical spacing between nodes in the same rank */
  NODE_SEPARATION: 80,
  /** Horizontal spacing for edges */
  EDGE_SEPARATION: 30,
  /** Left/right margins for the graph */
  MARGIN_X: 50,
  /** Top/bottom margins for the graph */
  MARGIN_Y: 50,
  /** Rank separation for top-level layout (with system nodes) */
  TOP_LEVEL_RANK_SEPARATION: 250,
  /** Node separation for top-level layout */
  TOP_LEVEL_NODE_SEPARATION: 150,
  /** Edge separation for top-level layout */
  TOP_LEVEL_EDGE_SEPARATION: 50,
  /** Margins for top-level layout */
  TOP_LEVEL_MARGIN: 100,
} as const;

/**
 * File upload constraints
 * Used by JsonEditor component for file validation
 */
export const FILE_CONSTRAINTS = {
  /** Maximum allowed file size in bytes (10MB) */
  MAX_FILE_SIZE: 10 * 1024 * 1024,
} as const;

/**
 * Network request timeouts
 * Used for API calls and external resource fetching
 */
export const TIMEOUTS = {
  /** Default timeout for fetch requests in milliseconds (30 seconds) */
  FETCH_TIMEOUT: 30000,
  /** Duration to show editor decorations/highlights in milliseconds (3 seconds) */
  EDITOR_DECORATION_TIMEOUT: 3000,
} as const;

/**
 * UI animation and transition durations
 */
export const DURATIONS = {
  /** Standard transition duration in milliseconds */
  TRANSITION: 200,
} as const;
