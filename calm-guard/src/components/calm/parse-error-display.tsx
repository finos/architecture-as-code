'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { XCircle, X } from 'lucide-react';

interface ParseError {
  message: string;
  issues: Array<{
    path: string;
    message: string;
    code: string;
  }>;
}

interface ParseErrorDisplayProps {
  error: ParseError | null;
  onDismiss: () => void;
}

export function ParseErrorDisplay({ error, onDismiss }: ParseErrorDisplayProps) {
  if (!error) return null;

  return (
    <Card className="border-red-500/50 bg-red-950/20 backdrop-blur-sm">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-400" />
            <h3 className="text-sm font-semibold text-red-300">
              Validation Error
            </h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="h-6 w-6 p-0 text-red-400 hover:text-red-300 hover:bg-red-900/30"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Dismiss error</span>
          </Button>
        </div>

        {/* Error Message */}
        <p className="text-sm text-red-200 mb-3">{error.message}</p>

        {/* Issues List */}
        {error.issues.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-red-300">Issues found:</p>
            <ul className="space-y-1.5">
              {error.issues.map((issue, index) => (
                <li
                  key={index}
                  className="text-xs bg-red-900/30 rounded px-3 py-2 border border-red-800/50"
                >
                  <div className="flex flex-col gap-1">
                    {issue.path && (
                      <code className="text-red-300 font-mono text-xs">
                        {issue.path}
                      </code>
                    )}
                    <span className="text-red-200">{issue.message}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}
