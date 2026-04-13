'use client';

import { useEffect, useState } from 'react';
import { Copy, Check, Download, AlertTriangle, Maximize2, X } from 'lucide-react';
import { codeToHtml } from 'shiki/bundle/web';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAnalysisStore } from '@/store/analysis-store';
import type { PipelineConfig } from '@/lib/agents/pipeline-generator';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PipelinePreviewProps {
  /** Compact mode for overview page — limits height, hides download button */
  compact?: boolean;
}

// ---------------------------------------------------------------------------
// Helper — derive raw content per tab
// ---------------------------------------------------------------------------

/**
 * Normalize code content from LLM output.
 * LLMs sometimes return YAML/HCL as a single line, with literal escaped
 * newlines (\\n), markdown fenced code block markers, or other oddities.
 * This function aggressively restores proper multi-line formatting.
 */
function normalizeCode(raw: string): string {
  let code = raw;

  // Strip markdown fenced code block markers (```yaml ... ```)
  code = code.replace(/^```[\w-]*\n?/gm, '').replace(/\n?```$/gm, '');

  // Replace literal escaped newlines with real newlines (\\n → \n)
  code = code.replace(/\\n/g, '\n');

  // Replace literal escaped tabs with spaces
  code = code.replace(/\\t/g, '  ');

  // Replace literal escaped quotes that some LLMs produce
  code = code.replace(/\\"/g, '"');

  // If content is still essentially one line (no real newlines or very few),
  // attempt to inject newlines before common YAML/HCL structural keywords.
  // This catches cases where the LLM flattened everything to a single string.
  const lineCount = code.split('\n').length;
  const contentLength = code.length;

  if (lineCount <= 3 && contentLength > 100) {
    // YAML patterns: inject newline before top-level keys
    code = code
      // YAML top-level keys (name:, on:, jobs:, steps:, runs-on:, etc.)
      .replace(/\s+(name|on|jobs|steps|runs-on|uses|with|env|services|strategy|permissions|concurrency|defaults|timeout-minutes|if|needs|outputs|container|volumes):/g, '\n$1:')
      // YAML list items
      .replace(/\s+- /g, '\n- ')
      // HCL blocks: resource, variable, provider, data, output, locals, terraform
      .replace(/\s+(resource|variable|provider|data|output|locals|terraform|module)\s+/g, '\n$1 ')
      // HCL closing braces on same line
      .replace(/\}\s*\{/g, '}\n{')
      .replace(/\}\s+(resource|variable|provider|data|output|locals|terraform|module)/g, '}\n\n$1')
      // Insert newlines before closing braces that aren't already on their own line
      .replace(/([^\n])\}/g, '$1\n}');
  }

  // Collapse multiple blank lines into a single blank line
  code = code.replace(/\n{3,}/g, '\n\n');

  return code.trim();
}

/**
 * Ensure shiki HTML has newlines between <span class="line"> elements.
 * Some shiki bundles emit all line spans on a single HTML line, which breaks
 * <pre> whitespace rendering and the typewriter line-splitting logic.
 */
function ensureLineBreaks(html: string): string {
  return html.replace(/<\/span><span class="line">/g, '</span>\n<span class="line">');
}

function getRawContent(tab: string, pipelineConfig: PipelineConfig): string {
  switch (tab) {
    case 'github':
      return normalizeCode(pipelineConfig.githubActions.yaml);
    case 'security':
      return pipelineConfig.securityScanning.tools
        .map((t) => `# ${t.name}\n${normalizeCode(t.config)}`)
        .join('\n---\n');
    case 'infra':
      return normalizeCode(pipelineConfig.infrastructureAsCode.config);
    default:
      return '';
  }
}

function getFilename(tab: string, pipelineConfig: PipelineConfig): string {
  switch (tab) {
    case 'github':
      return 'github-actions.yml';
    case 'security':
      return 'security-scanning.yml';
    case 'infra':
      return `infrastructure.${pipelineConfig.infrastructureAsCode.provider === 'terraform' ? 'tf' : 'yml'}`;
    default:
      return 'pipeline.yml';
  }
}

// ---------------------------------------------------------------------------
// Skeleton code block — shown while shiki is loading
// ---------------------------------------------------------------------------

function CodeSkeleton() {
  return (
    <div className="p-4 space-y-2 font-mono text-xs">
      <Skeleton className="h-3 w-1/4 bg-slate-700/50" />
      <Skeleton className="h-3 w-1/3 bg-slate-700/50" />
      <Skeleton className="h-3 w-2/5 bg-slate-700/50" />
      <div className="pl-4 space-y-2 mt-2">
        <Skeleton className="h-3 w-1/2 bg-slate-700/50" />
        <Skeleton className="h-3 w-3/5 bg-slate-700/50" />
        <Skeleton className="h-3 w-2/3 bg-slate-700/50" />
      </div>
      <Skeleton className="h-3 w-1/3 bg-slate-700/50 mt-2" />
      <div className="pl-4 space-y-2 mt-2">
        <Skeleton className="h-3 w-3/4 bg-slate-700/50" />
        <Skeleton className="h-3 w-2/3 bg-slate-700/50" />
      </div>
      <Skeleton className="h-3 w-1/4 bg-slate-700/50 mt-2" />
      <Skeleton className="h-3 w-1/5 bg-slate-700/50" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function PipelinePreview({ compact = false }: PipelinePreviewProps) {
  const analysisResult = useAnalysisStore((state) => state.analysisResult);
  const status = useAnalysisStore((state) => state.status);

  const pipelineConfig = analysisResult?.pipeline ?? null;

  const [activeTab, setActiveTab] = useState('github');
  const [highlightedHtml, setHighlightedHtml] = useState<Record<string, string>>({});
  const [highlightedLines, setHighlightedLines] = useState<Record<string, string[]>>({});
  const [visibleLineCount, setVisibleLineCount] = useState<Record<string, number>>({});
  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  // Close fullscreen on Escape key
  useEffect(() => {
    if (!fullscreen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [fullscreen]);

  // Pre-compute highlighted HTML for all 3 tabs when pipelineConfig arrives
  useEffect(() => {
    if (!pipelineConfig) return;

    let cancelled = false;

    /**
     * Split shiki-highlighted HTML into individual line entries.
     * Shiki separates each <span class="line">…</span> with newlines inside <code>.
     * We split on those newlines so the typewriter can reveal line-by-line.
     */
    function splitIntoLines(html: string): string[] {
      const codeMatch = html.match(/<code[^>]*>([\s\S]*?)<\/code>/);
      if (!codeMatch) return [html];
      const lines = codeMatch[1].split('\n').filter((l) => l.trim().length > 0);
      return lines.length > 0 ? lines : [html];
    }

    async function highlight() {
      try {
        const infraLang =
          pipelineConfig!.infrastructureAsCode.provider === 'terraform' ? 'hcl' : 'yaml';

        const ghContent = normalizeCode(pipelineConfig!.githubActions.yaml) || '# No GitHub Actions YAML generated';
        const secContent = pipelineConfig!.securityScanning.tools
          .map((t: { name: string; config: string }) => `# ${t.name}\n${normalizeCode(t.config)}`)
          .join('\n---\n') || '# No security scanning config generated';
        const infraContent = normalizeCode(pipelineConfig!.infrastructureAsCode.config) || '# No infrastructure config generated';

        const [ghHtmlRaw, secHtmlRaw, infraHtmlRaw] = await Promise.all([
          codeToHtml(ghContent, {
            lang: 'yaml',
            theme: 'github-dark',
          }),
          codeToHtml(secContent, {
            lang: 'yaml',
            theme: 'github-dark',
          }),
          codeToHtml(infraContent, {
            lang: infraLang,
            theme: 'github-dark',
          }),
        ]);

        // Ensure newlines between line spans for proper rendering
        const ghHtml = ensureLineBreaks(ghHtmlRaw);
        const secHtml = ensureLineBreaks(secHtmlRaw);
        const infraHtml = ensureLineBreaks(infraHtmlRaw);

        if (!cancelled) {
          const htmlMap = { github: ghHtml, security: secHtml, infra: infraHtml };
          const linesMap: Record<string, string[]> = {
            github: splitIntoLines(ghHtml),
            security: splitIntoLines(secHtml),
            infra: splitIntoLines(infraHtml),
          };
          setHighlightedHtml(htmlMap);
          setHighlightedLines(linesMap);
          // Start visible count at 0 for all tabs — typewriter will increment
          setVisibleLineCount({ github: 0, security: 0, infra: 0 });
        }
      } catch (err) {
        // Shiki failed — fall back to plain text rendering (show full content immediately)
        console.error('Shiki highlighting failed:', err);
        if (!cancelled) {
          const wrapPlain = (code: string) =>
            `<pre class="p-5 bg-transparent"><code class="leading-relaxed text-slate-200">${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`;

          const secContentPlain = pipelineConfig!.securityScanning.tools
            .map((t: { name: string; config: string }) => `# ${t.name}\n${normalizeCode(t.config)}`)
            .join('\n---\n');

          const htmlMap = {
            github: wrapPlain(normalizeCode(pipelineConfig!.githubActions.yaml) || '# No content'),
            security: wrapPlain(secContentPlain || '# No content'),
            infra: wrapPlain(normalizeCode(pipelineConfig!.infrastructureAsCode.config) || '# No content'),
          };
          setHighlightedHtml(htmlMap);
          setHighlightedLines({});
          // Fallback: show full content immediately (no typewriter for plain text)
          setVisibleLineCount({});
        }
      }
    }

    void (async () => { await highlight(); })();

    return () => { cancelled = true; };
  }, [pipelineConfig]);

  // Typewriter reveal effect — runs whenever visibleLineCount is reset (new content or tab switch)
  useEffect(() => {
    // In compact mode, skip typewriter — show full content immediately
    if (compact) return;

    const lines = highlightedLines[activeTab];
    if (!lines || lines.length === 0) return;

    const currentCount = visibleLineCount[activeTab] ?? 0;

    // Already fully revealed for this tab
    if (currentCount >= lines.length) return;

    // Start revealing line-by-line at 30ms per line
    const intervalId = setInterval(() => {
      setVisibleLineCount((prev) => {
        const prevCount = prev[activeTab] ?? 0;
        if (prevCount >= lines.length) {
          clearInterval(intervalId);
          return prev;
        }
        return { ...prev, [activeTab]: prevCount + 1 };
      });
    }, 30);

    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, highlightedLines, compact]);

  // Reset and restart typewriter when switching tabs
  useEffect(() => {
    if (compact) return;
    const lines = highlightedLines[activeTab];
    if (!lines || lines.length === 0) return;
    // Reset count to 0 on tab switch to trigger the typewriter effect
    setVisibleLineCount((prev) => ({ ...prev, [activeTab]: 0 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Copy to clipboard handler
  const handleCopy = async () => {
    if (!pipelineConfig) return;
    await navigator.clipboard.writeText(getRawContent(activeTab, pipelineConfig));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download file handler
  const handleDownload = () => {
    if (!pipelineConfig) return;
    const content = getRawContent(activeTab, pipelineConfig);
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = getFilename(activeTab, pipelineConfig);
    a.click();
    URL.revokeObjectURL(url); // revoke immediately to prevent memory leak
  };

  // Code display height — compact: match dashboard grid cards; normal: fill available space; fullscreen: near-viewport
  const codeMaxH = fullscreen ? 'max-h-[calc(100vh-12rem)]' : compact ? 'max-h-[380px]' : 'min-h-[400px] max-h-[calc(100vh-18rem)]';

  // Empty state — no analysis run yet
  if (status === 'idle' || status === 'parsed' || status === 'loading') {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <div className="p-6 space-y-4">
          <h3 className="text-sm font-medium text-slate-400">Pipeline Preview</h3>
          <div className="bg-slate-900 rounded-lg">
            <CodeSkeleton />
          </div>
        </div>
      </Card>
    );
  }

  // Analyzing state — show animated skeleton with progress indicator
  if (status === 'analyzing' && !pipelineConfig) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-slate-400">Pipeline Preview</h3>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-xs text-blue-400 animate-pulse">Generating...</span>
            </div>
          </div>
          <div className="bg-slate-900 rounded-lg relative overflow-hidden">
            <CodeSkeleton />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-700/10 to-transparent animate-shimmer" />
          </div>
        </div>
      </Card>
    );
  }

  // Graceful degradation — analysis ran but pipeline agent failed
  if (status === 'complete' && !pipelineConfig) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <div className="p-6 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-400">
            Pipeline data unavailable — pipeline generator agent failed
          </p>
        </div>
      </Card>
    );
  }

  const isHighlighting = Object.keys(highlightedHtml).length === 0;

  /**
   * Build renderable HTML for a tab, applying the typewriter line count.
   * In compact mode or when no line data exists, shows full content immediately.
   */
  function getTabHtml(tab: string): string {
    const fullHtml = highlightedHtml[tab] ?? '';
    const lines = highlightedLines[tab];

    // Compact mode or no line data — show full content immediately
    if (compact || !lines || lines.length === 0) return fullHtml;

    const count = visibleLineCount[tab] ?? 0;

    // Extract outer wrapper tags from shiki output (pre + code open/close)
    const preMatch = fullHtml.match(/^([\s\S]*?<code[^>]*>)([\s\S]*?)(<\/code>[\s\S]*?)$/);
    if (preMatch) {
      const [, openTags, , closeTags] = preMatch;
      return `${openTags}${lines.slice(0, count).join('\n')}${closeTags}`;
    }

    // Fallback
    return lines.slice(0, count).join('\n');
  }

  const actionButtons = (
    <div className="flex items-center gap-1">
      {/* Copy button */}
      <Button
        size="sm"
        variant="ghost"
        onClick={() => void handleCopy()}
        className="h-7 w-7 p-0 text-slate-400 hover:text-slate-200"
        title="Copy to clipboard"
      >
        {copied ? (
          <Check className="h-4 w-4 text-emerald-400" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>

      {/* Download button — hidden in compact mode */}
      {!compact && (
        <Button
          size="sm"
          variant="ghost"
          onClick={handleDownload}
          className="h-7 w-7 p-0 text-slate-400 hover:text-slate-200"
          title="Download file"
        >
          <Download className="h-4 w-4" />
        </Button>
      )}

      {/* Fullscreen toggle */}
      {!compact && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setFullscreen((f) => !f)}
          className="h-7 w-7 p-0 text-slate-400 hover:text-slate-200"
          title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {fullscreen ? <X className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
      )}
    </div>
  );

  const tabContent = (
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className="w-full"
    >
      <TabsList className="bg-slate-900 border border-slate-700 h-8 p-0.5 mb-3">
        <TabsTrigger
          value="github"
          className="h-7 px-3 text-xs text-slate-400 data-[state=active]:bg-slate-700 data-[state=active]:text-slate-100 rounded"
        >
          GitHub Actions
        </TabsTrigger>
        <TabsTrigger
          value="security"
          className="h-7 px-3 text-xs text-slate-400 data-[state=active]:bg-slate-700 data-[state=active]:text-slate-100 rounded"
        >
          Security Scanning
        </TabsTrigger>
        <TabsTrigger
          value="infra"
          className="h-7 px-3 text-xs text-slate-400 data-[state=active]:bg-slate-700 data-[state=active]:text-slate-100 rounded"
        >
          Infrastructure
        </TabsTrigger>
      </TabsList>

      {(['github', 'security', 'infra'] as const).map((tab) => (
        <TabsContent key={tab} value={tab} className="mt-0">
          {isHighlighting ? (
            <div className="bg-slate-900 rounded-lg">
              <CodeSkeleton />
            </div>
          ) : (
            <div
              className={`text-sm font-mono overflow-auto ${codeMaxH} rounded-lg bg-[#0d1117] border border-slate-700/50 [&_pre]:p-5 [&_pre]:rounded-lg [&_pre]:bg-transparent [&_pre]:overflow-x-auto [&_code]:leading-relaxed [&_.line]:min-h-[1.25em]`}
              dangerouslySetInnerHTML={{ __html: getTabHtml(tab) }}
            />
          )}
        </TabsContent>
      ))}
    </Tabs>
  );

  // Fullscreen overlay
  if (fullscreen) {
    return (
      <>
        {/* Placeholder card so layout doesn't collapse */}
        <Card className="bg-slate-800 border-slate-700">
          <div className="p-6 flex items-center justify-center h-24">
            <p className="text-sm text-slate-500">Pipeline Preview — viewing fullscreen</p>
          </div>
        </Card>

        {/* Fullscreen overlay */}
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-sm flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
            <h3 className="text-base font-medium text-slate-200">Pipeline Preview</h3>
            {actionButtons}
          </div>
          <div className="flex-1 overflow-hidden px-6 py-4">
            {tabContent}
          </div>
        </div>
      </>
    );
  }

  return (
    <Card className="bg-slate-800 border-slate-700">
      <div className="p-6">
        {/* Header: title + action buttons */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-slate-400">Pipeline Preview</h3>
          {actionButtons}
        </div>

        {tabContent}
      </div>
    </Card>
  );
}
