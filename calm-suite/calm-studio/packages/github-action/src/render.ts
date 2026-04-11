// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { renderArchitectureToSvg } from '@calmstudio/mcp/dist/tools/render.js';
import type { CalmArchitecture, ValidationIssue } from '@calmstudio/calm-core';
import { validateCalmArchitecture } from '@calmstudio/calm-core';

export interface RenderResult {
  fileName: string;
  svg: string;
  issues: ValidationIssue[];
}

const ERROR_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100">' +
  '<rect width="400" height="100" fill="#fff3cd" stroke="#856404" stroke-width="1" rx="4"/>' +
  '<text x="200" y="50" text-anchor="middle" dominant-baseline="middle" ' +
  'font-family="sans-serif" font-size="14" fill="#856404">Parse error — invalid CALM JSON</text>' +
  '</svg>';

/**
 * Reads a CALM JSON file from disk, renders it to SVG, and validates it.
 * Returns an error SVG placeholder on parse failure.
 */
export async function renderCalmFile(filePath: string): Promise<RenderResult> {
  const fileName = basename(filePath);

  // Parse the file
  let arch: CalmArchitecture;
  try {
    const content = readFileSync(filePath, 'utf-8');
    arch = JSON.parse(content) as CalmArchitecture;
  } catch (err) {
    return {
      fileName,
      svg: ERROR_SVG,
      issues: [
        {
          severity: 'error',
          message: `Failed to parse CALM JSON: ${err instanceof Error ? err.message : String(err)}`
        }
      ]
    };
  }

  // Render to SVG
  let svg: string;
  try {
    svg = await renderArchitectureToSvg(arch);
  } catch (err) {
    svg = ERROR_SVG;
    return {
      fileName,
      svg,
      issues: [
        {
          severity: 'error',
          message: `SVG render failed: ${err instanceof Error ? err.message : String(err)}`
        }
      ]
    };
  }

  // Validate
  const issues = validateCalmArchitecture(arch);

  return { fileName, svg, issues };
}
