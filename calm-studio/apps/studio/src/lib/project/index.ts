// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

export type {
	CalmProjectConfig,
	CalmProjectNaming,
	CalmProjectNamingPattern,
	CalmProjectRulesetEntry,
	CalmProjectUiConfig,
	CalmProjectUrlMappingConfig,
	NamingResolveContext,
	NamingResolveResult,
} from './types';
export { createDefaultProjectConfig, isCalmProjectConfig, CENGINEERING_ARCHIMATE_PROFILE } from './defaults';
export {
	DEMO_TEMPLATE_CATEGORIES,
	filterTemplateCategoriesForDemo,
	isDemoTemplateCategory,
	isProjectDemoEnabled,
	shouldShowDemoUi,
} from './demoUi';
export { resolveExtractPath, normalizeSlug, collapseDuplicateSlugInFileName } from './naming';
export {
	collectExtractSubgraph,
	applyExtractToParent,
} from './extractSubgraph';
export {
	ensureWritePermission,
	writeProjectRelativeFile,
	readProjectRelativeText,
	projectRelativeFileExists,
	findRootCalmrjFiles,
	splitRelativePath,
} from './projectFs';
export {
	hydrateSpectralRuleset,
	runProjectSpectralRules,
	runSpectralLint,
} from './spectralBridge';
export type { SpectralLintResult } from './spectralBridge';
