// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Representative Gemara control-catalog body (the shape the grc.store hub
 * returns after converting the catalog's YAML layer to JSON). Field names
 * follow the proposal's representative MARA catalog; the parser is tolerant of
 * variations, so this also carries extra fields (threats, guidelines) the
 * parser should ignore.
 *
 * Inlined as TS (not a .json import) because calm-core's tsconfig does not set
 * resolveJsonModule — same reason the AIGF catalogue is inlined.
 */
export const maraControlsCatalog = {
  metadata: {
    id: 'mara-controls',
    title: 'MARA Control Catalog',
    version: '0.3.0',
    'mapping-references': [{ 'reference-id': 'aigf', url: 'https://grc.store/finos/aigf', version: '1.0.0' }],
  },
  controls: [
    {
      id: 'MARA-VS-007',
      title: 'Vector store tenant isolation',
      description: 'Per-tenant logical isolation of vector data',
      threats: ['MARA-T-012'],
      guidelines: [{ 'reference-id': 'aigf', entries: ['aigf-data-leakage'] }],
      'assessment-requirements': [
        {
          id: 'MARA-VS-007-AR1',
          text: 'The vector store MUST enforce per-tenant logical isolation of embeddings.',
          applicability: ['multi-tenant'],
        },
      ],
    },
    {
      id: 'MARA-GW-001',
      title: 'Zero-trust agent gateway enforcement',
      'assessment-requirements': [
        { id: 'MARA-GW-001-AR1', text: 'All inbound requests MUST be authenticated and authorized.' },
      ],
    },
  ],
};
