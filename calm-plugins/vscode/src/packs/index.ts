// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

export type { PackDefinition, NodeTypeEntry, PackColor, RelationshipTypeEntry } from './types.js';
export {
  registerPack,
  resolvePackNode,
  getAllPacks,
  getPacksForTypes,
  getPackForNodeType,
  resetRegistry,
  subscribePackRegistry,
} from './registry.js';
export { parsePackJson, duplicateTypeIdWarnings, PACK_SCHEMA_ID } from './json/parsePack.js';
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

import { resetRegistry } from './registry.js';
import { loadBundledPackDocuments } from './json/bundledPacks.js';
import { registerPackDocuments } from './json/registerPackDocuments.js';

/**
 * Register bundled pack JSON (webview fallback until the host posts FS packs).
 */
export function initAllPacks(): void {
  registerPackDocuments(
    loadBundledPackDocuments().map((value, index) => ({
      source: `bundled[${index}]`,
      value,
    }))
  );
}

export function resetToBundledPacks(): void {
  resetRegistry();
  initAllPacks();
}
