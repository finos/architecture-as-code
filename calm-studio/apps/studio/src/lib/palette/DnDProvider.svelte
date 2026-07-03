<!-- SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<!--
  DnDProvider.svelte — Context wrapper that stores the currently dragged CALM node type.
  Wrap both NodePalette and CalmCanvas with this component so both can read/set
  the drag type through a shared Svelte context.

  Usage:
    <DnDProvider>
      <NodePalette />
      <CalmCanvas />
    </DnDProvider>

  Children access the context via useDnD():
    const { dragType, setDragType } = useDnD();
-->
<script lang="ts" module>
	import { getContext, setContext } from 'svelte';

	const DND_CONTEXT_KEY = 'calm-dnd-context';

	export interface DnDContext {
		/** Current drag type — null when nothing is being dragged. */
		dragType: string | null;
		/** Set the active drag type. Call with null on dragend. */
		setDragType: (type: string | null) => void;
	}

	/**
	 * Access the DnD context from any child of DnDProvider.
	 * Call this inside <script> blocks of palette/canvas components.
	 */
	export function useDnD(): DnDContext {
		return getContext<DnDContext>(DND_CONTEXT_KEY);
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	let dragType = $state<string | null>(null);

	setContext<DnDContext>(DND_CONTEXT_KEY, {
		get dragType() {
			return dragType;
		},
		setDragType(type: string | null) {
			dragType = type;
		},
	});
</script>

{@render children()}
