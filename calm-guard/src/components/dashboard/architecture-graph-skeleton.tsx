import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function ArchitectureGraphSkeleton() {
  return (
    <Card className="bg-slate-900 border-slate-800 p-6">
      <div className="space-y-4">
        {/* Title */}
        <h3 className="text-sm font-medium text-slate-400">Architecture Graph</h3>

        {/* Graph placeholder with scattered node rectangles */}
        <div className="relative h-80 bg-slate-950 rounded-lg p-4">
          {/* Simulated nodes */}
          <Skeleton className="absolute top-4 left-8 h-16 w-24 bg-slate-800 rounded" />
          <Skeleton className="absolute top-12 right-12 h-16 w-24 bg-slate-800 rounded" />
          <Skeleton className="absolute bottom-8 left-16 h-16 w-24 bg-slate-800 rounded" />
          <Skeleton className="absolute bottom-12 right-8 h-16 w-24 bg-slate-800 rounded" />
          <Skeleton className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-16 w-24 bg-slate-800 rounded" />

          {/* Simulated edges */}
          <Skeleton className="absolute top-20 left-24 h-0.5 w-32 bg-slate-700" />
          <Skeleton className="absolute top-32 right-24 h-0.5 w-40 bg-slate-700 rotate-45" />
          <Skeleton className="absolute bottom-20 left-32 h-0.5 w-36 bg-slate-700 -rotate-12" />
        </div>
      </div>
    </Card>
  );
}
