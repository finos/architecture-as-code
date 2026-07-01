'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAnalysisStore } from '@/store/analysis-store';
import { ArchitectureSelector } from '@/components/calm/architecture-selector';
import { ParseErrorDisplay } from '@/components/calm/parse-error-display';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, Play, Loader2 } from 'lucide-react';
import type { CalmDocument } from '@/lib/calm/types';
import type { AnalysisInput } from '@/lib/calm/extractor';
import type { CalmVersion } from '@/lib/calm/normalizer';

const DEMO_REPO = { owner: 'gjs-opsflo', repo: 'payment-gateway-calm', filePath: 'payment-gateway.calm.json' };

export default function Home() {
  const router = useRouter();
  const { error, reset, setCalmData, setDemoMode, setSelectedFrameworks, setGitHubRepo } = useAnalysisStore();
  const [isLoading, setIsLoading] = useState(false);

  const handleDismissError = () => {
    reset();
  };

  const handleRunDemo = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/github/fetch-calm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(DEMO_REPO),
      });

      const data = await res.json() as { calm: CalmDocument; analysisInput: AnalysisInput; fileSha: string; defaultBranch: string; version?: string; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? `HTTP ${res.status}: Failed to fetch demo from GitHub`);
        return;
      }

      // Pre-select all frameworks
      setSelectedFrameworks(['SOX', 'PCI-DSS', 'NIST-CSF', 'CCC', 'SOC2']);

      // Populate store with parsed CALM from GitHub
      setCalmData(data.calm, data.analysisInput, data.version as CalmVersion | undefined);

      // Store GitHub repo metadata — enables PR generation on dashboard
      setGitHubRepo({
        owner: DEMO_REPO.owner,
        repo: DEMO_REPO.repo,
        filePath: DEMO_REPO.filePath,
        fileSha: data.fileSha,
        defaultBranch: data.defaultBranch,
      });

      // Set demo mode flag — dashboard will auto-start analysis
      setDemoMode(true);

      // Navigate to dashboard
      router.push('/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error';
      toast.error(`Failed to fetch demo: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-12">
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Shield className="h-12 w-12 text-emerald-500" />
            <h1 className="text-4xl font-bold text-slate-50">CALMGuard</h1>
          </div>
          <p className="text-lg text-slate-400">
            CALM-native continuous compliance platform
          </p>
          <p className="text-sm text-slate-500 max-w-xl mx-auto">
            Upload a FINOS CALM architecture and get instant AI-powered
            compliance analysis, risk assessment, and generated CI/CD pipeline
            configurations
          </p>
        </div>

        {/* Run Demo CTA — primary action for hackathon judges */}
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-500">
            Live Demo
          </p>
          <p className="text-sm text-slate-400">
            See CALMGuard analyze a trading platform architecture in real-time
          </p>
          <Button
            onClick={() => { void handleRunDemo(); }}
            disabled={isLoading}
            size="lg"
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-base h-12 gap-2 disabled:bg-slate-700 disabled:text-slate-500"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Fetching from GitHub...
              </>
            ) : (
              <>
                <Play className="h-5 w-5" />
                Run Demo
              </>
            )}
          </Button>
          <p className="text-xs text-slate-600">
            Trading Platform — Multi-service system with FIX protocol, order management, and real-time market data
          </p>
        </div>

        {/* Main Selector Card */}
        <Card className="bg-slate-900 border-slate-800 shadow-xl">
          <div className="p-6 space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-200 mb-1">
                Get Started
              </h2>
              <p className="text-sm text-slate-400">
                Choose a demo architecture, upload a CALM JSON file, or analyze from a GitHub repo
              </p>
            </div>
            <ArchitectureSelector />
          </div>
        </Card>

        {/* Error Display */}
        {error && (
          <ParseErrorDisplay error={error} onDismiss={handleDismissError} />
        )}

        {/* Footer */}
        <div className="text-center text-xs text-slate-600">
          <p>Built for DTCC/FINOS Innovate.DTCC AI Hackathon 2026</p>
          <p className="mt-1">
            Powered by FINOS CALM, Vercel AI SDK, and Google Gemini
          </p>
        </div>
      </div>
    </main>
  );
}
