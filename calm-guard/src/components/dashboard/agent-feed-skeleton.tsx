import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function AgentFeedSkeleton() {
  return (
    <Card className="bg-slate-900 border-slate-800 p-6">
      <div className="space-y-4">
        {/* Title */}
        <h3 className="text-sm font-medium text-slate-400">Agent Activity Feed</h3>

        {/* Feed messages */}
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <Skeleton className="h-8 w-8 rounded-full bg-slate-800" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4 bg-slate-800" />
              <Skeleton className="h-3 w-1/2 bg-slate-800" />
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Skeleton className="h-8 w-8 rounded-full bg-slate-800" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3 bg-slate-800" />
              <Skeleton className="h-3 w-1/3 bg-slate-800" />
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Skeleton className="h-8 w-8 rounded-full bg-slate-800" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-4/5 bg-slate-800" />
              <Skeleton className="h-3 w-2/5 bg-slate-800" />
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Skeleton className="h-8 w-8 rounded-full bg-slate-800" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2 bg-slate-800" />
              <Skeleton className="h-3 w-1/4 bg-slate-800" />
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Skeleton className="h-8 w-8 rounded-full bg-slate-800" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/5 bg-slate-800" />
              <Skeleton className="h-3 w-2/5 bg-slate-800" />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
