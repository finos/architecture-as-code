// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { Position } from '@xyflow/svelte';
import type { Component } from 'svelte';
import type { CalmTransition } from '@calmstudio/calm-core';
import ConnectsEdge from '$lib/canvas/edges/ConnectsEdge.svelte';
import InteractsEdge from '$lib/canvas/edges/InteractsEdge.svelte';
import OptionsEdge from '$lib/canvas/edges/OptionsEdge.svelte';
import DeployedInEdge from '$lib/canvas/edges/DeployedInEdge.svelte';
import ComposedOfEdge from '$lib/canvas/edges/ComposedOfEdge.svelte';

const flowTransition: CalmTransition = {
	'relationship-unique-id': 'e1',
	'sequence-number': 1,
	description: 'A calls B',
};

describe('flow transition tooltip on edges', () => {
	it.each([
		['ConnectsEdge', ConnectsEdge],
		['InteractsEdge', InteractsEdge],
		['OptionsEdge', OptionsEdge],
		['DeployedInEdge', DeployedInEdge],
		['ComposedOfEdge', ComposedOfEdge],
	] as [string, Component<Record<string, unknown>>][])('%s shows the transition description on hover', async (_name, Edge) => {
		const { container } = render(Edge, {
			props: {
				id: 'e1',
				source: 'a',
				target: 'b',
				sourceX: 0,
				sourceY: 0,
				targetX: 100,
				targetY: 100,
				sourcePosition: Position.Bottom,
				targetPosition: Position.Top,
				data: { flowTransition },
			},
		});

		const hitArea = container.querySelector('.flow-overlay circle[fill="transparent"]');
		expect(hitArea).not.toBeNull();
		await fireEvent.pointerEnter(hitArea!);

		expect(container.querySelector('.flow-tooltip')?.textContent?.trim()).toBe('A calls B');
	});
});
