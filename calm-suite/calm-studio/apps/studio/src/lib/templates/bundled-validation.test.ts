// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * bundled-validation.test.ts — Regression test for bundled architectures.
 *
 * Validates every template registered via `initAllTemplates()` and every
 * `.calm.json` file shipped under `apps/studio/static/demos/` against the
 * canonical CALM 1.2 meta-schema. Catches schema drift in bundled content
 * before it reaches users (the studio runs validation on demand, so a
 * broken bundled file only surfaces when a user clicks Validate).
 *
 * Was added in response to PR #2553 review (rocketstack-matt) where
 * canonical control.json tightened control-requirement validation,
 * exposing pre-existing template drift.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  validateCalmArchitecture,
  type CalmArchitecture,
  type ValidationIssue,
} from '@calmstudio/calm-core';
import {
  initAllTemplates,
  getAllTemplates,
  loadTemplate,
} from './registry.js';
import { readDocumentName } from '$lib/io/documentName';

initAllTemplates();

function errorsOnly(issues: ValidationIssue[]): ValidationIssue[] {
  return issues.filter((i) => i.severity === 'error');
}

describe('bundled architectures conform to CALM 1.2', () => {
  describe('templates registered via initAllTemplates', () => {
    const templates = getAllTemplates();
    expect(templates.length).toBeGreaterThan(0);

    for (const t of templates) {
      it(`${t._template.id} validates clean`, () => {
        const arch = loadTemplate(t._template.id);
        const errors = errorsOnly(validateCalmArchitecture(arch));
        if (errors.length > 0) {
          // Surface a compact summary so failures point at the offending
          // node + schema path rather than dumping the whole architecture.
          const summary = errors.slice(0, 5).map((e) => ({
            message: e.message,
            nodeId: e.nodeId,
            path: e.path,
          }));
          throw new Error(
            `${t._template.id}: ${errors.length} schema errors. First 5: ${JSON.stringify(summary, null, 2)}`,
          );
        }
        expect(errors).toEqual([]);
      });

      it(`${t._template.id} spawns in with a document name`, () => {
        expect(readDocumentName(loadTemplate(t._template.id))).toBeTruthy();
      });
    }
  });

  describe('static demos under apps/studio/static/demos', () => {
    const demosDir = join(process.cwd(), 'static', 'demos');
    const demoFiles = readdirSync(demosDir).filter((f) => f.endsWith('.calm.json'));
    expect(demoFiles.length).toBeGreaterThan(0);

    for (const file of demoFiles) {
      it(`${file} validates clean`, () => {
        const raw = readFileSync(join(demosDir, file), 'utf8');
        const arch = JSON.parse(raw) as CalmArchitecture;
        const errors = errorsOnly(validateCalmArchitecture(arch));
        if (errors.length > 0) {
          const summary = errors.slice(0, 5).map((e) => ({
            message: e.message,
            nodeId: e.nodeId,
            path: e.path,
          }));
          throw new Error(
            `${file}: ${errors.length} schema errors. First 5: ${JSON.stringify(summary, null, 2)}`,
          );
        }
        expect(errors).toEqual([]);
      });
    }
  });
});
