'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

export interface ExportReportModalProps {
  /** Controls dialog open/closed state */
  open: boolean;
  /** Callback to close the dialog */
  onClose: () => void;
  /** Markdown content to preview and download */
  markdown: string;
  /** Filename for the downloaded .md file */
  filename: string;
}

/**
 * ExportReportModal
 *
 * Dialog-based report preview with client-side Blob download.
 * Shows a scrollable markdown preview and provides a "Download .md" button.
 * No server round-trip required — download is handled entirely client-side.
 */
export function ExportReportModal({
  open,
  onClose,
  markdown,
  filename,
}: ExportReportModalProps) {
  const handleDownload = () => {
    // Create a Blob with the markdown content
    const blob = new Blob([markdown], { type: 'text/markdown; charset=utf-8' });
    const url = URL.createObjectURL(blob);

    // Programmatic click on a temporary anchor element
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    // Release object URL to free memory
    URL.revokeObjectURL(url);

    // Close modal after triggering download
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="bg-slate-900 border-slate-800 max-w-4xl flex flex-col max-h-[85vh]">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-slate-100 text-lg font-semibold">
            Compliance Report Preview
          </DialogTitle>
          <p className="text-sm text-slate-400 mt-1">
            Review the generated report below, then download as a Markdown file.
          </p>
        </DialogHeader>

        {/* Scrollable report preview */}
        <div className="flex-1 min-h-0 overflow-auto border border-slate-700 rounded-lg bg-slate-950/50 max-h-[60vh]">
          <pre className="whitespace-pre-wrap text-xs text-slate-300 font-mono p-4 leading-relaxed">
            {markdown}
          </pre>
        </div>

        <DialogFooter className="shrink-0 flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-slate-100"
          >
            Cancel
          </Button>
          <Button
            onClick={handleDownload}
            className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2"
          >
            <Download className="h-4 w-4" />
            Download .md
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
