// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

/** Color family for a pack or an individual node type entry. */
export interface PackColor {
  bg: string;
  border: string;
  stroke: string;
  badge?: string;
}

/** A single node type entry within a pack. */
export interface NodeTypeEntry {
  /** Colon-prefixed for extension packs (e.g. 'aws:lambda'); unprefixed for core (e.g. 'actor'). */
  typeId: string;
  /** Human-readable label, e.g. 'Lambda'. */
  label: string;
  /** Inline SVG string (hand-crafted, 16x16 viewBox, stroke-based). */
  icon: string;
  /** Color overrides — typically matches pack default. */
  color: PackColor;
  /** One-line description of what this node type represents. */
  description?: string;
  /** If true, this node renders as a container (large box that accepts children). */
  isContainer?: boolean;
  /** If true, render on canvas as a bordered rectangle with icon beside the label (core style). */
  rectangleLayout?: boolean;
  /** For containers: auto-populate with these child type IDs when placed on the canvas. */
  defaultChildren?: string[];
  /** Values written onto a new node when placed from the palette. */
  defaults?: {
    metadata?: Record<string, unknown>;
  };
}

/** Palette relationship type; maps to a CALM 1.2 relationship-type variant. */
export interface RelationshipTypeEntry {
  typeId: string;
  label: string;
  description?: string;
  calmCoreVariant?: 'connects' | 'composed-of' | 'deployed-in' | 'interacts' | 'options';
}

/** A complete pack definition containing metadata and all node type entries. */
export interface PackDefinition {
  /** Short identifier: 'core', 'aws', 'gcp', 'azure', 'k8s', 'ai'. */
  id: string;
  /** Display name, e.g. 'AWS'. */
  label: string;
  /** Semantic version string. */
  version: string;
  /** Pack-level default color family. */
  color: PackColor;
  /** All node type entries in this pack. */
  nodes: NodeTypeEntry[];
  /** JSON Schema URL written to `$schema` when this pack's types are first used (`standard.$id`). */
  schemaUrl?: string;
  /** Filesystem path to the Standard JSON Schema, relative to the pack file. */
  standardHref?: string;
  /** Relationship types offered in the palette for this pack. */
  relationships?: RelationshipTypeEntry[];
  /** Default relationship metadata when connecting nodes from this pack. */
  relationshipDefaults?: {
    metadata?: Record<string, unknown>;
  };
}
