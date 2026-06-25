// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import {
  parseControlCatalog,
  parseCatalogMetadata,
  parseGuidanceCatalog,
  GemaraParseError,
} from './parse.js';
import { maraControlsCatalog } from './__fixtures__/mara-controls.js';

describe('parseControlCatalog', () => {
  it('parses a representative MARA catalog body', () => {
    const cat = parseControlCatalog(maraControlsCatalog);
    expect(cat.metadata).toEqual({ id: 'mara-controls', title: 'MARA Control Catalog', version: '0.3.0' });
    expect(cat.controls).toHaveLength(2);

    const vs = cat.controls[0]!;
    expect(vs.id).toBe('MARA-VS-007');
    expect(vs.title).toBe('Vector store tenant isolation');
    expect(vs.description).toBe('Per-tenant logical isolation of vector data');
    expect(vs.assessmentRequirements).toHaveLength(1);
    expect(vs.assessmentRequirements![0]).toEqual({
      id: 'MARA-VS-007-AR1',
      text: 'The vector store MUST enforce per-tenant logical isolation of embeddings.',
      applicability: ['multi-tenant'],
    });
  });

  it('parses guideline refs and drops unmodeled catalog fields', () => {
    const cat = parseControlCatalog(maraControlsCatalog);
    // guideline refs are now parsed (the cross-layer link)
    expect(cat.controls[0]!.guidelines).toEqual([{ catalogId: 'aigf', entryIds: ['aigf-data-leakage'] }]);
    // catalog-level mapping-references aren't surfaced in metadata
    expect(cat.metadata).not.toHaveProperty('mapping-references');
  });

  it('parses a JSON string (the Paste fallback)', () => {
    const cat = parseControlCatalog(JSON.stringify(maraControlsCatalog));
    expect(cat.controls.map((c) => c.id)).toEqual(['MARA-VS-007', 'MARA-GW-001']);
  });

  it('accepts `name` as a title alias and `objective` as a description alias', () => {
    const cat = parseControlCatalog({
      metadata: { id: 'x' },
      controls: [{ id: 'C1', name: 'Aliased title', objective: 'Aliased description' }],
    });
    expect(cat.controls[0]!.title).toBe('Aliased title');
    expect(cat.controls[0]!.description).toBe('Aliased description');
  });

  it('accepts controls as an id-keyed object, using the key as id', () => {
    const cat = parseControlCatalog({
      metadata: { id: 'x' },
      controls: { 'CCC.ObjStor.OS01': { title: 'Encryption at rest' } },
    });
    expect(cat.controls).toHaveLength(1);
    expect(cat.controls[0]!.id).toBe('CCC.ObjStor.OS01');
    expect(cat.controls[0]!.title).toBe('Encryption at rest');
  });

  it('parses a real-world catalog shape (OSPS/CCC: top-level title, control objective)', () => {
    // Mirrors the live hub body for openssf/osps-baseline: catalog title at the
    // top level, control id + title + objective, assessment-requirements with
    // extra fields (recommendation, state) the parser should ignore.
    const cat = parseControlCatalog({
      title: 'Open Source Project Security Baseline',
      metadata: { id: 'osps-baseline', version: 'v2025.10', description: 'Baseline', type: 'Framework' },
      groups: [{ id: 'AC' }],
      controls: [
        {
          id: 'OSPS-AC-01',
          group: 'AC',
          title: 'Use MFA for Sensitive Actions',
          objective: 'Reduce the risk of account compromise.',
          state: 'Active',
          'assessment-requirements': [
            {
              id: 'OSPS-AC-01.01',
              text: 'The system MUST require MFA.',
              recommendation: 'Enforce MFA.',
              state: 'Active',
              applicability: ['maturity-1'],
            },
          ],
        },
      ],
    });
    expect(cat.metadata).toEqual({ id: 'osps-baseline', title: 'Open Source Project Security Baseline', version: 'v2025.10' });
    expect(cat.controls[0]).toEqual({
      id: 'OSPS-AC-01',
      title: 'Use MFA for Sensitive Actions',
      description: 'Reduce the risk of account compromise.',
      assessmentRequirements: [
        { id: 'OSPS-AC-01.01', text: 'The system MUST require MFA.', applicability: ['maturity-1'] },
      ],
    });
  });

  it('reads metadata from the top level when there is no metadata object', () => {
    const cat = parseControlCatalog({ id: 'flat', version: '2.0.0', controls: [{ id: 'C1' }] });
    expect(cat.metadata).toEqual({ id: 'flat', version: '2.0.0' });
  });

  it('throws GemaraParseError on non-JSON string', () => {
    expect(() => parseControlCatalog('{not json')).toThrow(GemaraParseError);
  });

  it('throws GemaraParseError on a non-object', () => {
    expect(() => parseControlCatalog(42)).toThrow(GemaraParseError);
  });

  it('throws GemaraParseError when there are no controls', () => {
    expect(() => parseControlCatalog({ metadata: { id: 'empty' }, controls: [] })).toThrow(
      /no controls/,
    );
  });
});

describe('parseCatalogMetadata', () => {
  it('extracts metadata without requiring controls (works for guidance catalogs)', () => {
    // A guidance catalog has guidelines, not controls — metadata parse must still work.
    const md = parseCatalogMetadata({
      title: 'AI Governance Framework',
      metadata: { id: 'finos-air', version: '0.2.0', type: 'GuidanceCatalog' },
      guidelines: [{ id: 'AIR-RC-001' }],
    });
    expect(md).toEqual({ id: 'finos-air', title: 'AI Governance Framework', version: '0.2.0' });
  });

  it('parses a JSON string and reads a top-level title', () => {
    const md = parseCatalogMetadata('{"title":"OSPS","metadata":{"id":"osps-baseline","version":"v2025.10"}}');
    expect(md).toEqual({ id: 'osps-baseline', title: 'OSPS', version: 'v2025.10' });
  });

  it('throws when the input is not a recognisable catalog (no id or title)', () => {
    expect(() => parseCatalogMetadata({ foo: 'bar' })).toThrow(GemaraParseError);
  });
});

describe('parseControlCatalog — cross-layer refs (real CCC MARefArch shape)', () => {
  it('extracts a control’s guidelines + threats refs and assessment-requirements', () => {
    const cat = parseControlCatalog({
      metadata: { id: 'ccc.marefarc.cn', version: 'v2026.06-rc1' },
      controls: [
        {
          id: 'CCC.MARefArc.CN01',
          group: 'PREV',
          objective: 'Sanitize, filter, and classify data ingested by the Knowledge Layer.',
          guidelines: [{ 'reference-id': 'finos-air', entries: [{ 'reference-id': 'AIR-PREV-002' }] }],
          threats: [
            { 'reference-id': 'CCC.MARefArc.Threats', entries: [{ 'reference-id': 'CCC.MARefArc.TH06' }, { 'reference-id': 'CCC.MARefArc.TH01' }] },
          ],
          'assessment-requirements': [
            { id: 'CCC.MARefArc.CN01.AR01', text: 'Data ingested MUST be scanned and filtered.', applicability: ['all'], state: 'Active' },
          ],
        },
      ],
    });
    const c = cat.controls[0]!;
    expect(c.id).toBe('CCC.MARefArc.CN01');
    expect(c.guidelines).toEqual([{ catalogId: 'finos-air', entryIds: ['AIR-PREV-002'] }]);
    expect(c.threats).toEqual([
      { catalogId: 'CCC.MARefArc.Threats', entryIds: ['CCC.MARefArc.TH06', 'CCC.MARefArc.TH01'] },
    ]);
    expect(c.assessmentRequirements).toHaveLength(1);
    expect(c.assessmentRequirements![0]!.id).toBe('CCC.MARefArc.CN01.AR01');
  });
});

describe('parseGuidanceCatalog (real AIGF finos-air shape)', () => {
  it('parses guidelines with id/title/group/objective', () => {
    const cat = parseGuidanceCatalog({
      title: 'AI Governance Framework',
      metadata: { id: 'finos-air', version: '0.2.0' },
      groups: [{ id: 'PREV', title: 'Preventive' }],
      guidelines: [
        { id: 'AIR-PREV-002', group: 'PREV', title: 'Data Filtering From External Knowledge Bases', objective: 'Sanitize and filter ingested data.' },
      ],
    });
    expect(cat.metadata).toEqual({ id: 'finos-air', title: 'AI Governance Framework', version: '0.2.0' });
    expect(cat.guidelines[0]).toEqual({
      id: 'AIR-PREV-002',
      group: 'PREV',
      title: 'Data Filtering From External Knowledge Bases',
      objective: 'Sanitize and filter ingested data.',
    });
  });

  it('throws when there are no guidelines', () => {
    expect(() => parseGuidanceCatalog({ metadata: { id: 'x' }, guidelines: [] })).toThrow(/no guidelines/);
  });
});
