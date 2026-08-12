// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

export type { PackDefinition, NodeTypeEntry, PackColor } from './types.js';
export {
  registerPack,
  resolvePackNode,
  getPackForNodeType,
  getAllPacks,
  getPacksForTypes,
  resetRegistry,
} from './registry.js';
export { corePack } from './packs/core.js';
export { awsPack } from './packs/aws.js';
export { gcpPack } from './packs/gcp.js';
export { azurePack } from './packs/azure.js';
export { kubernetesPack } from './packs/kubernetes.js';
export { aiPack } from './packs/ai.js';
export { fluxnovaPack } from './packs/fluxnova.js';
export { messagingPack } from './packs/messaging.js';
export { identityPack } from './packs/identity.js';
export { openGrisPack } from './packs/opengris.js';
export { archimatePack } from './packs/archimate.js';
export {
	resolveArchimateLayerViewpoint,
	scaffoldArchimateNodeMetadata,
	type ArchimateLayer,
	type ArchimateViewpoint,
} from './packs/archimateMetadataDefaults.js';
export {
	scaffoldNodeMetadata,
	scaffoldRelationshipMetadata,
} from './metadata/scaffoldMetadata.js';

import { registerPack } from './registry.js';
import { corePack } from './packs/core.js';
import { awsPack } from './packs/aws.js';
import { gcpPack } from './packs/gcp.js';
import { azurePack } from './packs/azure.js';
import { kubernetesPack } from './packs/kubernetes.js';
import { aiPack } from './packs/ai.js';
import { fluxnovaPack } from './packs/fluxnova.js';
import { messagingPack } from './packs/messaging.js';
import { identityPack } from './packs/identity.js';
import { openGrisPack } from './packs/opengris.js';
import { archimatePack } from './packs/archimate.js';

/**
 * Register all built-in packs (core + 10 extension packs).
 * Call once at application startup before resolving any pack nodes.
 */
export function initAllPacks(): void {
  registerPack(corePack);
  registerPack(fluxnovaPack);
  registerPack(aiPack);
  registerPack(awsPack);
  registerPack(gcpPack);
  registerPack(azurePack);
  registerPack(kubernetesPack);
  registerPack(messagingPack);
  registerPack(identityPack);
  registerPack(openGrisPack);
  registerPack(archimatePack);
}
