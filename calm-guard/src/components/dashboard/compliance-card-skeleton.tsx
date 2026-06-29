import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function ComplianceCardSkeleton() {
  return (
    <Card className="bg-slate-900 border-slate-800 p-6">
      <div className="space-y-4">
        {/* Title */}
        <h3 className="text-sm font-medium text-slate-400">Compliance Score</h3>

        {/* Circular gauge placeholder */}
        <div className="flex flex-col items-center justify-center py-8">
          <Skeleton className="h-32 w-32 rounded-full bg-slate-800" />
        </div>

        {/* Score bars */}
        <div className="space-y-3 pt-4">
          <Skeleton className="h-3 w-full bg-slate-800" />
          <Skeleton className="h-3 w-4/5 bg-slate-800" />
          <Skeleton className="h-3 w-3/4 bg-slate-800" />
        </div>
      </div>
    </Card>
  );
}
