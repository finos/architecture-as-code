import type { AnalysisResult } from '@/lib/agents/orchestrator';
import type { AnalysisInput } from '@/lib/calm/extractor';

/**
 * Map internal framework enum value to display label.
 * 'CCC' → 'FINOS-CCC' per existing convention (Phase 04-04 decision).
 */
function frameworkLabel(fw: string): string {
  if (fw === 'CCC') return 'FINOS-CCC';
  return fw;
}

/**
 * Convert numeric score (0-100) to a human-readable risk rating label.
 */
function scoreToRating(score: number): string {
  if (score >= 80) return 'Low Risk';
  if (score >= 60) return 'Medium Risk';
  if (score >= 40) return 'High Risk';
  return 'Critical Risk';
}

/**
 * Generate a comprehensive branded markdown compliance report.
 *
 * Produces a self-contained markdown string suitable for download as a .md file.
 * All sections gracefully degrade when agent results are null/unavailable.
 *
 * @param analysisResult - Combined output from all 4 agents
 * @param analysisInput  - Structured CALM input metadata (node/relationship counts)
 * @param architectureName - Human-readable architecture name (e.g. 'Trading Platform')
 * @param date - ISO date string for report header (e.g. '2026-02-24')
 * @returns Formatted markdown report string
 */
export function generateMarkdownReport(
  analysisResult: AnalysisResult,
  analysisInput: AnalysisInput | null,
  architectureName: string,
  date: string,
): string {
  const { architecture, compliance, pipeline, risk } = analysisResult;

  const score = risk?.overallScore ?? null;
  const rating = score !== null ? scoreToRating(score) : 'Unknown';
  const durationSec = (analysisResult.duration / 1000).toFixed(1);

  const lines: string[] = [];

  // ──────────────────────────────────────────────────────────────────────────
  // Header
  // ──────────────────────────────────────────────────────────────────────────
  lines.push('# CALMGuard Compliance Report');
  lines.push('');
  lines.push('> CALMGuard — CALM-native continuous compliance platform');
  lines.push('> DTCC/FINOS Innovate.DTCC AI Hackathon 2026');
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(`**Architecture:** ${architectureName}`);
  lines.push(`**Analysis Date:** ${date}`);
  lines.push(
    score !== null
      ? `**Overall Score:** ${score}/100 (${rating})`
      : '**Overall Score:** Analysis incomplete',
  );
  lines.push(
    `**Agents:** ${analysisResult.completedAgents.length}/${analysisResult.completedAgents.length + analysisResult.failedAgents.length} succeeded in ${durationSec}s`,
  );
  lines.push('');

  // ──────────────────────────────────────────────────────────────────────────
  // Executive Summary
  // ──────────────────────────────────────────────────────────────────────────
  lines.push('## Executive Summary');
  lines.push('');
  if (risk?.executiveSummary) {
    lines.push(risk.executiveSummary);
  } else {
    lines.push('Risk assessment unavailable — risk scorer did not complete successfully.');
  }
  lines.push('');

  // ──────────────────────────────────────────────────────────────────────────
  // Architecture Overview
  // ──────────────────────────────────────────────────────────────────────────
  lines.push('## Architecture Overview');
  lines.push('');
  if (analysisInput) {
    lines.push(`- **Nodes:** ${analysisInput.metadata.nodeCount}`);
    lines.push(`- **Relationships:** ${analysisInput.metadata.relationshipCount}`);
    lines.push(`- **Flows:** ${analysisInput.metadata.flowCount}`);
    lines.push(`- **Controls:** ${analysisInput.metadata.controlCount}`);

    const nodeTypes = Object.entries(analysisInput.metadata.nodeTypes)
      .map(([type, count]) => `${type} (${count})`)
      .join(', ');
    if (nodeTypes) {
      lines.push(`- **Node Types:** ${nodeTypes}`);
    }

    const protocols = analysisInput.metadata.protocols;
    if (protocols.length > 0) {
      lines.push(`- **Protocols:** ${protocols.join(', ')}`);
    }
  } else if (architecture) {
    lines.push(`- **Nodes:** ${architecture.summary}`);
  } else {
    lines.push('Architecture data unavailable.');
  }
  lines.push('');

  // ──────────────────────────────────────────────────────────────────────────
  // Compliance Findings by Framework
  // ──────────────────────────────────────────────────────────────────────────
  lines.push('## Compliance Findings by Framework');
  lines.push('');
  if (compliance?.frameworkScores && compliance.frameworkScores.length > 0) {
    for (const fs of compliance.frameworkScores) {
      lines.push(`### ${frameworkLabel(fs.framework)}`);
      lines.push('');
      lines.push(`- **Score:** ${fs.score}%`);
      lines.push(`- **Compliant:** ${fs.compliantControls}/${fs.totalControls} controls`);
      if (fs.partialControls > 0) {
        lines.push(`- **Partial:** ${fs.partialControls} controls`);
      }
      if (fs.nonCompliantControls > 0) {
        lines.push(`- **Non-Compliant:** ${fs.nonCompliantControls} controls`);
      }
      lines.push('');
    }
  } else {
    lines.push('Compliance mapping data unavailable.');
    lines.push('');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Top Findings
  // ──────────────────────────────────────────────────────────────────────────
  lines.push('## Top Findings');
  lines.push('');
  if (risk?.topFindings && risk.topFindings.length > 0) {
    risk.topFindings.forEach((finding, i) => {
      const fw = finding.framework ? ` [${frameworkLabel(finding.framework)}]` : '';
      lines.push(`${i + 1}. **[${finding.severity.toUpperCase()}]${fw}** ${finding.finding}`);
      if (finding.affectedNodes.length > 0) {
        lines.push(`   - *Affected nodes:* ${finding.affectedNodes.join(', ')}`);
      }
      lines.push(`   - *Recommendation:* ${finding.recommendation}`);
    });
  } else if (compliance?.gaps && compliance.gaps.length > 0) {
    compliance.gaps.forEach((gap, i) => {
      lines.push(`${i + 1}. **[${gap.severity.toUpperCase()}] [${frameworkLabel(gap.framework)}]** ${gap.missingControl}`);
      lines.push(`   - *${gap.description}*`);
      lines.push(`   - *Recommendation:* ${gap.recommendation}`);
    });
  } else {
    lines.push('No findings recorded.');
  }
  lines.push('');

  // ──────────────────────────────────────────────────────────────────────────
  // Per-Framework Risk Scores (from Risk Scorer)
  // ──────────────────────────────────────────────────────────────────────────
  if (risk?.frameworkScores && risk.frameworkScores.length > 0) {
    lines.push('## Risk Scores by Framework');
    lines.push('');
    lines.push('| Framework | Score | Rating |');
    lines.push('|-----------|-------|--------|');
    for (const fs of risk.frameworkScores) {
      lines.push(`| ${frameworkLabel(fs.framework)} | ${fs.score}/100 | ${fs.rating} |`);
    }
    lines.push('');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Generated Pipeline
  // ──────────────────────────────────────────────────────────────────────────
  lines.push('## Generated Pipeline');
  lines.push('');
  if (pipeline?.githubActions?.yaml) {
    const yamlPreview = pipeline.githubActions.yaml.slice(0, 2000);
    const truncated = pipeline.githubActions.yaml.length > 2000;
    lines.push('```yaml');
    lines.push(yamlPreview);
    if (truncated) {
      lines.push('# ... (truncated for report preview)');
    }
    lines.push('```');
    lines.push('');
    if (pipeline.securityScanning?.tools && pipeline.securityScanning.tools.length > 0) {
      lines.push(`**Security Scanning Tools:** ${pipeline.securityScanning.tools.join(', ')}`);
      lines.push('');
    }
  } else {
    lines.push('Pipeline generation data unavailable.');
    lines.push('');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Actionable Recommendations
  // ──────────────────────────────────────────────────────────────────────────
  lines.push('## Actionable Recommendations');
  lines.push('');
  const recommendations: string[] = [];

  // Collect from pipeline (recommendations are objects with .recommendation field)
  if (pipeline?.recommendations && pipeline.recommendations.length > 0) {
    recommendations.push(...pipeline.recommendations.map((r) => r.recommendation));
  }

  // Collect from risk findings
  if (risk?.topFindings) {
    for (const finding of risk.topFindings) {
      if (finding.recommendation && !recommendations.includes(finding.recommendation)) {
        recommendations.push(finding.recommendation);
      }
    }
  }

  if (recommendations.length > 0) {
    recommendations.forEach((rec, i) => {
      lines.push(`${i + 1}. ${rec}`);
    });
  } else {
    lines.push('No specific recommendations available — run a full analysis for actionable guidance.');
  }
  lines.push('');

  // ──────────────────────────────────────────────────────────────────────────
  // Failed Agents Warning
  // ──────────────────────────────────────────────────────────────────────────
  if (analysisResult.failedAgents.length > 0) {
    lines.push('## Analysis Notes');
    lines.push('');
    lines.push(
      `> **Warning:** The following agents did not complete successfully: ${analysisResult.failedAgents.join(', ')}. Some sections of this report may be incomplete.`,
    );
    lines.push('');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Footer
  // ──────────────────────────────────────────────────────────────────────────
  lines.push('---');
  lines.push('');
  lines.push(`*Generated by CALMGuard on ${date}*`);
  lines.push('');
  lines.push('*CALMGuard — CALM-native continuous compliance platform*');
  lines.push('*Built for the DTCC/FINOS Innovate.DTCC AI Hackathon 2026*');

  return lines.join('\n');
}
