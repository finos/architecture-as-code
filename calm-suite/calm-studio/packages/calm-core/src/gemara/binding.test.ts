// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { isGemaraDecorator, parseGemaraDecorator, gemaraLinksForElement } from './binding.js';
import { buildGemaraDecorator } from './decorator.js';
import type { GemaraCatalogRef, GemaraControl } from './types.js';
import type { CalmDecorator } from '../types.js';

const ref: GemaraCatalogRef = { namespace: 'finos', catalogId: 'mara-controls', version: '0.3.0' };
const control: GemaraControl = { id: 'MARA-VS-007', title: 'Vector store tenant isolation' };

describe('isGemaraDecorator', () => {
  it('distinguishes gemara-link from other decorators', () => {
    const link = buildGemaraDecorator({ kind: 'catalog', catalogRef: ref, appliesTo: ['n1'] });
    expect(isGemaraDecorator(link)).toBe(true);
    const aigf: CalmDecorator = {
      'unique-id': 'aigf-governance-overlay',
      type: 'aigf-governance',
      target: ['architecture.json'],
      'applies-to': ['n1'],
      data: {},
    };
    expect(isGemaraDecorator(aigf)).toBe(false);
  });
});

describe('parseGemaraDecorator', () => {
  it('round-trips a built control decorator into a GemaraLink', () => {
    const d = buildGemaraDecorator({ kind: 'control', catalogRef: ref, control, appliesTo: ['vector-store'] });
    const link = parseGemaraDecorator(d);
    expect(link).toBeDefined();
    expect(link!.kind).toBe('control');
    expect(link!.uniqueId).toBe('gemara:finos/mara-controls@0.3.0#MARA-VS-007');
    expect(link!.appliesTo).toEqual(['vector-store']);
    expect(link!.catalog).toEqual({ namespace: 'finos', id: 'mara-controls', version: '0.3.0' });
    expect(link!.control).toEqual({ id: 'MARA-VS-007', name: 'Vector store tenant isolation' });
    expect(link!.verified).toBe(false);
  });

  it('round-trips the artifact kind and a namespace-less catalog', () => {
    const guidance = buildGemaraDecorator({
      artifact: 'guidance',
      kind: 'catalog',
      catalogRef: { catalogId: 'finos-air', version: '0.2.0' },
      appliesTo: ['@architecture'],
    });
    const link = parseGemaraDecorator(guidance);
    expect(link!.artifact).toBe('guidance');
    expect(link!.catalog).toEqual({ id: 'finos-air', version: '0.2.0' });
    expect(link!.uniqueId).toBe('gemara:finos-air@0.2.0');
  });

  it('returns undefined for a non-gemara decorator', () => {
    const aigf: CalmDecorator = {
      'unique-id': 'x',
      type: 'aigf-governance',
      target: [],
      'applies-to': [],
      data: {},
    };
    expect(parseGemaraDecorator(aigf)).toBeUndefined();
  });

  it('returns undefined for malformed gemara data', () => {
    const badKind: CalmDecorator = {
      'unique-id': 'x',
      type: 'gemara-link',
      target: [],
      'applies-to': [],
      data: { kind: 'bogus', catalog: { namespace: 'a', id: 'b', version: '1' } },
    };
    expect(parseGemaraDecorator(badKind)).toBeUndefined();

    const noCatalog: CalmDecorator = {
      'unique-id': 'x',
      type: 'gemara-link',
      target: [],
      'applies-to': [],
      data: { kind: 'catalog' },
    };
    expect(parseGemaraDecorator(noCatalog)).toBeUndefined();

    const controlKindNoControl: CalmDecorator = {
      'unique-id': 'x',
      type: 'gemara-link',
      target: [],
      'applies-to': [],
      data: { kind: 'control', catalog: { namespace: 'a', id: 'b', version: '1' } },
    };
    expect(parseGemaraDecorator(controlKindNoControl)).toBeUndefined();
  });
});

describe('gemaraLinksForElement', () => {
  it('filters decorators by applies-to', () => {
    const a = buildGemaraDecorator({ kind: 'control', catalogRef: ref, control, appliesTo: ['vector-store', 'cache'] });
    const b = buildGemaraDecorator({ kind: 'catalog', catalogRef: { ...ref, catalogId: 'ccc-objstor' }, appliesTo: ['object-store'] });
    const decorators = [a, b];

    expect(gemaraLinksForElement(decorators, 'vector-store').map((l) => l.uniqueId)).toEqual([a['unique-id']]);
    expect(gemaraLinksForElement(decorators, 'object-store').map((l) => l.uniqueId)).toEqual([b['unique-id']]);
    expect(gemaraLinksForElement(decorators, 'unrelated')).toEqual([]);
    expect(gemaraLinksForElement(undefined, 'x')).toEqual([]);
  });
});
