// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Builds `gemara-link` CALM decorators — the primitive Studio uses to bind a
 * Gemara catalog or control to architecture element(s). A decorator is an
 * overlay (free-form `data`), so it carries the full Gemara coordinate
 * faithfully without contorting it into CALM's `controls` schema, and its
 * `applies-to[]` can span multiple elements of any kind.
 *
 * `unique-id` is deterministic from the coordinate so re-binding the same
 * catalog/control upserts (replaces) rather than duplicating — mirroring the
 * idempotent merge the AIGF governance overlay uses.
 */

import type { CalmDecorator } from '../types.js';
import type { GemaraArtifactKind, GemaraCatalogRef, GemaraControl } from './types.js';

/** The `type` discriminator carried by every Gemara-link decorator. */
export const GEMARA_DECORATOR_TYPE = 'gemara-link';

/**
 * Conventional `applies-to` value for an **architecture-wide** Gemara binding.
 * CALM has no document-level `unique-id`, and `decorators.applies-to` requires
 * at least one entry, so a whole-architecture link uses this sentinel. The `@`
 * prefix can't collide with a real element unique-id. CALMGuard maps it to the
 * runtime whole-architecture id for an architecture-scoped evaluation.
 */
export const GEMARA_ARCHITECTURE_SCOPE = '@architecture';

/** Default decorator `target` when the caller doesn't pass a document file. */
const DEFAULT_TARGET = 'architecture.json';

export type GemaraLinkKind = 'catalog' | 'control';

export type GemaraCatalogData = {
  namespace?: string;
  id: string;
  version: string;
  'manifest-digest'?: string;
  title?: string;
  'hub-url'?: string;
};

export type GemaraControlData = {
  id: string;
  name?: string;
  description?: string;
  'assessment-requirements'?: string[];
};

export type GemaraLinkData = {
  /** Which kind of Gemara artifact is attached (control catalog vs guidance). */
  artifact: GemaraArtifactKind;
  kind: GemaraLinkKind;
  catalog: GemaraCatalogData;
  control?: GemaraControlData;
  source: 'grc.store';
  /** Whether the catalog's signature/provenance was verified. Always false
   * for v1's client-side fetch (cosign can't run in a browser). */
  verified: boolean;
};

export interface BuildGemaraDecoratorInput {
  /** Defaults to 'requirements' (a control catalog). */
  artifact?: GemaraArtifactKind;
  kind: GemaraLinkKind;
  catalogRef: GemaraCatalogRef;
  /** Required when `kind === 'control'`. */
  control?: GemaraControl;
  /** Element unique-ids this link applies to (node/relationship/flow/arch). */
  appliesTo: string[];
  /** Document file(s) the decorator targets; defaults to architecture.json. */
  target?: string[];
  /** Defaults to false (client fetch, no provenance verification). */
  verified?: boolean;
}

/** Deterministic decorator unique-id from a catalog ref (+ optional control).
 * The namespace segment is omitted when the ref has no namespace (pasted). */
export function gemaraDecoratorUniqueId(ref: GemaraCatalogRef, controlId?: string): string {
  const ns = ref.namespace ? `${ref.namespace}/` : '';
  const base = `gemara:${ns}${ref.catalogId}@${ref.version}`;
  return controlId ? `${base}#${controlId}` : base;
}

function buildCatalogData(ref: GemaraCatalogRef): GemaraCatalogData {
  return {
    ...(ref.namespace !== undefined ? { namespace: ref.namespace } : {}),
    id: ref.catalogId,
    version: ref.version,
    ...(ref.manifestDigest !== undefined ? { 'manifest-digest': ref.manifestDigest } : {}),
    ...(ref.hubUrl !== undefined ? { 'hub-url': ref.hubUrl } : {}),
  };
}

function buildControlData(control: GemaraControl): GemaraControlData {
  const arIds = (control.assessmentRequirements ?? []).map((r) => r.id);
  return {
    id: control.id,
    ...(control.title !== undefined ? { name: control.title } : {}),
    ...(control.description !== undefined ? { description: control.description } : {}),
    ...(arIds.length > 0 ? { 'assessment-requirements': arIds } : {}),
  };
}

/**
 * Build a `gemara-link` decorator for a catalog-level or control-level binding.
 * Throws if `kind === 'control'` but no control is supplied.
 */
export function buildGemaraDecorator(input: BuildGemaraDecoratorInput): CalmDecorator {
  if (input.kind === 'control' && input.control === undefined) {
    throw new Error('buildGemaraDecorator: kind "control" requires a control');
  }

  const catalog = buildCatalogData(input.catalogRef);
  const controlId = input.kind === 'control' ? input.control?.id : undefined;

  const data: GemaraLinkData = {
    artifact: input.artifact ?? 'requirements',
    kind: input.kind,
    catalog,
    ...(input.control !== undefined ? { control: buildControlData(input.control) } : {}),
    source: 'grc.store',
    verified: input.verified ?? false,
  };

  return {
    'unique-id': gemaraDecoratorUniqueId(input.catalogRef, controlId),
    type: GEMARA_DECORATOR_TYPE,
    target: input.target && input.target.length > 0 ? input.target : [DEFAULT_TARGET],
    'applies-to': input.appliesTo,
    data,
  };
}

/**
 * Merge an incoming binding into an existing decorator with the same unique-id:
 * the `applies-to` lists are unioned (so binding one catalog to several elements
 * accumulates targets rather than overwriting), and the incoming decorator's
 * other fields (fresh `data`/`target`) win. Returns the incoming decorator
 * unchanged when there's no existing one.
 */
export function mergeDecoratorAppliesTo(
  existing: CalmDecorator | undefined,
  incoming: CalmDecorator,
): CalmDecorator {
  if (!existing) return incoming;
  const union = Array.from(new Set([...existing['applies-to'], ...incoming['applies-to']]));
  return { ...incoming, 'applies-to': union };
}
