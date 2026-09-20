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

/** Find-neighbors scan scope (R28). Roots are relative to the project folder. */
export interface CalmProjectNeighborsConfig {
	/**
	 * Folder roots to search (including subfolders).
	 * Empty / omitted = search the entire project.
	 */
	searchRoots: string[];
}

/** Project template folder (R33). Path is relative to the project root. */
export interface CalmProjectTemplatesConfig {
	dir: string;
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
	/** Optional Find-neighbors scan roots. */
	neighbors?: CalmProjectNeighborsConfig;
	/** Optional folder of CALM template JSON files (R33). */
	templates?: CalmProjectTemplatesConfig;
	/** Optional folder of CALM CLI pattern JSON files (R41). */
	patterns?: CalmProjectTemplatesConfig;
	/** Extra pack folder and/or bundled pack ids to hide (R44, R68). */
	extensions?: {
		dir?: string;
		disabled?: string[];
	};
	/** Optional CALM Hub origin (scheme + host + port, no `/api`). Overrides `~/.calm.json` when both exist. */
	hub?: { url: string };
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
