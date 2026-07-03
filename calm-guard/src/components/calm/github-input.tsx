'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GitBranch, Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useAnalysisStore } from '@/store/analysis-store';
import type { CalmDocument } from '@/lib/calm/types';
import type { AnalysisInput } from '@/lib/calm/extractor';
import type { CalmVersion } from '@/lib/calm/normalizer';

interface FetchCalmResponse {
  calm: CalmDocument;
  analysisInput: AnalysisInput;
  fileSha: string;
  defaultBranch: string;
  version?: string;
}

interface FetchCalmError {
  error: string;
  issues?: string[];
}

/**
 * GitHubInput — "From GitHub" tab content for the ArchitectureSelector.
 *
 * User enters owner/repo and a file path. On submit, the component POSTs
 * to /api/github/fetch-calm (server-side, token never exposed to client),
 * populates the Zustand store with the parsed CALM + GitHub metadata,
 * then navigates to the dashboard to start the 4-agent analysis.
 */
export function GitHubInput() {
  const router = useRouter();
  const { setCalmData, setGitHubRepo } = useAnalysisStore();

  const [repoSlug, setRepoSlug] = useState('gjs-opsflo/payment-gateway-calm');
  const [filePath, setFilePath] = useState('payment-gateway.calm.json');
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Extract owner/repo from various input formats:
   * - owner/repo
   * - https://github.com/owner/repo
   * - https://github.com/owner/repo.git
   * - github.com/owner/repo
   */
  const parseRepoSlug = (input: string): [string, string] | null => {
    const trimmed = input.trim().replace(/\.git$/, '');
    // Try full URL: https://github.com/owner/repo or github.com/owner/repo
    const urlMatch = trimmed.match(/(?:https?:\/\/)?github\.com\/([^/]+)\/([^/]+)$/);
    if (urlMatch) return [urlMatch[1], urlMatch[2]];
    // Try simple owner/repo
    const parts = trimmed.split('/');
    if (parts.length === 2 && parts[0] && parts[1]) return [parts[0], parts[1]];
    return null;
  };

  const validate = (): string | null => {
    if (!parseRepoSlug(repoSlug)) {
      return 'Repository must be in "owner/repo" format or a GitHub URL (e.g. https://github.com/finos/architecture-as-code)';
    }
    // filePath must end with .json
    if (!filePath.trim().endsWith('.json')) {
      return 'File path must end with .json (e.g. examples/payment-gateway.calm.json)';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const validationError = validate();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const [owner, repo] = parseRepoSlug(repoSlug)!;
    const normalizedPath = filePath.trim();

    setIsLoading(true);
    try {
      const res = await fetch('/api/github/fetch-calm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo, filePath: normalizedPath }),
      });

      const data = (await res.json()) as FetchCalmResponse | FetchCalmError;

      if (!res.ok) {
        const errData = data as FetchCalmError;
        const message = errData.error ?? `HTTP ${res.status}: Failed to fetch CALM from GitHub`;
        toast.error(message);
        return;
      }

      const successData = data as FetchCalmResponse;

      // Populate Zustand with the parsed CALM document
      setCalmData(successData.calm, successData.analysisInput, successData.version as CalmVersion | undefined);

      // Store GitHub repo metadata for PR generation (Plans 02 and 03)
      setGitHubRepo({
        owner,
        repo,
        filePath: normalizedPath,
        fileSha: successData.fileSha,
        defaultBranch: successData.defaultBranch,
      });

      // Navigate to dashboard — the store status='parsed' will trigger analysis start
      router.push('/dashboard');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Network error — could not reach the server';
      toast.error(`Failed to fetch CALM from GitHub: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 text-slate-300">
        <GitBranch className="h-4 w-4 text-emerald-500" />
        <span className="text-sm font-medium">Fetch CALM from GitHub</span>
      </div>

      {/* Owner / Repo */}
      <div className="space-y-1.5">
        <Label htmlFor="github-repo" className="text-sm text-slate-300">
          Repository
        </Label>
        <Input
          id="github-repo"
          type="text"
          placeholder="owner/repo"
          value={repoSlug}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRepoSlug(e.target.value)}
          disabled={isLoading}
          className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 focus-visible:ring-emerald-600/50"
        />
        <p className="text-xs text-slate-500">
          Format: <span className="font-mono">owner/repo</span> — e.g.{' '}
          <span className="font-mono">finos/architecture-as-code</span>
        </p>
      </div>

      {/* File Path */}
      <div className="space-y-1.5">
        <Label htmlFor="github-path" className="text-sm text-slate-300">
          CALM file path
        </Label>
        <Input
          id="github-path"
          type="text"
          placeholder="path/to/architecture.calm.json"
          value={filePath}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilePath(e.target.value)}
          disabled={isLoading}
          className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 focus-visible:ring-emerald-600/50"
        />
        <p className="text-xs text-slate-500">
          Relative path inside the repo — e.g.{' '}
          <span className="font-mono">examples/payment-gateway.calm.json</span>
        </p>
      </div>

      {/* Submit */}
      <Button
        type="submit"
        disabled={isLoading}
        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white disabled:bg-slate-700 disabled:text-slate-500 transition-colors"
        size="lg"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Fetching from GitHub...
          </>
        ) : (
          <>
            Fetch &amp; Analyze
            <ArrowRight className="ml-2 h-4 w-4" />
          </>
        )}
      </Button>
    </form>
  );
}
