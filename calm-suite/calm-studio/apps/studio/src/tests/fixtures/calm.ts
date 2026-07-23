// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import type { CalmNode } from '@calmstudio/calm-core';

type NodeInput = Pick<CalmNode, 'unique-id' | 'node-type' | 'name'> & Partial<CalmNode>;

/** Minimal valid CALM node for tests (fills required description). */
export function testNode(input: NodeInput): CalmNode {
	return { description: '', ...input };
}
