// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import {
  buildGemaraDecorator,
  gemaraDecoratorUniqueId,
  mergeDecoratorAppliesTo,
  GEMARA_DECORATOR_TYPE,
  GEMARA_ARCHITECTURE_SCOPE,
  type GemaraLinkData,
} from './decorator.js';
import type { GemaraCatalogRef, GemaraControl } from './types.js';

const ref: GemaraCatalogRef = {
  namespace: 'finos',
  catalogId: 'mara-controls',
  version: '0.3.0',
  manifestDigest: 'sha256:abc',
  hubUrl: 'https://hub.grc.store/v1/catalogs/finos/mara-controls/versions/0.3.0',
};

const control: GemaraControl = {
  id: 'MARA-VS-007',
  title: 'Vector store tenant isolation',
  description: 'Per-tenant logical isolation of vector data',
  assessmentRequirements: [{ id: 'MARA-VS-007-AR1', text: 'MUST isolate.' }],
};

describe('gemaraDecoratorUniqueId', () => {
  it('is deterministic for a catalog and for a control', () => {
    expect(gemaraDecoratorUniqueId(ref)).toBe('gemara:finos/mara-controls@0.3.0');
    expect(gemaraDecoratorUniqueId(ref, 'MARA-VS-007')).toBe('gemara:finos/mara-controls@0.3.0#MARA-VS-007');
  });
});

describe('buildGemaraDecorator', () => {
  it('builds a catalog-level decorator', () => {
    const d = buildGemaraDecorator({ kind: 'catalog', catalogRef: ref, appliesTo: ['object-store'] });
    expect(d['unique-id']).toBe('gemara:finos/mara-controls@0.3.0');
    expect(d.type).toBe(GEMARA_DECORATOR_TYPE);
    expect(d['applies-to']).toEqual(['object-store']);
    expect(d.target).toEqual(['architecture.json']);

    const data = d.data as GemaraLinkData;
    expect(data.kind).toBe('catalog');
    expect(data.verified).toBe(false);
    expect(data.source).toBe('grc.store');
    expect(data.catalog).toEqual({
      namespace: 'finos',
      id: 'mara-controls',
      version: '0.3.0',
      'manifest-digest': 'sha256:abc',
      'hub-url': 'https://hub.grc.store/v1/catalogs/finos/mara-controls/versions/0.3.0',
    });
    expect(data.control).toBeUndefined();
  });

  it('builds a control-level decorator with the control coordinate', () => {
    const d = buildGemaraDecorator({
      kind: 'control',
      catalogRef: ref,
      control,
      appliesTo: ['vector-store', 'rag-pipeline'],
    });
    expect(d['unique-id']).toBe('gemara:finos/mara-controls@0.3.0#MARA-VS-007');
    expect(d['applies-to']).toEqual(['vector-store', 'rag-pipeline']);

    const data = d.data as GemaraLinkData;
    expect(data.kind).toBe('control');
    expect(data.control).toEqual({
      id: 'MARA-VS-007',
      name: 'Vector store tenant isolation',
      description: 'Per-tenant logical isolation of vector data',
      'assessment-requirements': ['MARA-VS-007-AR1'],
    });
  });

  it('honours a verified override and a custom target', () => {
    const d = buildGemaraDecorator({
      kind: 'catalog',
      catalogRef: ref,
      appliesTo: ['n1'],
      target: ['my-arch.json'],
      verified: true,
    });
    expect(d.target).toEqual(['my-arch.json']);
    expect((d.data as GemaraLinkData).verified).toBe(true);
  });

  it('throws when kind is control but no control is supplied', () => {
    expect(() => buildGemaraDecorator({ kind: 'control', catalogRef: ref, appliesTo: ['n1'] })).toThrow();
  });

  it('omits optional catalog fields when the ref lacks them', () => {
    const bare: GemaraCatalogRef = { namespace: 'acme', catalogId: 'c', version: '1.0.0' };
    const d = buildGemaraDecorator({ kind: 'catalog', catalogRef: bare, appliesTo: ['n1'] });
    expect((d.data as GemaraLinkData).catalog).toEqual({ namespace: 'acme', id: 'c', version: '1.0.0' });
  });

  it('binds at architecture scope via the sentinel applies-to', () => {
    const d = buildGemaraDecorator({ kind: 'catalog', catalogRef: ref, appliesTo: [GEMARA_ARCHITECTURE_SCOPE] });
    expect(d['applies-to']).toEqual(['@architecture']);
  });
});

describe('artifact + optional namespace', () => {
  const noNs: GemaraCatalogRef = { catalogId: 'CCC.MARefArch.CN', version: 'dev' };

  it('defaults artifact to requirements and tags guidance when asked', () => {
    const req = buildGemaraDecorator({ kind: 'catalog', catalogRef: ref, appliesTo: ['n1'] });
    expect((req.data as GemaraLinkData).artifact).toBe('requirements');
    const gui = buildGemaraDecorator({ artifact: 'guidance', kind: 'catalog', catalogRef: ref, appliesTo: ['n1'] });
    expect((gui.data as GemaraLinkData).artifact).toBe('guidance');
  });

  it('omits the namespace segment from the unique-id and data when absent', () => {
    expect(gemaraDecoratorUniqueId(noNs)).toBe('gemara:CCC.MARefArch.CN@dev');
    const d = buildGemaraDecorator({ kind: 'catalog', catalogRef: noNs, appliesTo: ['n1'] });
    expect(d['unique-id']).toBe('gemara:CCC.MARefArch.CN@dev');
    expect((d.data as GemaraLinkData).catalog).toEqual({ id: 'CCC.MARefArch.CN', version: 'dev' });
  });
});

describe('mergeDecoratorAppliesTo', () => {
  it('returns the incoming decorator when there is no existing one', () => {
    const incoming = buildGemaraDecorator({ kind: 'catalog', catalogRef: ref, appliesTo: ['n1'] });
    expect(mergeDecoratorAppliesTo(undefined, incoming)).toBe(incoming);
  });

  it('unions applies-to and keeps incoming data', () => {
    const existing = buildGemaraDecorator({ kind: 'catalog', catalogRef: ref, appliesTo: ['n1'] });
    const incoming = buildGemaraDecorator({ kind: 'catalog', catalogRef: ref, appliesTo: ['n2'] });
    const merged = mergeDecoratorAppliesTo(existing, incoming);
    expect(new Set(merged['applies-to'])).toEqual(new Set(['n1', 'n2']));
    expect(merged['unique-id']).toBe(incoming['unique-id']);
  });

  it('does not duplicate an element already present', () => {
    const existing = buildGemaraDecorator({ kind: 'catalog', catalogRef: ref, appliesTo: ['n1', 'n2'] });
    const incoming = buildGemaraDecorator({ kind: 'catalog', catalogRef: ref, appliesTo: ['n2'] });
    expect(mergeDecoratorAppliesTo(existing, incoming)['applies-to']).toEqual(['n1', 'n2']);
  });
});
