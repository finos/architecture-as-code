<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script lang="ts">
	import { getContext } from 'svelte';
	import ReferenceGlasses from './ReferenceGlasses.svelte';

	type ReferenceNavContext = {
		onNavigateReference: (calmId: string) => void;
	};

	let {
		data,
		placement = 'overlay',
	}: {
		data: Record<string, unknown>;
		placement?: 'overlay' | 'inline';
	} = $props();

	const ctx = getContext<ReferenceNavContext | undefined>('referenceNavigation');
	const details = $derived(data.calmDetails as Record<string, unknown> | undefined);
	const isReference = $derived(
		Boolean(data.isReference) ||
			(typeof details?.['detailed-architecture'] === 'string' &&
				details['detailed-architecture'].length > 0)
	);
	const calmId = $derived(String(data.calmId ?? ''));
</script>

{#if isReference && ctx}
	<ReferenceGlasses
		{placement}
		ondblclick={() => ctx.onNavigateReference(calmId)}
	/>
{/if}
