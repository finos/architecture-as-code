<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script lang="ts">
	import { clearRelationshipHover, setRelationshipHover } from '../relationshipHover.svelte';

	let {
		source,
		target,
		path,
		hovered,
	}: {
		source: string;
		target: string;
		path: string;
		hovered: boolean;
	} = $props();

	$effect(() => {
		if (!hovered) return;
		const ticket = setRelationshipHover(source, target);
		return () => clearRelationshipHover(ticket);
	});
</script>

{#if hovered}
	<path d={path} class="rel-hover-glow wide" />
	<path d={path} class="rel-hover-glow tight" />
{/if}

<style>
	.rel-hover-glow {
		fill: none;
		stroke: #2563eb;
		stroke-linecap: round;
		stroke-linejoin: round;
		pointer-events: none;
	}

	.wide {
		stroke-width: 14;
		opacity: 0.4;
		filter: blur(6px);
	}

	.tight {
		stroke-width: 7;
		opacity: 0.85;
		filter: blur(2px);
	}
</style>
