// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import type {
  CalmArchitectureSchema,
  CalmNodeSchema,
  CalmRelationshipSchema,
} from '@finos/calm-models/types';

export type {
  CalmNodeSchema as CalmNode,
  CalmRelationshipSchema as CalmRelationship,
  CalmRelationshipTypeSchema as CalmRelationshipType,
  CalmFlowSchema as CalmFlow,
} from '@finos/calm-models/types';

export type CalmRelationshipVariant =
  | 'connects'
  | 'interacts'
  | 'deployed-in'
  | 'composed-of'
  | 'options';

/** A CALM architecture with `nodes` and `relationships` always present. */
export type CalmArchitecture = Omit<CalmArchitectureSchema, 'nodes' | 'relationships'> & {
  nodes: CalmNodeSchema[];
  relationships: CalmRelationshipSchema[];
};
