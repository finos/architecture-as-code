// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

export interface CalmDiagramBundle {
  architecture: unknown;
  svg: { light: string; dark: string };
  size: { width: number; height: number };
}

export interface CalmDiagramProps {
  /** Relative .calm.json path (rewritten to __bundle by the remark plugin) or http(s) URL (remote mode). */
  src?: string;
  /** Inline CALM architecture object. Client-rendered only (no build-time SVG). */
  data?: object;
  /** Force a theme; defaults to following the site's html[data-theme]. */
  theme?: 'light' | 'dark';
  /** Flow unique-id to highlight (applied after hydration). */
  flow?: string;
  /** Containment rendering: nested boxes (default) or legacy dashed edges. Non-default values apply client-side. */
  containers?: 'nested' | 'edges';
  /** Set false to keep the static SVG, with no zoom, pan or tooltips and no client-side rendering. */
  interactive?: boolean;
  /** Injected by the remark plugin — do not set manually. */
  __bundle?: CalmDiagramBundle;
}
