// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import type * as React from 'react';

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
  /** Set false to keep the static SVG and skip loading the interactive web component. */
  interactive?: boolean;
  /** Injected by the remark plugin — do not set manually. */
  __bundle?: CalmDiagramBundle;
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'calm-diagram': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        data?: string;
        theme?: string;
        flow?: string;
      };
    }
  }
}
