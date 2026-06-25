// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Recognises `gemara-link` decorators in a loaded CALM document and normalises
 * them into a display-friendly shape, so a round-tripped architecture renders
 * its Gemara bindings first-class (not as opaque overlay data).
 */

import type { CalmDecorator } from '../types.js';
import type { GemaraArtifactKind } from './types.js';
import {
  GEMARA_DECORATOR_TYPE,
  type GemaraCatalogData,
  type GemaraControlData,
  type GemaraLinkKind,
} from './decorator.js';

/** A normalised, parsed view of a `gemara-link` decorator. */
export interface GemaraLink {
  uniqueId: string;
  artifact: GemaraArtifactKind;
  kind: GemaraLinkKind;
  appliesTo: string[];
  catalog: GemaraCatalogData;
  control?: GemaraControlData;
  verified: boolean;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** True if a decorator is a Gemara-link overlay. */
export function isGemaraDecorator(decorator: CalmDecorator): boolean {
  return decorator.type === GEMARA_DECORATOR_TYPE;
}

function parseCatalog(raw: unknown): GemaraCatalogData | undefined {
  if (!isRecord(raw)) return undefined;
  const { id, version } = raw;
  if (typeof id !== 'string' || typeof version !== 'string') {
    return undefined;
  }
  const namespace = raw['namespace'];
  const digest = raw['manifest-digest'];
  const title = raw['title'];
  const hubUrl = raw['hub-url'];
  return {
    ...(typeof namespace === 'string' ? { namespace } : {}),
    id,
    version,
    ...(typeof digest === 'string' ? { 'manifest-digest': digest } : {}),
    ...(typeof title === 'string' ? { title } : {}),
    ...(typeof hubUrl === 'string' ? { 'hub-url': hubUrl } : {}),
  };
}

function parseControl(raw: unknown): GemaraControlData | undefined {
  if (!isRecord(raw)) return undefined;
  const { id } = raw;
  if (typeof id !== 'string') return undefined;
  const name = raw['name'];
  const description = raw['description'];
  const ar = raw['assessment-requirements'];
  const arIds = Array.isArray(ar) ? ar.filter((x): x is string => typeof x === 'string') : undefined;
  return {
    id,
    ...(typeof name === 'string' ? { name } : {}),
    ...(typeof description === 'string' ? { description } : {}),
    ...(arIds && arIds.length > 0 ? { 'assessment-requirements': arIds } : {}),
  };
}

/**
 * Parse a decorator into a GemaraLink, or undefined if it isn't a valid
 * Gemara-link overlay.
 */
export function parseGemaraDecorator(decorator: CalmDecorator): GemaraLink | undefined {
  if (!isGemaraDecorator(decorator)) return undefined;
  if (!isRecord(decorator.data)) return undefined;

  const kindRaw = decorator.data['kind'];
  const kind: GemaraLinkKind | undefined =
    kindRaw === 'catalog' || kindRaw === 'control' ? kindRaw : undefined;
  if (kind === undefined) return undefined;

  const catalog = parseCatalog(decorator.data['catalog']);
  if (catalog === undefined) return undefined;

  const control = parseControl(decorator.data['control']);
  if (kind === 'control' && control === undefined) return undefined;

  // Older/hand-authored links may omit `artifact`; default to requirements.
  const artifact: GemaraArtifactKind = decorator.data['artifact'] === 'guidance' ? 'guidance' : 'requirements';

  return {
    uniqueId: decorator['unique-id'],
    artifact,
    kind,
    appliesTo: decorator['applies-to'],
    catalog,
    ...(control !== undefined ? { control } : {}),
    verified: decorator.data['verified'] === true,
  };
}

/** All Gemara links whose `applies-to` includes the given element id. */
export function gemaraLinksForElement(
  decorators: CalmDecorator[] | undefined,
  elementId: string,
): GemaraLink[] {
  if (!decorators) return [];
  const out: GemaraLink[] = [];
  for (const d of decorators) {
    const link = parseGemaraDecorator(d);
    if (link && link.appliesTo.includes(elementId)) out.push(link);
  }
  return out;
}
