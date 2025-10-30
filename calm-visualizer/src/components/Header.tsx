import { FileJson2, Github } from "lucide-react";
import { Button } from "./ui/button";

interface HeaderProps {
  onConnectGitHub?: () => void;
}

export const Header = ({ onConnectGitHub }: HeaderProps) => {
  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-primary shadow-glow-primary">
              <FileJson2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                CALM Explorer
              </h1>
              <p className="text-xs text-muted-foreground">FINOS Common Architecture Language Model</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onConnectGitHub && (
              <Button
                variant="default"
                size="sm"
                className="gap-2"
                onClick={onConnectGitHub}
              >
                <Github className="w-4 h-4" />
                <span className="hidden sm:inline">Connect GitHub</span>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              asChild
            >
              <a href="https://github.com/finos/architecture-as-code" target="_blank" rel="noopener noreferrer">
                <Github className="w-4 h-4" />
                <span className="hidden sm:inline">FINOS CALM</span>
              </a>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};
