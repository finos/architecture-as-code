'use client';

import { useAnalysisStore } from '@/store/analysis-store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  GitBranch,
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertCircle,
  GitPullRequest,
  Shield,
  FileCheck2,
  Cloud,
} from 'lucide-react';
import type { PRRecord } from '@/lib/github/types';

type SetPRFn = (pr: Partial<PRRecord>) => void;

// ---------------------------------------------------------------------------
// PRSection sub-component
// ---------------------------------------------------------------------------

interface PRSectionProps {
  record: PRRecord;
  label: string;
  description: string;
  icon: React.ReactNode;
  onGenerate: () => void;
  disabled: boolean;
}

function PRSection({ record, label, description, icon, onGenerate, disabled }: PRSectionProps) {
  return (
    <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {icon}
        <div>
          <p className="text-sm font-medium text-slate-200">{label}</p>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
      </div>

      {/* idle — show generate button, respect disabled prop */}
      {record.status === 'idle' && (
        <Button
          onClick={onGenerate}
          disabled={disabled}
          className={
            disabled
              ? 'w-full bg-slate-700 text-slate-400 cursor-not-allowed'
              : 'w-full bg-emerald-600 hover:bg-emerald-500 text-white'
          }
        >
          {!disabled && <GitBranch className="h-4 w-4 mr-2" />}
          Generate {label} PR
        </Button>
      )}

      {/* generating — animated step progress (renders unconditionally, ignores disabled) */}
      {record.status === 'generating' && (
        <div className="flex items-center gap-2 py-2">
          <Loader2 className="h-4 w-4 text-emerald-400 animate-spin flex-shrink-0" />
          <span className="text-sm text-slate-400 animate-pulse">
            {record.step ?? 'Starting...'}
          </span>
        </div>
      )}

      {/* open — success state with PR link */}
      {record.status === 'open' && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
            <span className="text-sm text-emerald-400 font-medium">PR Created</span>
            {record.fileCount !== undefined && (
              <span className="ml-auto text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
                {record.fileCount} files
              </span>
            )}
          </div>
          {record.branchName && (
            <p className="text-xs text-slate-500 font-mono truncate">{record.branchName}</p>
          )}
          {record.prUrl && (
            <a
              href={record.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              <GitPullRequest className="h-3.5 w-3.5 flex-shrink-0" />
              View PR #{record.prNumber} on GitHub
              <ExternalLink className="h-3 w-3 flex-shrink-0" />
            </a>
          )}
        </div>
      )}

      {/* error — show message and retry option */}
      {record.status === 'error' && (
        <div className="flex flex-col gap-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-400">{record.error ?? 'Unknown error occurred'}</p>
          </div>
          <Button
            onClick={onGenerate}
            disabled={disabled}
            variant="outline"
            size="sm"
            className={
              disabled
                ? 'border-slate-700 text-slate-500 cursor-not-allowed'
                : 'border-red-800 text-red-400 hover:bg-red-900/20 hover:text-red-300'
            }
          >
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// GitOpsCard — exported component
// ---------------------------------------------------------------------------

/**
 * GitOpsCard
 *
 * Displays after analysis completes when githubRepo is set in Zustand.
 * Shows three side-by-side sections: DevSecOps CI, Compliance Remediation, Cloud Infrastructure.
 *
 * Concurrency lock: while any one button is generating, all three are disabled.
 * Visibility is controlled by the parent — this component assumes githubRepo is non-null.
 */
export function GitOpsCard() {
  const githubRepo = useAnalysisStore((s) => s.githubRepo);
  const pipelinePR = useAnalysisStore((s) => s.pipelinePR);
  const remediationPR = useAnalysisStore((s) => s.remediationPR);
  const infraPR = useAnalysisStore((s) => s.infraPR);
  const setPipelinePR = useAnalysisStore((s) => s.setPipelinePR);
  const setRemediationPR = useAnalysisStore((s) => s.setRemediationPR);
  const setInfraPR = useAnalysisStore((s) => s.setInfraPR);

  if (!githubRepo) return null;

  // Concurrency lock — disable all three buttons while any is generating
  const isAnyGenerating =
    pipelinePR.status === 'generating' ||
    remediationPR.status === 'generating' ||
    infraPR.status === 'generating';

  /**
   * Shared SSE stream reader for PR generation flows.
   * Reads an SSE response body and updates PR state via the provided setter.
   */
  const readPRStream = async (
    res: Response,
    setPR: SetPRFn,
  ) => {
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split('\n\n');
      buffer = frames.pop() ?? '';

      for (const frame of frames) {
        const trimmed = frame.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const data = JSON.parse(trimmed.slice(6)) as {
          type: string;
          step?: string;
          prUrl?: string;
          prNumber?: number;
          branchName?: string;
          fileCount?: number;
          message?: string;
        };

        if (data.type === 'step') {
          setPR({ step: data.step });
        } else if (data.type === 'done') {
          setPR({
            status: 'open',
            prUrl: data.prUrl,
            prNumber: data.prNumber,
            branchName: data.branchName,
            fileCount: data.fileCount,
            step: undefined,
          });
        } else if (data.type === 'error') {
          setPR({ status: 'error', error: data.message, step: undefined });
        }
      }
    }
  };

  const handleGeneratePipelinePR = async () => {
    setPipelinePR({ status: 'generating', step: 'Starting...' });

    try {
      const res = await fetch('/api/github/create-pr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'pipeline',
          owner: githubRepo.owner,
          repo: githubRepo.repo,
          filePath: githubRepo.filePath,
          fileSha: githubRepo.fileSha,
          defaultBranch: githubRepo.defaultBranch,
        }),
      });

      await readPRStream(res, setPipelinePR);
    } catch (error) {
      setPipelinePR({
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to generate PR',
        step: undefined,
      });
    }
  };

  const handleGenerateRemediationPR = async () => {
    if (!githubRepo) return;
    setRemediationPR({ status: 'generating', step: 'Starting...' });

    try {
      const res = await fetch('/api/github/create-pr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'remediation',
          owner: githubRepo.owner,
          repo: githubRepo.repo,
          filePath: githubRepo.filePath,
          fileSha: githubRepo.fileSha,
          defaultBranch: githubRepo.defaultBranch,
        }),
      });

      await readPRStream(res, setRemediationPR);
    } catch (error) {
      setRemediationPR({
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to generate remediation PR',
        step: undefined,
      });
    }
  };

  const handleGenerateInfraPR = async () => {
    setInfraPR({ status: 'generating', step: 'Starting...' });

    try {
      const res = await fetch('/api/github/create-pr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'infra',
          owner: githubRepo.owner,
          repo: githubRepo.repo,
          filePath: githubRepo.filePath,
          fileSha: githubRepo.fileSha,
          defaultBranch: githubRepo.defaultBranch,
        }),
      });

      await readPRStream(res, setInfraPR);
    } catch (error) {
      setInfraPR({
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to generate infrastructure PR',
        step: undefined,
      });
    }
  };

  return (
    <Card className="bg-slate-800 border-slate-700 col-span-full">
      <div className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <GitPullRequest className="h-5 w-5 text-emerald-500" />
          <h3 className="text-lg font-semibold text-slate-200">GitOps Actions</h3>
          <span className="text-xs text-slate-500 ml-auto">
            {githubRepo.owner}/{githubRepo.repo}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* DevSecOps CI PR */}
          <PRSection
            record={pipelinePR}
            label="DevSecOps CI"
            description="GitHub Actions: lint, build, test, SAST, secrets scan"
            icon={<Shield className="h-4 w-4 text-slate-400 flex-shrink-0" />}
            onGenerate={handleGeneratePipelinePR}
            disabled={isAnyGenerating}
          />

          {/* Compliance Remediation PR */}
          <PRSection
            record={remediationPR}
            label="Compliance Remediation"
            description="Missing controls added, weak protocols upgraded"
            icon={<FileCheck2 className="h-4 w-4 text-slate-400 flex-shrink-0" />}
            onGenerate={handleGenerateRemediationPR}
            disabled={isAnyGenerating}
          />

          {/* Cloud Infrastructure PR */}
          <PRSection
            record={infraPR}
            label="Cloud Infrastructure"
            description="AWS Terraform: VPC, ECS, RDS, security groups"
            icon={<Cloud className="h-4 w-4 text-slate-400 flex-shrink-0" />}
            onGenerate={handleGenerateInfraPR}
            disabled={isAnyGenerating}
          />
        </div>
      </div>
    </Card>
  );
}
