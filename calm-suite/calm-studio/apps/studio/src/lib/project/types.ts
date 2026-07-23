// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * CALM Studio project file (*.calmrj) types — R24.
 */

export interface CalmProjectRulesetEntry {
	path: string;
	enabled: boolean;
}

export interface CalmProjectNamingPattern {
	dir: string;
	file: string;
}

export interface CalmProjectNaming {
	profile: string;
	rootDirs?: Record<string, string>;
	patterns: Record<string, CalmProjectNamingPattern>;
}

export interface CalmProjectConfig {
	$schema?: string;
	version: number;
	name: string;
	validation: {
		rulesets: CalmProjectRulesetEntry[];
	};
	naming: CalmProjectNaming;
	/** Reserved for future diagram settings. */
	diagrams: Record<string, unknown>;
}

export interface NamingResolveContext {
	/** Element display name — primary source for {{name}} (slugified). */
	name: string;
	/** @deprecated Prefer `name`. Kept as fallback / legacy {{id}} alias. */
	id?: string;
	/** Optional owning application-component slug for nested patterns. */
	componentId?: string;
	/** Optional service slug for endpoint patterns. */
	serviceId?: string;
}

export interface NamingResolveResult {
	folder: string;
	fileName: string;
	relativePath: string;
	mapped: boolean;
	warning?: string;
}
