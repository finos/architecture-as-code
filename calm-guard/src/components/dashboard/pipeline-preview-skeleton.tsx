import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function PipelinePreviewSkeleton() {
  return (
    <Card className="bg-slate-900 border-slate-800 p-6">
      <div className="space-y-4">
        {/* Title */}
        <h3 className="text-sm font-medium text-slate-400">Pipeline Preview</h3>

        {/* Code block placeholder */}
        <div className="bg-slate-950 rounded-lg p-4 space-y-2 font-mono text-xs">
          <Skeleton className="h-3 w-1/4 bg-slate-800" />
          <Skeleton className="h-3 w-1/3 bg-slate-800" />
          <Skeleton className="h-3 w-2/5 bg-slate-800" />
          <div className="pl-4 space-y-2">
            <Skeleton className="h-3 w-1/2 bg-slate-800" />
            <Skeleton className="h-3 w-3/5 bg-slate-800" />
            <Skeleton className="h-3 w-2/3 bg-slate-800" />
          </div>
          <Skeleton className="h-3 w-1/3 bg-slate-800" />
          <div className="pl-4 space-y-2">
            <Skeleton className="h-3 w-3/4 bg-slate-800" />
            <Skeleton className="h-3 w-2/3 bg-slate-800" />
          </div>
          <Skeleton className="h-3 w-1/4 bg-slate-800" />
          <Skeleton className="h-3 w-1/5 bg-slate-800" />
        </div>
      </div>
    </Card>
  );
}
