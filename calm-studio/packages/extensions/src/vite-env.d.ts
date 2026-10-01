// SPDX-FileCopyrightText: 2026 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

interface ImportMeta {
	glob(
		pattern: string,
		options?: { eager?: boolean; import?: string }
	): Record<string, unknown>;
}
