// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import type { LoaderContext } from 'webpack';
import { prerenderCalmSvg } from './prerender.js';

/**
 * Turn raw .calm.json source into an ES module exporting the parsed
 * architecture plus pre-rendered light/dark SVG. Pure — separated from the
 * webpack callback plumbing for direct testing.
 */
export async function buildCalmModule(source: string, resourcePath: string): Promise<string> {
  let architecture: unknown;
  try {
    architecture = JSON.parse(source);
  } catch (err) {
    throw new Error(
      `[@calmstudio/docusaurus-plugin] Invalid JSON in ${resourcePath}: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  let bundle;
  try {
    bundle = await prerenderCalmSvg(architecture);
  } catch (err) {
    throw new Error(
      `[@calmstudio/docusaurus-plugin] Failed to render ${resourcePath}: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  return [
    `export const architecture = ${JSON.stringify(architecture)};`,
    `export const svg = ${JSON.stringify(bundle.svg)};`,
    `export const size = ${JSON.stringify(bundle.size)};`,
    `export default { architecture, svg, size };`,
  ].join('\n');
}

export default function calmJsonLoader(this: LoaderContext<unknown>, source: string): void {
  const callback = this.async();
  buildCalmModule(source, this.resourcePath).then(
    (code) => callback(null, code),
    (err) => callback(err instanceof Error ? err : new Error(String(err)))
  );
}
