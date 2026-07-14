// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import React, { useEffect, useState } from 'react';
import type { CalmDiagramProps } from './types.js';

export type { CalmDiagramBundle, CalmDiagramProps } from './types.js';

function isRemoteUrl(value: string | undefined): value is string {
  return typeof value === 'string' && /^https?:\/\//.test(value);
}

/**
 * CALM architecture diagram for Docusaurus MDX.
 *
 * Build/SSR: emits the pre-rendered static SVG (light + dark variants,
 * toggled by html[data-theme] CSS) so diagrams work without JavaScript.
 * Client: lazily loads the @calmstudio/diagram web component and swaps it
 * in for zoom/pan/tooltips/flow animation, unless interactive={false}.
 */
export function CalmDiagram(props: CalmDiagramProps): React.ReactElement | null {
  const { src, data, theme, flow, interactive = true, __bundle } = props;
  const [upgraded, setUpgraded] = useState(false);
  const [domTheme, setDomTheme] = useState<'light' | 'dark'>('light');

  const architecture = __bundle ? __bundle.architecture : data;
  const remote = !architecture && isRemoteUrl(src);
  const hasInput = Boolean(architecture) || remote;

  // Lazily load the interactive web component on the client.
  useEffect(() => {
    if (!interactive || !hasInput) return;
    let cancelled = false;
    import('@calmstudio/diagram')
      .then(() => {
        if (!cancelled) setUpgraded(true);
      })
      .catch((err: unknown) => {
        // Static SVG stays in place — degradation is graceful by construction.
        console.error('[@calmstudio/docusaurus-plugin] failed to load interactive renderer:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [interactive, hasInput]);

  // Follow the Docusaurus color mode via html[data-theme] (no dependency on
  // @docusaurus/theme-common, keeps SSR clean).
  useEffect(() => {
    const root = document.documentElement;
    const update = () => setDomTheme(root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  if (!hasInput) {
    console.error(
      '[@calmstudio/docusaurus-plugin] <CalmDiagram> needs `src` (relative .calm.json path or URL) or `data`.'
    );
    if (process.env.NODE_ENV !== 'production') {
      return (
        <div className="calm-diagram calm-diagram-error">
          CalmDiagram: no architecture provided — pass `src` or `data`.
        </div>
      );
    }
    return null;
  }

  if (upgraded) {
    const effectiveTheme = theme ?? domTheme;
    const height = __bundle ? __bundle.size.height : 480;
    return (
      <div className="calm-diagram" style={{ width: '100%', height }}>
        <calm-diagram
          data={architecture ? JSON.stringify(architecture) : undefined}
          src={remote ? src : undefined}
          theme={effectiveTheme}
          flow={flow || undefined}
        />
      </div>
    );
  }

  if (__bundle) {
    if (theme) {
      return (
        <div
          className="calm-diagram"
          dangerouslySetInnerHTML={{ __html: __bundle.svg[theme] }}
        />
      );
    }
    return (
      <div className="calm-diagram">
        <div
          className="calm-diagram-static-light"
          dangerouslySetInnerHTML={{ __html: __bundle.svg.light }}
        />
        <div
          className="calm-diagram-static-dark"
          dangerouslySetInnerHTML={{ __html: __bundle.svg.dark }}
        />
      </div>
    );
  }

  // Inline data or remote URL: no build-time SVG exists — placeholder until hydration.
  return (
    <div
      className="calm-diagram calm-diagram-placeholder"
      style={{ minHeight: 200 }}
      aria-label="CALM diagram loads after page hydration"
    />
  );
}
