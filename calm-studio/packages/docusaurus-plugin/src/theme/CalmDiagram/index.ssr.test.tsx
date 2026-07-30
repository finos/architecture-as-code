// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { CalmDiagram } from './index.js';
import type { CalmDiagramBundle } from './types.js';

const bundle: CalmDiagramBundle = {
  architecture: { nodes: [], relationships: [] },
  svg: {
    light: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="150"><text>LIGHT</text></svg>',
    dark: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="150"><text>DARK</text></svg>',
  },
  size: { width: 300, height: 150 },
};

describe('CalmDiagram SSR', () => {
  it('renders both theme variants when no theme prop is set', () => {
    const html = renderToString(<CalmDiagram __bundle={bundle} />);
    expect(html).toContain('LIGHT');
    expect(html).toContain('DARK');
    expect(html).toContain('calm-diagram-static-light');
    expect(html).toContain('calm-diagram-static-dark');
  });

  it('renders only the forced variant when theme is set', () => {
    const html = renderToString(<CalmDiagram __bundle={bundle} theme="dark" />);
    expect(html).toContain('DARK');
    expect(html).not.toContain('LIGHT');
  });

  it('renders a placeholder for remote src (no bundle)', () => {
    const html = renderToString(<CalmDiagram src="https://example.com/a.calm.json" />);
    expect(html).toContain('calm-diagram-placeholder');
  });

  it('renders a placeholder for inline data (client-rendered mode)', () => {
    const html = renderToString(<CalmDiagram data={{ nodes: [] }} />);
    expect(html).toContain('calm-diagram-placeholder');
  });

  it('renders a visible error box when nothing is provided (non-production)', () => {
    const html = renderToString(<CalmDiagram />);
    expect(html).toContain('calm-diagram-error');
    expect(html).toContain('no architecture provided');
  });

  it('passes containers prop through to the custom element markup contract', () => {
    // SSR renders static SVG regardless; the containers prop must be accepted
    // by the component type and not break SSR output.
    const html = renderToString(<CalmDiagram __bundle={bundle} containers="edges" />);
    expect(html).toContain('calm-diagram-static-light');
  });
});
