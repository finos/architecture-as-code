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
export { loadPacksFromDirectories, orderedPackDirectories } from './json/loadPacksFromFs.js';
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
