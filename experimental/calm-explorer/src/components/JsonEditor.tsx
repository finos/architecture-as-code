import { Editor, loader } from "@monaco-editor/react";
import { Card } from "./ui/card";
import { Upload, FileText, Download } from "lucide-react";
import { Button } from "./ui/button";
import { useRef, useEffect } from "react";
import { toast } from "sonner";
import * as monaco from "monaco-editor";
import { FILE_CONSTRAINTS } from "@/utils/constants";
import type { FileMappings } from "@/types/calm";

// Configure Monaco to use local files instead of CDN for CSP compliance
loader.config({ monaco });

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  onFileUpload: (content: string) => void;
  onEditorReady?: (editor: any) => void;
  onFileMappingsUpload?: (mappings: FileMappings) => void;
  hasFileMappings?: boolean;
}

export const JsonEditor = ({
  value,
  onChange,
  onFileUpload,
  onEditorReady,
  onFileMappingsUpload,
  hasFileMappings = false
}: JsonEditorProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    console.log('JsonEditor value prop changed, length:', value?.length);
    console.log('First 200 chars:', value?.substring(0, 200));
  }, [value]);

  const handleEditorDidMount = (editor: any) => {
    console.log('Monaco editor mounted');
    if (onEditorReady) {
      onEditorReady(editor);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Security: Validate file size
    if (file.size > FILE_CONSTRAINTS.MAX_FILE_SIZE) {
      toast.error(`File too large. Maximum size is ${FILE_CONSTRAINTS.MAX_FILE_SIZE / 1024 / 1024}MB`);
      e.target.value = ''; // Clear the input
      return;
    }

    // Security: Validate file extension
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.json')) {
      toast.error('Invalid file type. Please upload a .json file');
      e.target.value = ''; // Clear the input
      return;
    }

    // Security: Validate MIME type (if available)
    if (file.type && file.type !== 'application/json' && file.type !== 'text/plain') {
      toast.warning('Unexpected file type. Proceeding with caution...');
    }

    const reader = new FileReader();

    reader.onerror = () => {
      toast.error('Failed to read file');
      e.target.value = ''; // Clear the input
    };

    reader.onload = (event) => {
      const content = event.target?.result as string;

      // Additional validation: check content size after reading
      if (content.length > FILE_CONSTRAINTS.MAX_FILE_SIZE) {
        toast.error('File content too large');
        e.target.value = ''; // Clear the input
        return;
      }

      onFileUpload(content);
      e.target.value = ''; // Clear the input for security
    };

    reader.readAsText(file);
  };

  const handleDownload = () => {
    try {
      // Validate JSON before downloading
      JSON.parse(value);

      // Create blob and download
      const blob = new Blob([value], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      a.download = `calm-architecture-${timestamp}.json`;

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('JSON downloaded successfully');
    } catch (error) {
      toast.error('Cannot download: Invalid JSON format');
    }
  };

  return (
    <Card className="h-full flex flex-col overflow-hidden border-border bg-card">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <h2 className="font-semibold">JSON Editor</h2>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="gap-2"
          >
            <Upload className="w-4 h-4" />
            Upload CALM
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Download
          </Button>
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden">
        <Editor
          height="100%"
          defaultLanguage="json"
          value={value}
          onChange={(value) => onChange(value || "")}
          onMount={handleEditorDidMount}
          theme="vs-dark"
          loading={<div className="flex items-center justify-center h-full text-muted-foreground">Loading editor...</div>}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
          }}
        />
      </div>
    </Card>
  );
};
