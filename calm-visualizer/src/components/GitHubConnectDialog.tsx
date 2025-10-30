import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Github, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";

interface GitHubConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnect: (owner: string, repo: string, token?: string) => void;
}

export const GitHubConnectDialog = ({ open, onOpenChange, onConnect }: GitHubConnectDialogProps) => {
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [token, setToken] = useState("");
  const [usePrivate, setUsePrivate] = useState(false);

  const handleConnect = () => {
    if (!owner || !repo) {
      toast.error("Please enter repository owner and name");
      return;
    }

    if (usePrivate && !token) {
      toast.error("Please enter a GitHub token for private repositories");
      return;
    }

    onConnect(owner, repo, usePrivate ? token : undefined);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Github className="w-5 h-5" />
            Connect to GitHub Repository
          </DialogTitle>
          <DialogDescription>
            Browse CALM architecture files directly from a GitHub repository.
            Works with public repos by default, or add a token for private access.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="owner">Repository Owner</Label>
            <Input
              id="owner"
              placeholder="e.g., finos"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="repo">Repository Name</Label>
            <Input
              id="repo"
              placeholder="e.g., architecture-as-code"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
            />
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-sm font-medium">Access Type</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-2"
                onClick={() => setUsePrivate(!usePrivate)}
              >
                {usePrivate ? (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    Private
                  </>
                ) : (
                  <>
                    <Unlock className="w-3.5 h-3.5" />
                    Public
                  </>
                )}
              </Button>
            </div>

            {usePrivate && (
              <div className="space-y-2">
                <Label htmlFor="token">GitHub Personal Access Token</Label>
                <Input
                  id="token"
                  type="password"
                  placeholder="ghp_xxxxxxxxxxxx"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Create a token with <code className="bg-muted px-1 rounded">repo</code> scope at{" "}
                  <a
                    href="https://github.com/settings/tokens/new"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    GitHub Settings
                  </a>
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConnect}>
            <Github className="w-4 h-4 mr-2" />
            Connect Repository
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
