import { ReactNode } from "react";
import { Button } from "./ui/button";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";

interface CollapsiblePanelProps {
  children: ReactNode;
  isCollapsed: boolean;
  onToggle: () => void;
  position: "left" | "right" | "bottom";
  collapsedSize?: number; // Size in pixels when collapsed
  title?: string;
}

export const CollapsiblePanel = ({
  children,
  isCollapsed,
  onToggle,
  position,
  collapsedSize = 48,
  title,
}: CollapsiblePanelProps) => {
  const getIcon = () => {
    if (position === "left") {
      return isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />;
    } else if (position === "right") {
      return isCollapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />;
    } else {
      return isCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />;
    }
  };

  const getCollapsedContent = () => {
    if (position === "bottom") {
      return (
        <div className="h-full flex items-center justify-between px-4 border-t border-border bg-card/50">
          <span className="text-sm text-muted-foreground">{title}</span>
          <Button variant="ghost" size="sm" onClick={onToggle}>
            {getIcon()}
          </Button>
        </div>
      );
    }

    // Vertical collapsed state for left/right panels
    return (
      <div className="h-full flex flex-col items-center justify-start pt-4 bg-card/50 border-r border-border">
        <Button variant="ghost" size="sm" onClick={onToggle} className="mb-4">
          {getIcon()}
        </Button>
        {title && (
          <div className="writing-mode-vertical text-xs text-muted-foreground whitespace-nowrap">
            {title}
          </div>
        )}
      </div>
    );
  };

  if (isCollapsed) {
    if (position === "bottom") {
      return (
        <div style={{ height: `${collapsedSize}px` }}>
          {getCollapsedContent()}
        </div>
      );
    }

    return (
      <div style={{ width: `${collapsedSize}px` }} className="h-full">
        {getCollapsedContent()}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {position !== "bottom" && (
        <div className="flex items-center justify-between p-2 border-b border-border bg-card/50">
          {title && <span className="text-sm font-medium">{title}</span>}
          <Button variant="ghost" size="sm" onClick={onToggle} className="ml-auto">
            {getIcon()}
          </Button>
        </div>
      )}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
      {position === "bottom" && (
        <div className="absolute top-2 right-2 z-10">
          <Button variant="ghost" size="sm" onClick={onToggle}>
            {getIcon()}
          </Button>
        </div>
      )}
    </div>
  );
};
