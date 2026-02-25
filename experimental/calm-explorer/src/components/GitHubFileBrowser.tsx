import { useState } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Github, FileJson, Folder, FolderOpen, X } from "lucide-react";
import type { GitHubFile } from "@/services/github";

interface GitHubFileBrowserProps {
  owner: string;
  repo: string;
  files: GitHubFile[];
  selectedFile?: string;
  onFileSelect: (file: GitHubFile) => void;
  onClose: () => void;
}

interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  children?: FileTreeNode[];
  file?: GitHubFile;
}

function buildFileTree(files: GitHubFile[]): FileTreeNode[] {
  const root: FileTreeNode[] = [];

  files.forEach(file => {
    const parts = file.path.split('/');
    let currentLevel = root;

    parts.forEach((part, index) => {
      const isLast = index === parts.length - 1;

      let existingNode = currentLevel.find(node => node.name === part);

      if (!existingNode) {
        const node: FileTreeNode = {
          name: part,
          path: parts.slice(0, index + 1).join('/'),
          type: isLast ? 'file' : 'dir',
          children: isLast ? undefined : [],
          file: isLast ? file : undefined,
        };
        currentLevel.push(node);
        existingNode = node;
      }

      if (!isLast && existingNode.children) {
        currentLevel = existingNode.children;
      }
    });
  });

  return root;
}

function FileTreeItem({
  node,
  level,
  selectedPath,
  onSelect,
}: {
  node: FileTreeNode;
  level: number;
  selectedPath?: string;
  onSelect: (file: GitHubFile) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(level === 0);
  const isSelected = selectedPath === node.path;

  if (node.type === 'file' && node.file) {
    return (
      <div
        className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer rounded text-sm transition-colors ${
          isSelected
            ? 'bg-accent text-accent-foreground'
            : 'hover:bg-accent/50'
        }`}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => onSelect(node.file!)}
      >
        <FileJson className="w-4 h-4 flex-shrink-0 text-blue-500" />
        <span className="truncate">{node.name}</span>
      </div>
    );
  }

  return (
    <div>
      <div
        className="flex items-center gap-2 px-2 py-1.5 cursor-pointer rounded text-sm hover:bg-accent/30 transition-colors"
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? (
          <FolderOpen className="w-4 h-4 flex-shrink-0 text-yellow-500" />
        ) : (
          <Folder className="w-4 h-4 flex-shrink-0 text-yellow-500" />
        )}
        <span className="truncate">{node.name}</span>
      </div>
      {isExpanded && node.children && (
        <div>
          {node.children.map((child, index) => (
            <FileTreeItem
              key={index}
              node={child}
              level={level + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export const GitHubFileBrowser = ({
  owner,
  repo,
  files,
  selectedFile,
  onFileSelect,
  onClose,
}: GitHubFileBrowserProps) => {
  const fileTree = buildFileTree(files);

  return (
    <Card className="h-full flex flex-col border-border bg-card">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Github className="w-4 h-4 text-accent flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-sm truncate">
              {owner}/{repo}
            </h2>
            <p className="text-xs text-muted-foreground">
              {files.length} JSON {files.length === 1 ? 'file' : 'files'}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 flex-shrink-0"
          onClick={onClose}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {fileTree.length > 0 ? (
            fileTree.map((node, index) => (
              <FileTreeItem
                key={index}
                node={node}
                level={0}
                selectedPath={selectedFile}
                onSelect={onFileSelect}
              />
            ))
          ) : (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No JSON files found in this repository
            </div>
          )}
        </div>
      </ScrollArea>
    </Card>
  );
};
