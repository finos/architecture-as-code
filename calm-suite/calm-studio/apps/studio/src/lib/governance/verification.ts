// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Whether to surface Gemara binding provenance ("unverified") status in the UI.
 *
 * v1 fetches catalogs client-side, which can't run cosign/provenance checks, so
 * every binding is `verified: false`. Until real verification exists, tagging
 * everything "unverified" is just noise — the UI gates its verification badges
 * on this flag. Flip to `true` (or remove the gates) when verification lands.
 * The `verified` field is still recorded in the decorator data either way.
 */
export const SHOW_VERIFICATION_STATUS = false;
