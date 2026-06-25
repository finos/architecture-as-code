// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Tolerant parser turning a Gemara control-catalog body (the JSON the hub
 * returns, or a pasted JSON catalog) into the typed model in types.ts.
 *
 * "Tolerant" because the exact Gemara field names are still settling: this
 * accepts a few common spellings and ignores anything it doesn't recognise,
 * rather than failing closed on an unexpected key.
 */

import type {
  GemaraAssessmentRequirement,
  GemaraCatalogMetadata,
  GemaraControl,
  GemaraControlCatalog,
  GemaraGuidanceCatalog,
  GemaraGuideline,
  GemaraReference,
} from './types.js';

/** Thrown when input cannot be coerced into a control catalog at all. */
export class GemaraParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GemaraParseError';
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

/** First non-empty string among the named keys of `rec`. */
function pickString(rec: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const s = asString(rec[k]);
    if (s !== undefined) return s;
  }
  return undefined;
}

function asStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v.filter((x): x is string => typeof x === 'string' && x.length > 0);
  return out.length > 0 ? out : undefined;
}

function pickStringArray(rec: Record<string, unknown>, ...keys: string[]): string[] | undefined {
  for (const k of keys) {
    const a = asStringArray(rec[k]);
    if (a !== undefined) return a;
  }
  return undefined;
}

function parseAssessmentRequirement(raw: unknown): GemaraAssessmentRequirement | undefined {
  if (!isRecord(raw)) return undefined;
  const id = pickString(raw, 'id', 'requirement-id', 'requirementId');
  if (id === undefined) return undefined;
  const text = pickString(raw, 'text', 'requirement', 'description');
  const applicability = pickStringArray(raw, 'applicability');
  return {
    id,
    ...(text !== undefined ? { text } : {}),
    ...(applicability !== undefined ? { applicability } : {}),
  };
}

/**
 * Parse a Gemara cross-catalog reference list, e.g. a control's `guidelines` or
 * `threats`: `[{ reference-id: 'finos-air', entries: [{ reference-id: 'AIR-…' }] }]`.
 */
function parseReferences(raw: unknown): GemaraReference[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: GemaraReference[] = [];
  for (const r of raw) {
    if (!isRecord(r)) continue;
    const catalogId = pickString(r, 'reference-id', 'referenceId', 'catalog', 'id');
    if (catalogId === undefined) continue;
    const entriesRaw = r['entries'];
    const entryIds = Array.isArray(entriesRaw)
      ? entriesRaw
          .map((e) => (isRecord(e) ? pickString(e, 'reference-id', 'referenceId', 'id') : asString(e)))
          .filter((x): x is string => x !== undefined)
      : [];
    out.push({ catalogId, entryIds });
  }
  return out.length > 0 ? out : undefined;
}

function parseControl(raw: unknown, fallbackId?: string): GemaraControl | undefined {
  if (!isRecord(raw)) return undefined;
  const id = pickString(raw, 'id', 'control-id', 'controlId') ?? fallbackId;
  if (id === undefined) return undefined;

  const title = pickString(raw, 'title', 'name');
  const description = pickString(raw, 'description', 'objective');
  const applicability = pickStringArray(raw, 'applicability');

  const arRaw =
    raw['assessment-requirements'] ?? raw['assessmentRequirements'] ?? raw['assessment_requirements'];
  const assessmentRequirements = Array.isArray(arRaw)
    ? arRaw.map((r) => parseAssessmentRequirement(r)).filter((r): r is GemaraAssessmentRequirement => r !== undefined)
    : undefined;

  const guidelines = parseReferences(raw['guidelines']);
  const threats = parseReferences(raw['threats']);

  return {
    id,
    ...(title !== undefined ? { title } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(applicability !== undefined ? { applicability } : {}),
    ...(assessmentRequirements && assessmentRequirements.length > 0 ? { assessmentRequirements } : {}),
    ...(guidelines !== undefined ? { guidelines } : {}),
    ...(threats !== undefined ? { threats } : {}),
  };
}

/** Extract a controls array from either an array or an id-keyed object. */
function extractControls(raw: unknown): GemaraControl[] {
  if (Array.isArray(raw)) {
    return raw.map((c) => parseControl(c)).filter((c): c is GemaraControl => c !== undefined);
  }
  if (isRecord(raw)) {
    return Object.entries(raw)
      .map(([key, value]) => parseControl(value, key))
      .filter((c): c is GemaraControl => c !== undefined);
  }
  return [];
}

/**
 * Parse a Gemara control catalog from the hub body, an already-parsed object,
 * or a JSON string (the Paste fallback). Throws GemaraParseError if the input
 * has no recognisable controls.
 */
export function parseControlCatalog(input: unknown): GemaraControlCatalog {
  let value: unknown = input;
  if (typeof input === 'string') {
    try {
      value = JSON.parse(input);
    } catch {
      throw new GemaraParseError('Catalog is not valid JSON');
    }
  }

  if (!isRecord(value)) {
    throw new GemaraParseError('Catalog must be a JSON object');
  }

  const metaRaw = isRecord(value['metadata']) ? value['metadata'] : value;
  const id = pickString(metaRaw, 'id', 'catalog-id', 'catalogId');
  // Real catalogs (e.g. OSPS, CCC) carry the catalog title at the top level, not
  // inside metadata — fall back to it when metadata has no title.
  const title = pickString(metaRaw, 'title', 'name') ?? pickString(value, 'title', 'name');
  const version = pickString(metaRaw, 'version');

  const controls = extractControls(value['controls']);
  if (controls.length === 0) {
    throw new GemaraParseError('Catalog has no controls');
  }

  return {
    metadata: {
      ...(id !== undefined ? { id } : {}),
      ...(title !== undefined ? { title } : {}),
      ...(version !== undefined ? { version } : {}),
    },
    controls,
  };
}

/**
 * Extract just the catalog metadata (id, title, version) — all a whole-catalog
 * attach needs. Unlike parseControlCatalog this does NOT require a `controls`
 * array, so it works for guidance catalogs (which carry `guidelines`) as well as
 * control catalogs. Throws only when the input isn't a recognisable catalog.
 */
export function parseCatalogMetadata(input: unknown): GemaraCatalogMetadata {
  let value: unknown = input;
  if (typeof input === 'string') {
    try {
      value = JSON.parse(input);
    } catch {
      throw new GemaraParseError('Catalog is not valid JSON');
    }
  }
  if (!isRecord(value)) {
    throw new GemaraParseError('Catalog must be a JSON object');
  }

  const metaRaw = isRecord(value['metadata']) ? value['metadata'] : value;
  const id = pickString(metaRaw, 'id', 'catalog-id', 'catalogId');
  const title = pickString(metaRaw, 'title', 'name') ?? pickString(value, 'title', 'name');
  const version = pickString(metaRaw, 'version');

  if (id === undefined && title === undefined) {
    throw new GemaraParseError('Not a recognisable Gemara catalog (no id or title)');
  }

  return {
    ...(id !== undefined ? { id } : {}),
    ...(title !== undefined ? { title } : {}),
    ...(version !== undefined ? { version } : {}),
  };
}

function parseGuideline(raw: unknown, fallbackId?: string): GemaraGuideline | undefined {
  if (!isRecord(raw)) return undefined;
  const id = pickString(raw, 'id', 'guideline-id', 'guidelineId') ?? fallbackId;
  if (id === undefined) return undefined;
  const title = pickString(raw, 'title', 'name');
  const group = pickString(raw, 'group');
  const objective = pickString(raw, 'objective', 'description');
  return {
    id,
    ...(title !== undefined ? { title } : {}),
    ...(group !== undefined ? { group } : {}),
    ...(objective !== undefined ? { objective } : {}),
  };
}

function extractGuidelines(raw: unknown): GemaraGuideline[] {
  if (Array.isArray(raw)) {
    return raw.map((g) => parseGuideline(g)).filter((g): g is GemaraGuideline => g !== undefined);
  }
  if (isRecord(raw)) {
    return Object.entries(raw)
      .map(([key, value]) => parseGuideline(value, key))
      .filter((g): g is GemaraGuideline => g !== undefined);
  }
  return [];
}

/**
 * Parse a Gemara guidance catalog (e.g. AIGF `finos-air`) from a hub body or a
 * pasted/object catalog. Throws GemaraParseError if it has no guidelines.
 */
export function parseGuidanceCatalog(input: unknown): GemaraGuidanceCatalog {
  let value: unknown = input;
  if (typeof input === 'string') {
    try {
      value = JSON.parse(input);
    } catch {
      throw new GemaraParseError('Catalog is not valid JSON');
    }
  }
  if (!isRecord(value)) {
    throw new GemaraParseError('Catalog must be a JSON object');
  }

  const metaRaw = isRecord(value['metadata']) ? value['metadata'] : value;
  const id = pickString(metaRaw, 'id', 'catalog-id', 'catalogId');
  const title = pickString(metaRaw, 'title', 'name') ?? pickString(value, 'title', 'name');
  const version = pickString(metaRaw, 'version');

  const guidelines = extractGuidelines(value['guidelines']);
  if (guidelines.length === 0) {
    throw new GemaraParseError('Catalog has no guidelines');
  }

  return {
    metadata: {
      ...(id !== undefined ? { id } : {}),
      ...(title !== undefined ? { title } : {}),
      ...(version !== undefined ? { version } : {}),
    },
    guidelines,
  };
}
