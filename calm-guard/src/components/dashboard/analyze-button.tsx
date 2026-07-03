'use client';

import { Loader2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AnalyzeButtonProps {
  onAnalyze: () => void;
  disabled: boolean;
  loading: boolean;
}

export function AnalyzeButton({ onAnalyze, disabled, loading }: AnalyzeButtonProps) {
  return (
    <Button
      onClick={onAnalyze}
      disabled={disabled || loading}
      className="bg-emerald-600 hover:bg-emerald-700 text-white disabled:bg-slate-700 disabled:text-slate-500 transition-colors"
      size="sm"
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Analyzing...
        </>
      ) : (
        <>
          <Play className="mr-2 h-4 w-4" />
          Analyze
        </>
      )}
    </Button>
  );
}
