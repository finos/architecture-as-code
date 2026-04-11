<!-- SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { initTheme } from '$lib/stores/theme.svelte';

	let { children } = $props();

	// Initialize theme before first render to avoid flash of unstyled content.
	// Must run in onMount for DOM access (localStorage, matchMedia).
	onMount(() => {
		initTheme();
	});
</script>

{@render children()}
