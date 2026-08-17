// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { renderELKDiagram } from '@calmstudio/diagram/render';

export interface CalmSvgBundle {
  svg: { light: string; dark: string };
  size: { width: number; height: number };
}

const SVG_WIDTH_RE = /\bwidth="(\d+(?:\.\d+)?)"/;
const SVG_HEIGHT_RE = /\bheight="(\d+(?:\.\d+)?)"/;

const FALLBACK_SIZE = { width: 800, height: 480 };

/** Read width/height from the SVG root's open tag, or null if either is absent. */
function extractSvgSize(svg: string): { width: number; height: number } | null {
  const open = svg.indexOf('<svg');
  if (open === -1) return null;
  const close = svg.indexOf('>', open);
  const tag = svg.slice(open, close === -1 ? undefined : close);
  const width = SVG_WIDTH_RE.exec(tag);
  const height = SVG_HEIGHT_RE.exec(tag);
  return width && height ? { width: Number(width[1]), height: Number(height[1]) } : null;
}

/**
 * Render a CALM architecture to light + dark SVG strings at build time,
 * and extract the diagram's intrinsic pixel size from the SVG root.
 */
export async function prerenderCalmSvg(architecture: unknown): Promise<CalmSvgBundle> {
  const [light, dark] = await Promise.all([
    renderELKDiagram(architecture, { theme: 'light' }),
    renderELKDiagram(architecture, { theme: 'dark' }),
  ]);
  const size = extractSvgSize(light) ?? FALLBACK_SIZE;
  return { svg: { light, dark }, size };
}
