// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import type { CalmNode, CalmRelationship, CalmArchitecture } from '../../types.js';

/**
 * Badge types for visualization — severity classifications and adapter contracts.
 *
 * Badges are small visual overlays (icons, counts, tints) rendered on nodes/edges
 * to surface metadata from decorators or computed properties.
 */

export type Severity = 'low' | 'medium' | 'high' | 'critical' | 'unknown';

/**
 * A badge — small visual overlay on a node or edge.
 *
 * @property id Unique identifier for this badge instance
 * @property source Name of the badge adapter that produced it
 * @property kind Visual representation: icon (symbol), count (numeric), or tint (color wash)
 * @property severity Optional criticality level for rendering priority
 * @property label Optional text label for count badges or tooltips
 * @property data Additional context passed to renderers (e.g. icon name, color, count value)
 */
export interface Badge {
  id: string;
  source: string;
  kind: 'icon' | 'count' | 'tint';
  severity?: Severity;
  label?: string;
  data?: Record<string, unknown>;
}

/**
 * BadgeAdapter — stateless badge factory.
 *
 * Adapters produce badges by examining a node or edge within the architecture
 * context. Multiple adapters can feed into a single badge index.
 *
 * @property name Unique adapter identifier (e.g. 'security-posture', 'compliance-status')
 * @property forNode Examine a node and produce zero or more badges
 * @property forEdge Examine a relationship and produce zero or more badges
 */
export interface BadgeAdapter {
  name: string;
  forNode(node: CalmNode, arch: CalmArchitecture): Badge[];
  forEdge(edge: CalmRelationship, arch: CalmArchitecture): Badge[];
}

/**
 * BadgeIndex — read-only badge lookup.
 *
 * Populated by registering adapters. Renderers call these to fetch badges for a
 * specific node or edge.
 */
export interface BadgeIndex {
  forNode: (id: string) => Badge[];
  forEdge: (id: string) => Badge[];
}
