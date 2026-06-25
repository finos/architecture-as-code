// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Gemara domain types — the subset of the OpenSSF Gemara model that CALM
 * Studio binds to a CALM architecture via `gemara-link` decorators.
 *
 * These are deliberately TOLERANT: the exact Gemara `.cue` field names are
 * still settling and the public grc.store hub was unavailable when this was
 * authored, so the parser (parse.ts) accepts several spellings and ignores
 * unknown fields. Treat these shapes as "what Studio needs", not "the full
 * Gemara schema".
 */

/**
 * A durable coordinate for a published Gemara catalog on grc.store. The
 * `version` is immutable in grc.store, so `namespace/catalogId@version` is a
 * stable citation. `hubUrl` is the resolved hub read URL (for provenance
 * links); `manifestDigest` is the OCI manifest digest the hub reports.
 */
export interface GemaraCatalogRef {
  /** Publisher namespace. Absent for pasted catalogs that carry no namespace —
   * the binding's "unverified" status conveys the lack of a trusted source. */
  namespace?: string;
  catalogId: string;
  version: string;
  manifestDigest?: string;
  hubUrl?: string;
}

/**
 * Which kind of Gemara artifact a binding attaches:
 * - `requirements` — a control catalog (the term "control" is avoided in the UI
 *   because CALM `controls` is a different, overloaded concept).
 * - `guidance` — a guidance catalog (e.g. the AI Governance Framework).
 */
export type GemaraArtifactKind = 'guidance' | 'requirements';

/** Lightweight catalog metadata — all that a whole-catalog attach needs. */
export interface GemaraCatalogMetadata {
  id?: string;
  title?: string;
  version?: string;
}

/**
 * A single assessment requirement under a Gemara control. `text` is a
 * natural-language MUST; the evaluator (e.g. CALMGuard) supplies the check.
 */
export interface GemaraAssessmentRequirement {
  id: string;
  text?: string;
  applicability?: string[];
}

/**
 * A reference from one Gemara entry to entries in another catalog, e.g. a
 * control pointing at the guidelines it satisfies: `{ catalogId: 'finos-air',
 * entryIds: ['AIR-PREV-002'] }`.
 */
export interface GemaraReference {
  catalogId: string;
  entryIds: string[];
}

/**
 * A single Gemara control entry within a control catalog. `guidelines` and
 * `threats` are the canonical cross-layer links (control → guideline it
 * satisfies; control → threats it mitigates).
 */
export interface GemaraControl {
  id: string;
  title?: string;
  description?: string;
  applicability?: string[];
  assessmentRequirements?: GemaraAssessmentRequirement[];
  guidelines?: GemaraReference[];
  threats?: GemaraReference[];
}

/**
 * A parsed Gemara control catalog — catalog metadata plus its controls.
 */
export interface GemaraControlCatalog {
  metadata: {
    id?: string;
    title?: string;
    version?: string;
  };
  controls: GemaraControl[];
}

/**
 * A single Gemara guideline within a guidance catalog (e.g. an AIGF guideline).
 * `objective` is the normative description; `group` is the catalog grouping.
 */
export interface GemaraGuideline {
  id: string;
  title?: string;
  group?: string;
  objective?: string;
}

/**
 * A parsed Gemara guidance catalog — metadata plus its guidelines.
 */
export interface GemaraGuidanceCatalog {
  metadata: {
    id?: string;
    title?: string;
    version?: string;
  };
  guidelines: GemaraGuideline[];
}
