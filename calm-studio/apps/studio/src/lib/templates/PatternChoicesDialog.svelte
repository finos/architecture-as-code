<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<script lang="ts">
	import type { CalmChoice, CalmOption } from '@finos/calm-shared/generate';

	interface Props {
		patternName: string;
		options: CalmOption[];
		onconfirm: (choices: CalmChoice[]) => void;
		oncancel: () => void;
	}

	let { patternName, options, onconfirm, oncancel }: Props = $props();

	let selected = $state<Record<string, number>>(
		Object.fromEntries(options.map((o) => [o.optionId, 0]))
	);

	function submit() {
		const choices: CalmChoice[] = options.map((o) => o.choices[selected[o.optionId] ?? 0]!).filter(Boolean);
		onconfirm(choices);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			oncancel();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="backdrop" role="presentation">
	<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="gen-title">
		<h2 id="gen-title" class="title">Generate from pattern</h2>
		<p class="hint">Pattern: {patternName}</p>
		{#each options as opt (opt.optionId)}
			<fieldset class="opt">
				<legend>{opt.prompt || opt.optionId}</legend>
				{#each opt.choices as choice, i (choice.description)}
					<label class="radio">
						<input type="radio" bind:group={selected[opt.optionId]} value={i} />
						{choice.description}
					</label>
				{/each}
			</fieldset>
		{/each}
		<div class="actions">
			<button type="button" class="btn" onclick={oncancel}>Cancel</button>
			<button type="button" class="btn primary" onclick={submit}>Generate</button>
		</div>
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 10000;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(15, 23, 42, 0.45);
	}
	.dialog {
		width: min(480px, calc(100vw - 32px));
		max-height: calc(100vh - 48px);
		overflow: auto;
		padding: 18px 20px;
		border-radius: 10px;
		background: var(--color-surface, #fff);
		border: 1px solid var(--color-border, #e2e8f0);
	}
	.title {
		margin: 0 0 6px;
		font-size: 15px;
		font-weight: 600;
	}
	.hint {
		margin: 0 0 12px;
		font-size: 12px;
		color: #64748b;
	}
	.opt {
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		margin: 0 0 10px;
		padding: 8px 10px;
	}
	.radio {
		display: flex;
		gap: 8px;
		font-size: 13px;
		margin: 4px 0;
		cursor: pointer;
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 8px;
	}
	.btn {
		padding: 7px 14px;
		border-radius: 6px;
		border: 1px solid #cbd5e1;
		background: #fff;
		font-size: 12px;
		cursor: pointer;
	}
	.btn.primary {
		background: #2563eb;
		border-color: #2563eb;
		color: #fff;
	}
</style>
