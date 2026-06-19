<!--
  SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
  SPDX-License-Identifier: Apache-2.0
-->
<script lang="ts">
	import type { Badge } from '@calmstudio/calm-core';
	import BadgeChip from './BadgeChip.svelte';

	let { badges = [] }: { badges?: Badge[] } = $props();
</script>

{#if badges.length > 0}
	<span class="badge-cluster">
		{#each badges as badge (badge.id)}
			<BadgeChip {badge} />
		{/each}
	</span>
{/if}

<style>
	.badge-cluster {
		display: inline-flex;
		gap: 4px;
		flex-wrap: wrap;
	}
</style>
