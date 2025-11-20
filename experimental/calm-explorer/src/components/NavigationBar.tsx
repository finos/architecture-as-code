import { ArrowLeft, ChevronRight, Home } from "lucide-react";
import { Button } from "./ui/button";

interface NavigationBarProps {
  currentArchitectureName?: string;
  breadcrumbs?: string[];
  canNavigateBack?: boolean;
  onNavigateBack?: () => void;
}

export const NavigationBar = ({
  currentArchitectureName,
  breadcrumbs = [],
  canNavigateBack = false,
  onNavigateBack
}: NavigationBarProps) => {
  // Don't render if no navigation context
  if (!canNavigateBack && breadcrumbs.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-border bg-muted/30 px-6 py-2">
      <div className="flex items-center gap-3">
        {canNavigateBack && onNavigateBack && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-2"
            onClick={onNavigateBack}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </Button>
        )}

        {breadcrumbs.length > 0 ? (
          <div className="flex items-center gap-2 text-sm flex-1 min-w-0 overflow-x-auto">
            <Home className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            {breadcrumbs.map((crumb, index) => (
              <div key={index} className="flex items-center gap-2 flex-shrink-0">
                <span className="text-muted-foreground truncate max-w-[200px]">{crumb}</span>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
            ))}
            {currentArchitectureName && (
              <span className="font-medium text-foreground truncate max-w-[300px]">
                {currentArchitectureName}
              </span>
            )}
          </div>
        ) : currentArchitectureName ? (
          <div className="flex items-center gap-2 text-sm">
            <Home className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium text-foreground">{currentArchitectureName}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
};
