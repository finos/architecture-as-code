<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<!--
  GovernancePanel.svelte — AIGF governance right sidebar panel.

  Displays applicable AIGF risks and recommended mitigations for the selected AI node.
  "Apply" buttons add CALM controls to the node. Governance score shows in the header.

  Layout:
  - Panel header: architecture-level score badge + unmitigated count
  - Risks section: applicable risks with severity badges (OP=amber, SEC=red, RC=blue)
  - Mitigations section: recommended mitigations with Apply buttons
  - Empty state: shown when non-AI node (or nothing) selected
-->

<script lang="ts">
	import {
		getArchitectureScore,
		hasAINodes,
		getSelectedNodeGovernance,
		refreshGovernance,
		updateSelectedNodeGovernance,
	} from '$lib/stores/governance.svelte';
	import { getModel, updateNodeProperty } from '$lib/stores/calmModel.svelte';
	import type { AIGFRisk, AIGFMitigation } from '@calmstudio/calm-core';
	import type { CalmControls } from '@calmstudio/calm-core';

	let {
		selectedNodeId = null,
		selectedNodeType = null,
		onBeforeFirstEdit,
		onmutate,
	}: {
		selectedNodeId?: string | null;
		selectedNodeType?: string | null;
		onBeforeFirstEdit?: () => void;
		onmutate?: () => void;
	} = $props();

	// Reactive derived from governance store
	const governance = $derived(getSelectedNodeGovernance());
	const score = $derived(getArchitectureScore());
	const showBadge = $derived(hasAINodes());

	const risks = $derived(governance.risks);
	const mitigations = $derived(governance.mitigations);
	const nodeControls = $derived(governance.nodeControls ?? {});

	// Count unmitigated recommendations for header
	const unmitigatedCount = $derived(
		mitigations.filter((m: AIGFMitigation) => !nodeControls[m.calmControlKey]).length
	);

	const isAINodeSelected = $derived(
		selectedNodeId !== null && risks.length > 0 || mitigations.length > 0
	);

	// Track expanded descriptions
	let expandedRisks = $state<Set<string>>(new Set());
	let expandedRiskRefs = $state<Set<string>>(new Set());
	let expandedMitigationRefs = $state<Set<string>>(new Set());

	function toggleRiskExpand(id: string) {
		expandedRisks = new Set(
			expandedRisks.has(id)
				? [...expandedRisks].filter((x) => x !== id)
				: [...expandedRisks, id]
		);
	}

	function toggleRiskRefs(id: string) {
		expandedRiskRefs = new Set(
			expandedRiskRefs.has(id)
				? [...expandedRiskRefs].filter((x) => x !== id)
				: [...expandedRiskRefs, id]
		);
	}

	function toggleMitigationRefs(id: string) {
		expandedMitigationRefs = new Set(
			expandedMitigationRefs.has(id)
				? [...expandedMitigationRefs].filter((x) => x !== id)
				: [...expandedMitigationRefs, id]
		);
	}

	/** Apply a mitigation as a CALM control on the selected node. */
	function applyMitigation(mitigation: AIGFMitigation) {
		if (!selectedNodeId) return;

		// 1. Snapshot for undo
		onBeforeFirstEdit?.();

		// 2. Get current controls
		const arch = getModel();
		const node = arch.nodes.find((n) => n['unique-id'] === selectedNodeId);
		const existing = (node as { controls?: CalmControls } | undefined)?.controls ?? {};

		// 3. Build new control entry
		const newControl = {
			description: `${mitigation.title} (AIGF ${mitigation.id})`,
			requirements: [
				{
					'requirement-url': `https://air-governance-framework.finos.org/mitigations/${mitigation.id}`,
				},
			],
		};

		// 4. Merge and apply
		const merged = { ...existing, [mitigation.calmControlKey]: newControl };
		updateNodeProperty(selectedNodeId, 'controls', merged);

		// 5. Notify parent (re-projects canvas + code panel)
		onmutate?.();

		// 6. Refresh governance score
		refreshGovernance();

		// 7. Refresh local node governance state
		updateSelectedNodeGovernance(selectedNodeType, selectedNodeId);
	}

	/** Risk type → color mapping */
	function riskTypeColor(type: string): string {
		switch (type) {
			case 'SEC': return '#ef4444';
			case 'OP':  return '#f59e0b';
			case 'RC':  return '#3b82f6';
			default:    return '#6b7280';
		}
	}

	function riskTypeBg(type: string): string {
		switch (type) {
			case 'SEC': return 'rgba(239,68,68,0.12)';
			case 'OP':  return 'rgba(245,158,11,0.12)';
			case 'RC':  return 'rgba(59,130,246,0.12)';
			default:    return 'rgba(107,114,128,0.12)';
		}
	}

	function riskTypeLabel(type: string): string {
		switch (type) {
			case 'SEC': return 'Security';
			case 'OP':  return 'Operational';
			case 'RC':  return 'Regulatory';
			default:    return type;
		}
	}

	/** Collect top 3 external ref labels for a risk or mitigation */
	function topRefs(refs: Record<string, string[] | undefined>): { key: string; value: string }[] {
		const ordered = ['euAiAct', 'owaspLlm', 'iso42001', 'nistAi600', 'ffiec', 'nistSp80053r5', 'mitreAtlas', 'owaspMl'];
		const labels: Record<string, string> = {
			euAiAct: 'EU AI Act',
			owaspLlm: 'OWASP LLM',
			iso42001: 'ISO 42001',
			nistAi600: 'NIST AI 600',
			ffiec: 'FFIEC',
			nistSp80053r5: 'NIST SP 800-53',
			mitreAtlas: 'MITRE ATLAS',
			owaspMl: 'OWASP ML',
		};
		const result: { key: string; value: string }[] = [];
		for (const k of ordered) {
			const v = refs[k as keyof typeof refs];
			if (v && v.length > 0 && result.length < 3) {
				result.push({ key: labels[k] ?? k, value: v[0] });
			}
		}
		return result;
	}

	function allRefs(refs: Record<string, string[] | undefined>): { key: string; values: string[] }[] {
		const labels: Record<string, string> = {
			euAiAct: 'EU AI Act',
			owaspLlm: 'OWASP LLM Top 10',
			iso42001: 'ISO 42001',
			nistAi600: 'NIST AI 600',
			ffiec: 'FFIEC',
			nistSp80053r5: 'NIST SP 800-53',
			mitreAtlas: 'MITRE ATLAS',
			owaspMl: 'OWASP ML Top 10',
		};
		return Object.entries(refs)
			.filter(([, v]) => v && v.length > 0)
			.map(([k, v]) => ({ key: labels[k] ?? k, values: v as string[] }));
	}

	/** Score color */
	function scoreColor(s: number | null): string {
		if (s === null) return '#6b7280';
		if (s > 80) return '#16a34a';
		if (s >= 50) return '#d97706';
		return '#dc2626';
	}
</script>

<div class="governance-panel">
	<!-- Panel header: architecture score + unmitigated count -->
	<div class="panel-header">
		<div class="header-title">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
				<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
			</svg>
			<span>AIGF Governance</span>
		</div>

		{#if showBadge && score !== null}
			<div class="score-badge" style="background: {scoreColor(score)}20; color: {scoreColor(score)}; border-color: {scoreColor(score)}40">
				<span class="score-value">{score}%</span>
				<span class="score-label">coverage</span>
			</div>
		{/if}
	</div>

	<!-- Content area -->
	{#if !selectedNodeId || (risks.length === 0 && mitigations.length === 0)}
		<!-- Empty state -->
		<div class="empty-state">
			<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="empty-icon" aria-hidden="true">
				<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
			</svg>
			<p class="empty-text">
				{#if !selectedNodeId}
					Select an AI node to view governance recommendations
				{:else}
					No governance recommendations for this node type
				{/if}
			</p>
		</div>
	{:else}
		<!-- Unmitigated count summary -->
		{#if unmitigatedCount > 0}
			<div class="unmitigated-banner">
				<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
					<circle cx="12" cy="12" r="10" />
					<line x1="12" y1="8" x2="12" y2="12" />
					<line x1="12" y1="16" x2="12.01" y2="16" />
				</svg>
				{unmitigatedCount} unmitigated recommendation{unmitigatedCount !== 1 ? 's' : ''}
			</div>
		{:else}
			<div class="all-applied-banner">
				<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
					<path d="M20 6L9 17l-5-5" />
				</svg>
				All recommendations applied
			</div>
		{/if}

		<!-- Risks section -->
		{#if risks.length > 0}
			<div class="section">
				<div class="section-header">
					<span class="section-title">Applicable Risks</span>
					<span class="section-count">{risks.length}</span>
				</div>
				<div class="section-body">
					{#each risks as risk (risk.id)}
						<div class="risk-card">
							<div class="risk-header">
								<div class="risk-title-row">
									<span
										class="type-badge"
										style="color: {riskTypeColor(risk.type)}; background: {riskTypeBg(risk.type)};"
										title={riskTypeLabel(risk.type)}
									>
										{risk.type}
									</span>
									<span class="risk-id">{risk.id}</span>
								</div>
								<button
									type="button"
									class="expand-btn"
									onclick={() => toggleRiskExpand(risk.id)}
									aria-label={expandedRisks.has(risk.id) ? 'Collapse risk description' : 'Expand risk description'}
								>
									<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true" class:rotated={expandedRisks.has(risk.id)}>
										<polyline points="6 9 12 15 18 9" />
									</svg>
								</button>
							</div>
							<p class="risk-title">{risk.title}</p>

							{#if expandedRisks.has(risk.id)}
								<p class="risk-desc">{risk.description}</p>
							{/if}

							<!-- External refs: top 3 inline, "Show all" expander -->
							{#if topRefs(risk.externalRefs as Record<string, string[] | undefined>).length > 0}
								<div class="refs-row">
									{#each topRefs(risk.externalRefs as Record<string, string[] | undefined>) as ref}
										<span class="ref-chip" title={ref.value}>{ref.key}</span>
									{/each}
									{#if allRefs(risk.externalRefs as Record<string, string[] | undefined>).length > topRefs(risk.externalRefs as Record<string, string[] | undefined>).length}
										<button
											type="button"
											class="show-all-btn"
											onclick={() => toggleRiskRefs(risk.id)}
										>
											{expandedRiskRefs.has(risk.id) ? 'Hide' : `+${allRefs(risk.externalRefs as Record<string, string[] | undefined>).length - topRefs(risk.externalRefs as Record<string, string[] | undefined>).length} more`}
										</button>
									{/if}
								</div>
								{#if expandedRiskRefs.has(risk.id)}
									<div class="refs-full">
										{#each allRefs(risk.externalRefs as Record<string, string[] | undefined>) as ref}
											<div class="ref-full-row">
												<span class="ref-full-key">{ref.key}</span>
												<span class="ref-full-values">{ref.values.join(', ')}</span>
											</div>
										{/each}
									</div>
								{/if}
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Mitigations section -->
		{#if mitigations.length > 0}
			<div class="section">
				<div class="section-header">
					<span class="section-title">Recommended Mitigations</span>
					<span class="section-count">{mitigations.length}</span>
				</div>
				<div class="section-body">
					{#each mitigations as mitigation (mitigation.id)}
						{@const isApplied = nodeControls[mitigation.calmControlKey] !== undefined}
						<div class="mitigation-card" class:applied={isApplied}>
							<div class="mitigation-header">
								<div class="mitigation-title-row">
									<!-- Type icon: PREV = shield, DET = magnifier -->
									{#if mitigation.type === 'PREV'}
										<svg class="mit-type-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-label="Preventive" title="Preventive">
											<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
										</svg>
									{:else}
										<svg class="mit-type-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-label="Detective" title="Detective">
											<circle cx="11" cy="11" r="8" />
											<line x1="21" y1="21" x2="16.65" y2="16.65" />
										</svg>
									{/if}
									<span class="mitigation-id">{mitigation.id}</span>
								</div>

								{#if isApplied}
									<span class="applied-check" aria-label="Applied">
										<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
											<path d="M20 6L9 17l-5-5" />
										</svg>
										Applied
									</span>
								{:else}
									<button
										type="button"
										class="apply-btn"
										onclick={() => applyMitigation(mitigation)}
									>
										Apply
									</button>
								{/if}
							</div>

							<p class="mitigation-title">{mitigation.title}</p>
							<p class="mitigation-desc">{mitigation.description}</p>
							<p class="mitigation-key-hint">Control key: <code>{mitigation.calmControlKey}</code></p>

							<!-- External refs: top 3 inline -->
							{#if topRefs(mitigation.externalRefs as Record<string, string[] | undefined>).length > 0}
								<div class="refs-row">
									{#each topRefs(mitigation.externalRefs as Record<string, string[] | undefined>) as ref}
										<span class="ref-chip" title={ref.value}>{ref.key}</span>
									{/each}
									{#if allRefs(mitigation.externalRefs as Record<string, string[] | undefined>).length > topRefs(mitigation.externalRefs as Record<string, string[] | undefined>).length}
										<button
											type="button"
											class="show-all-btn"
											onclick={() => toggleMitigationRefs(mitigation.id)}
										>
											{expandedMitigationRefs.has(mitigation.id) ? 'Hide' : `+${allRefs(mitigation.externalRefs as Record<string, string[] | undefined>).length - topRefs(mitigation.externalRefs as Record<string, string[] | undefined>).length} more`}
										</button>
									{/if}
								</div>
								{#if expandedMitigationRefs.has(mitigation.id)}
									<div class="refs-full">
										{#each allRefs(mitigation.externalRefs as Record<string, string[] | undefined>) as ref}
											<div class="ref-full-row">
												<span class="ref-full-key">{ref.key}</span>
												<span class="ref-full-values">{ref.values.join(', ')}</span>
											</div>
										{/each}
									</div>
								{/if}
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>

<style>
	/* ─── Panel wrapper ──────────────────────────────────────────── */

	.governance-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow-y: auto;
		font-family: var(--font-sans, system-ui, sans-serif);
		font-size: 12px;
		color: var(--color-text-primary, #0f172a);
	}

	:global(.dark) .governance-panel {
		color: #e2e8f0;
	}

	/* ─── Panel header ───────────────────────────────────────────── */

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 12px 8px;
		border-bottom: 1px solid var(--color-border, #e2e8f0);
		flex-shrink: 0;
	}

	:global(.dark) .panel-header {
		border-color: #1e293b;
	}

	.header-title {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-text-secondary, #64748b);
	}

	:global(.dark) .header-title {
		color: #94a3b8;
	}

	.score-badge {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 2px 8px;
		border-radius: 12px;
		border: 1px solid;
		font-size: 11px;
		font-weight: 700;
	}

	.score-value {
		font-variant-numeric: tabular-nums;
	}

	.score-label {
		font-size: 9px;
		font-weight: 500;
		opacity: 0.8;
	}

	/* ─── Empty state ────────────────────────────────────────────── */

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 40px 20px;
		gap: 12px;
		flex: 1;
	}

	.empty-icon {
		color: var(--color-text-tertiary, #94a3b8);
		opacity: 0.5;
	}

	.empty-text {
		font-size: 12px;
		color: var(--color-text-tertiary, #94a3b8);
		text-align: center;
		line-height: 1.5;
		margin: 0;
	}

	/* ─── Banners ────────────────────────────────────────────────── */

	.unmitigated-banner {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		background: rgba(239, 68, 68, 0.08);
		color: #dc2626;
		font-size: 11px;
		font-weight: 500;
		border-bottom: 1px solid rgba(239, 68, 68, 0.15);
	}

	:global(.dark) .unmitigated-banner {
		background: rgba(239, 68, 68, 0.15);
		color: #fca5a5;
		border-color: rgba(239, 68, 68, 0.25);
	}

	.all-applied-banner {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		background: rgba(22, 163, 74, 0.08);
		color: #16a34a;
		font-size: 11px;
		font-weight: 500;
		border-bottom: 1px solid rgba(22, 163, 74, 0.15);
	}

	:global(.dark) .all-applied-banner {
		background: rgba(22, 163, 74, 0.15);
		color: #86efac;
		border-color: rgba(22, 163, 74, 0.25);
	}

	/* ─── Sections ───────────────────────────────────────────────── */

	.section {
		border-bottom: 1px solid var(--color-border, #e2e8f0);
	}

	:global(.dark) .section {
		border-color: #1e293b;
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 12px 6px;
		background: var(--color-surface-secondary, #f8fafc);
	}

	:global(.dark) .section-header {
		background: #0b0f1a;
	}

	.section-title {
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-text-secondary, #64748b);
	}

	:global(.dark) .section-title {
		color: #94a3b8;
	}

	.section-count {
		font-size: 10px;
		font-weight: 700;
		color: var(--color-text-tertiary, #94a3b8);
		background: var(--color-surface, #fff);
		border: 1px solid var(--color-border, #e2e8f0);
		border-radius: 8px;
		padding: 0 5px;
		min-width: 18px;
		text-align: center;
	}

	:global(.dark) .section-count {
		background: #111827;
		border-color: #334155;
		color: #64748b;
	}

	.section-body {
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	/* ─── Risk cards ─────────────────────────────────────────────── */

	.risk-card {
		padding: 8px 12px;
		border-bottom: 1px solid var(--color-border, #e2e8f0);
	}

	.risk-card:last-child {
		border-bottom: none;
	}

	:global(.dark) .risk-card {
		border-color: #1e293b;
	}

	.risk-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 4px;
	}

	.risk-title-row {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.type-badge {
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.05em;
		padding: 1px 5px;
		border-radius: 3px;
		flex-shrink: 0;
	}

	.risk-id {
		font-size: 10px;
		font-weight: 600;
		color: var(--color-text-tertiary, #94a3b8);
		font-family: monospace;
	}

	:global(.dark) .risk-id {
		color: #64748b;
	}

	.risk-title {
		font-size: 12px;
		font-weight: 500;
		color: var(--color-text-primary, #0f172a);
		margin: 0 0 4px;
		line-height: 1.4;
	}

	:global(.dark) .risk-title {
		color: #e2e8f0;
	}

	.risk-desc {
		font-size: 11px;
		color: var(--color-text-secondary, #64748b);
		margin: 0 0 6px;
		line-height: 1.5;
	}

	:global(.dark) .risk-desc {
		color: #94a3b8;
	}

	.expand-btn {
		background: none;
		border: none;
		cursor: pointer;
		padding: 2px;
		color: var(--color-text-tertiary, #94a3b8);
		display: flex;
		align-items: center;
		border-radius: 3px;
	}

	.expand-btn:hover {
		background: var(--color-surface-tertiary, #f1f5f9);
	}

	:global(.dark) .expand-btn:hover {
		background: #1e293b;
	}

	.expand-btn svg {
		transition: transform 0.15s ease;
	}

	.expand-btn svg.rotated {
		transform: rotate(180deg);
	}

	/* ─── Mitigation cards ───────────────────────────────────────── */

	.mitigation-card {
		padding: 8px 12px;
		border-bottom: 1px solid var(--color-border, #e2e8f0);
		transition: background 0.1s ease;
	}

	.mitigation-card:last-child {
		border-bottom: none;
	}

	.mitigation-card.applied {
		background: rgba(22, 163, 74, 0.04);
	}

	:global(.dark) .mitigation-card {
		border-color: #1e293b;
	}

	:global(.dark) .mitigation-card.applied {
		background: rgba(22, 163, 74, 0.08);
	}

	.mitigation-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 4px;
	}

	.mitigation-title-row {
		display: flex;
		align-items: center;
		gap: 5px;
	}

	.mit-type-icon {
		color: var(--color-text-tertiary, #94a3b8);
		flex-shrink: 0;
	}

	:global(.dark) .mit-type-icon {
		color: #64748b;
	}

	.mitigation-id {
		font-size: 10px;
		font-weight: 600;
		color: var(--color-text-tertiary, #94a3b8);
		font-family: monospace;
	}

	:global(.dark) .mitigation-id {
		color: #64748b;
	}

	.mitigation-title {
		font-size: 12px;
		font-weight: 500;
		color: var(--color-text-primary, #0f172a);
		margin: 0 0 3px;
		line-height: 1.4;
	}

	:global(.dark) .mitigation-title {
		color: #e2e8f0;
	}

	.mitigation-desc {
		font-size: 11px;
		color: var(--color-text-secondary, #64748b);
		margin: 0 0 4px;
		line-height: 1.5;
	}

	:global(.dark) .mitigation-desc {
		color: #94a3b8;
	}

	.mitigation-key-hint {
		font-size: 10px;
		color: var(--color-text-tertiary, #94a3b8);
		margin: 0 0 4px;
	}

	.mitigation-key-hint code {
		font-family: monospace;
		background: var(--color-surface-secondary, #f8fafc);
		padding: 1px 4px;
		border-radius: 3px;
	}

	:global(.dark) .mitigation-key-hint {
		color: #64748b;
	}

	:global(.dark) .mitigation-key-hint code {
		background: #111827;
	}

	/* Apply button */

	.apply-btn {
		padding: 3px 10px;
		height: 22px;
		border-radius: 4px;
		border: 1px solid #3b82f6;
		background: rgba(59, 130, 246, 0.08);
		color: #3b82f6;
		font-size: 11px;
		font-weight: 600;
		font-family: var(--font-sans, system-ui, sans-serif);
		cursor: pointer;
		transition: all 0.12s ease;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.apply-btn:hover {
		background: #3b82f6;
		color: #fff;
	}

	:global(.dark) .apply-btn {
		border-color: #60a5fa;
		background: rgba(96, 165, 250, 0.1);
		color: #60a5fa;
	}

	:global(.dark) .apply-btn:hover {
		background: #60a5fa;
		color: #0f172a;
	}

	/* Applied check badge */

	.applied-check {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 11px;
		font-weight: 600;
		color: #16a34a;
		flex-shrink: 0;
	}

	:global(.dark) .applied-check {
		color: #86efac;
	}

	/* ─── External refs ──────────────────────────────────────────── */

	.refs-row {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-top: 4px;
		align-items: center;
	}

	.ref-chip {
		font-size: 9px;
		font-weight: 600;
		padding: 1px 6px;
		border-radius: 3px;
		background: var(--color-surface-secondary, #f8fafc);
		border: 1px solid var(--color-border, #e2e8f0);
		color: var(--color-text-secondary, #64748b);
		white-space: nowrap;
	}

	:global(.dark) .ref-chip {
		background: #111827;
		border-color: #334155;
		color: #94a3b8;
	}

	.show-all-btn {
		background: none;
		border: none;
		padding: 0 4px;
		font-size: 9px;
		font-weight: 600;
		color: #3b82f6;
		cursor: pointer;
		font-family: inherit;
	}

	.show-all-btn:hover {
		text-decoration: underline;
	}

	:global(.dark) .show-all-btn {
		color: #60a5fa;
	}

	.refs-full {
		margin-top: 4px;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.ref-full-row {
		display: flex;
		gap: 8px;
		font-size: 10px;
	}

	.ref-full-key {
		font-weight: 600;
		color: var(--color-text-secondary, #64748b);
		min-width: 90px;
		flex-shrink: 0;
	}

	:global(.dark) .ref-full-key {
		color: #94a3b8;
	}

	.ref-full-values {
		color: var(--color-text-tertiary, #94a3b8);
		font-family: monospace;
	}

	:global(.dark) .ref-full-values {
		color: #64748b;
	}
</style>
