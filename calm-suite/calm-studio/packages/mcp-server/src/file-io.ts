// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { CalmArchitecture } from '@calmstudio/calm-core';

/**
 * Resolve a CALM architecture file path. Defaults to ./architecture.json in the
 * current working directory if no path is provided.
 * Uses .json extension for compatibility with CalmStudio (accepts .json and .calm.json).
 */
export function resolveFile(file?: string): string {
  return path.resolve(file ?? './architecture.json');
}

/**
 * Read a .calm file and return the architecture.
 * If the file does not exist, auto-init with an empty architecture (not an error).
 */
export function readCalmFile(filePath: string): CalmArchitecture {
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !Array.isArray((parsed as Record<string, unknown>)['nodes'])
    ) {
      throw new Error(`Invalid .calm file — expected an object with a "nodes" array: ${filePath}`);
    }
    return parsed as CalmArchitecture;
  } catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') {
      // Auto-init: return empty architecture when file doesn't exist
      return { nodes: [], relationships: [] };
    }
    throw err;
  }
}

/**
 * Write an architecture back to a .calm file (pretty-printed JSON).
 */
export function writeCalmFile(filePath: string, arch: CalmArchitecture): void {
  writeFileSync(filePath, JSON.stringify(arch, null, 2), 'utf-8');
}

/**
 * Read the .calmstudio.json sidecar alongside the given .calm file.
 * Returns null if the sidecar does not exist.
 */
export function readSidecar(calmPath: string): object | null {
  const sidecarPath = resolveSidecarPath(calmPath);
  try {
    const raw = readFileSync(sidecarPath, 'utf-8');
    return JSON.parse(raw) as object;
  } catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') {
      return null;
    }
    throw err;
  }
}

/**
 * Write data to the .calmstudio.json sidecar alongside the given .calm file.
 */
export function writeSidecar(calmPath: string, data: object): void {
  const sidecarPath = resolveSidecarPath(calmPath);
  writeFileSync(sidecarPath, JSON.stringify(data, null, 2), 'utf-8');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveSidecarPath(calmPath: string): string {
  const dir = path.dirname(calmPath);
  const base = path.basename(calmPath, path.extname(calmPath));
  return path.join(dir, `${base}.calmstudio.json`);
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err;
}
