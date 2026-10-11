// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

export type { PackDefinition, NodeTypeEntry, PackColor } from './types.js';
export {
  registerPack,
  resolvePackNode,
  getAllPacks,
  getPacksForTypes,
  resetRegistry,
} from './registry.js';
export { corePack } from './definitions/core.js';
export { awsPack } from './definitions/aws.js';
export { gcpPack } from './definitions/gcp.js';
export { azurePack } from './definitions/azure.js';
export { kubernetesPack } from './definitions/kubernetes.js';
export { aiPack } from './definitions/ai.js';
export { fluxnovaPack } from './definitions/fluxnova.js';
export { messagingPack } from './definitions/messaging.js';
export { identityPack } from './definitions/identity.js';
export { openGrisPack } from './definitions/opengris.js';

import { registerPack } from './registry.js';
import { corePack } from './definitions/core.js';
import { awsPack } from './definitions/aws.js';
import { gcpPack } from './definitions/gcp.js';
import { azurePack } from './definitions/azure.js';
import { kubernetesPack } from './definitions/kubernetes.js';
import { aiPack } from './definitions/ai.js';
import { fluxnovaPack } from './definitions/fluxnova.js';
import { messagingPack } from './definitions/messaging.js';
import { identityPack } from './definitions/identity.js';
import { openGrisPack } from './definitions/opengris.js';

/**
 * Register all built-in packs (core + 9 extension packs).
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
}
