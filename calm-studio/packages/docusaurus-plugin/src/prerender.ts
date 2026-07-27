// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { renderELKDiagram } from '@calmstudio/diagram/render';

export interface CalmSvgBundle {
  svg: { light: string; dark: string };
  size: { width: number; height: number };
}

const SVG_SIZE_RE = /<svg[^>]*\bwidth="(\d+(?:\.\d+)?)"[^>]*\bheight="(\d+(?:\.\d+)?)"/;

const FALLBACK_SIZE = { width: 800, height: 480 };

/**
 * Render a CALM architecture to light + dark SVG strings at build time,
 * and extract the diagram's intrinsic pixel size from the SVG root.
 */
export async function prerenderCalmSvg(architecture: unknown): Promise<CalmSvgBundle> {
  const [light, dark] = await Promise.all([
    renderELKDiagram(architecture, { theme: 'light' }),
    renderELKDiagram(architecture, { theme: 'dark' }),
  ]);
  const match = SVG_SIZE_RE.exec(light);
  const size = match
    ? { width: Number(match[1]), height: Number(match[2]) }
    : FALLBACK_SIZE;
  return { svg: { light, dark }, size };
}
