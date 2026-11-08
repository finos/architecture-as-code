// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import React, { useEffect, useId, useMemo, useState, useSyncExternalStore } from 'react';
import type { CalmArchitecture } from '@finos/calm-diagram';
import { InteractiveDiagram } from './InteractiveDiagram.js';
import type { CalmDiagramProps } from './types.js';

export type { CalmDiagramBundle, CalmDiagramProps } from './types.js';

const CLIENT_HEIGHT = 480;

const subscribeToNothing = () => () => undefined;

/** False on the server and during hydration, so the first client render matches the server HTML. */
function useHydrated(): boolean {
  return useSyncExternalStore(subscribeToNothing, () => true, () => false);
}

interface ClientRender {
  key: string;
  svg?: string;
  error?: string;
}

function isRemoteUrl(value: string | undefined): value is string {
  return typeof value === 'string' && /^https?:\/\//.test(value);
}

async function loadArchitecture(architecture: unknown, remoteSrc: string | undefined): Promise<unknown> {
  if (architecture) return architecture;
  const response = await fetch(remoteSrc as string, { credentials: 'omit' });
  if (!response.ok) {
    throw new Error(`Failed to load ${remoteSrc}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/**
 * CALM architecture diagram for Docusaurus MDX.
 *
 * Build/SSR: emits the pre-rendered static SVG (light + dark variants,
 * toggled by html[data-theme] CSS) so diagrams work without JavaScript.
 * Client: adds zoom, pan and node tooltips, unless interactive={false}.
 * Inline `data`, a URL `src`, `flow` and `containers="edges"` have no
 * build-time SVG, so the client renders them with @finos/calm-diagram.
 */
export function CalmDiagram(props: CalmDiagramProps): React.ReactElement | null {
  const { src, data, theme, flow, containers, interactive = true, __bundle } = props;
  const hydrated = useHydrated();
  // Unique on the page, so that the flow path ids of two diagrams do not collide.
  const idPrefix = `calm${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [domTheme, setDomTheme] = useState<'light' | 'dark'>('light');
  const [clientRender, setClientRender] = useState<ClientRender | null>(null);

  const architecture = __bundle ? __bundle.architecture : data;
  const remote = !architecture && isRemoteUrl(src);
  const hasInput = Boolean(architecture) || remote;
  const effectiveTheme = theme ?? domTheme;
  const needsClientRender = !__bundle || Boolean(flow) || containers === 'edges';
  // Inline `data` is a new object on each MDX render, so compare its content.
  const architectureKey = useMemo(() => (architecture ? JSON.stringify(architecture) : ''), [architecture]);
  const renderKey = JSON.stringify([architectureKey, remote ? src : '', effectiveTheme, flow ?? '', containers ?? '']);

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

  useEffect(() => {
    if (!interactive || !hasInput || !needsClientRender) return;
    let cancelled = false;
    (async () => {
      const [arch, { renderELKDiagram }] = await Promise.all([
        loadArchitecture(architectureKey ? JSON.parse(architectureKey) : undefined, remote ? src : undefined),
        import('@finos/calm-diagram'),
      ]);
      const svg = await renderELKDiagram(arch as CalmArchitecture, {
        theme: effectiveTheme,
        idPrefix,
        ...(flow ? { flow } : {}),
        ...(containers ? { containers } : {}),
      });
      if (!cancelled) setClientRender({ key: renderKey, svg });
    })().catch((err: unknown) => {
      // A pre-rendered SVG stays in place, so only diagrams without one show the error.
      console.error('[@finos/calm-docusaurus-plugin] failed to render diagram:', err);
      if (!cancelled) setClientRender({ key: renderKey, error: err instanceof Error ? err.message : String(err) });
    });
    return () => {
      cancelled = true;
    };
  }, [interactive, hasInput, needsClientRender, renderKey, architectureKey, remote, src, effectiveTheme, flow, containers, idPrefix]);

  // Keep the last SVG on screen while a new one renders, but show only the current error.
  const clientSvg = clientRender?.svg;
  const clientError = clientRender?.key === renderKey ? clientRender.error : undefined;

  if (!hasInput) {
    console.error(
      '[@finos/calm-docusaurus-plugin] <CalmDiagram> needs `src` (relative .calm.json path or URL) or `data`.'
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

  if (hydrated && interactive) {
    const svg = needsClientRender ? clientSvg : __bundle?.svg[effectiveTheme];
    if (svg) {
      return <InteractiveDiagram svg={svg} height={__bundle ? __bundle.size.height : CLIENT_HEIGHT} />;
    }
    if (clientError && !__bundle) {
      return <div className="calm-diagram calm-diagram-error">CalmDiagram: {clientError}</div>;
    }
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

  // Inline data or remote URL: no build-time SVG exists, so show a placeholder until the client renders it.
  return (
    <div
      className="calm-diagram calm-diagram-placeholder"
      style={{ minHeight: 200 }}
      aria-label="CALM diagram loads after page hydration"
    />
  );
}
