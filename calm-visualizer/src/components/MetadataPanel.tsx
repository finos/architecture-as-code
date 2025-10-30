import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { FlowsPanel } from "./FlowsPanel";
import { ControlsPanel } from "./ControlsPanel";
import { Button } from "./ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";

interface MetadataPanelProps {
  flows: any[];
  controls: any;
  onTransitionClick?: (relationshipId: string) => void;
  onNodeClick?: (nodeId: string) => void;
  onControlClick?: (controlId: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const MetadataPanel = ({
  flows,
  controls,
  onTransitionClick,
  onNodeClick,
  onControlClick,
  isCollapsed,
  onToggleCollapse,
}: MetadataPanelProps) => {
  const hasFlows = flows.length > 0;
  const hasControls = Object.keys(controls).length > 0;

  if (!hasFlows && !hasControls) {
    return null;
  }

  if (isCollapsed) {
    return (
      <div className="h-12 flex items-center justify-between px-4 border-t border-border bg-card/50">
        <div className="flex gap-2 text-sm text-muted-foreground">
          {hasFlows && <span>Flows ({flows.length})</span>}
          {hasFlows && hasControls && <span>•</span>}
          {hasControls && <span>Controls ({Object.keys(controls).length})</span>}
        </div>
        <Button variant="ghost" size="sm" onClick={onToggleCollapse}>
          <ChevronUp className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col border-t border-border bg-card">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <h3 className="text-sm font-semibold">Metadata</h3>
        <Button variant="ghost" size="sm" onClick={onToggleCollapse}>
          <ChevronDown className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue={hasFlows ? "flows" : "controls"} className="h-full flex flex-col">
          <TabsList className="mx-4 mt-2">
            {hasFlows && <TabsTrigger value="flows">Flows</TabsTrigger>}
            {hasControls && <TabsTrigger value="controls">Controls</TabsTrigger>}
          </TabsList>

          {hasFlows && (
            <TabsContent value="flows" className="flex-1 overflow-hidden mt-0 p-4">
              <FlowsPanel flows={flows} onTransitionClick={onTransitionClick} />
            </TabsContent>
          )}

          {hasControls && (
            <TabsContent value="controls" className="flex-1 overflow-hidden mt-0 p-4">
              <ControlsPanel controls={controls} onNodeClick={onNodeClick} onControlClick={onControlClick} />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
};
