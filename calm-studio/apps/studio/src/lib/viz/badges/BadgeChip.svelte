<!--
  SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
  SPDX-License-Identifier: Apache-2.0
-->
<script lang="ts">
	import type { Badge } from '@calmstudio/calm-core';

	let { badge }: { badge: Badge } = $props();

	const dotColor = $derived(
		(
			{
				low: '#06b6d4',
				medium: '#f59e0b',
				high: '#f97316',
				critical: '#f43f5e',
				unknown: '#6b7280'
			} as const
		)[badge.severity ?? 'unknown']
	);

	const labelText = $derived(badge.label ?? badge.id);
</script>

<span class="badge-chip" title={labelText} data-source={badge.source}>
	<span class="dot" style:background-color={dotColor} aria-hidden="true"></span>
	<span class="lbl">{labelText}</span>
</span>

<style>
	.badge-chip {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 3px 6px;
		background: rgb(22 26 34 / 1);
		border: 1px solid rgb(31 36 46 / 1);
		border-radius: 3px;
		font: 500 9px/1 'Geist Mono', ui-monospace, monospace;
		color: rgb(156 163 175 / 1);
	}
	.dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		flex-shrink: 0;
	}
</style>
