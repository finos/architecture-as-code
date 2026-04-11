'use client';

import { useRef, useCallback, useState } from 'react';
import { Upload, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseCalm } from '@/lib/calm/parser';
import { extractAnalysisInput } from '@/lib/calm/extractor';
import { useAnalysisStore } from '@/store/analysis-store';
import type { CalmValidationResult } from '@/lib/calm/cli-validator';

type UploadStatus = 'idle' | 'parsing' | 'validating' | 'ready' | 'error';

/**
 * CalmUploadZone — drag-and-drop or click-to-browse file upload.
 *
 * Flow: idle → parsing → validating → ready (or error at any step)
 * On success: calls setCalmData(doc, input) to set store status='parsed'
 * On failure: shows inline error messages and allows re-upload
 */
export function CalmUploadZone() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [errors, setErrors] = useState<string[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const { setCalmData } = useAnalysisStore();

  const processFile = useCallback(
    async (file: File) => {
      // Validate file extension
      if (!file.name.endsWith('.json')) {
        setStatus('error');
        setErrors(['Only .json files are accepted']);
        return;
      }

      setFileName(file.name);
      setErrors([]);

      // Step 1: Parse JSON
      setStatus('parsing');
      let parsed: unknown;
      let rawText: string;
      try {
        rawText = await file.text();
        parsed = JSON.parse(rawText);
      } catch {
        setStatus('error');
        setErrors(['Invalid JSON — file could not be parsed']);
        return;
      }

      // Step 2: Local CALM schema validation via Zod
      const localResult = parseCalm(parsed);
      if (!localResult.success) {
        setStatus('error');
        const msgs = localResult.error.issues?.map((i) => i.message) ?? [
          'CALM schema validation failed — file does not match CALM v1.1 structure',
        ];
        setErrors(msgs.slice(0, 5));
        return;
      }

      // Step 3: CLI validation via /api/calm/validate
      setStatus('validating');
      let validation: CalmValidationResult;
      try {
        const res = await fetch('/api/calm/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ calm: parsed }),
        });
        validation = (await res.json()) as CalmValidationResult;
      } catch {
        // Network error — skip CLI validation, use local result only
        validation = { valid: true, errors: [] };
      }

      if (!validation.valid && validation.errors.length > 0) {
        setStatus('error');
        setErrors(validation.errors.slice(0, 5).map((e) => e.message));
        return;
      }

      // Step 4: Success — populate the Zustand store
      const input = extractAnalysisInput(localResult.data);
      setCalmData(localResult.data, input, localResult.version);
      setStatus('ready');
    },
    [setCalmData],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) {
        void processFile(file);
      }
    },
    [processFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleClick = useCallback(() => {
    // Prevent click-to-browse in terminal states (ready/error recover by
    // re-clicking the zone which resets state first)
    inputRef.current?.click();
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        void processFile(file);
      }
      // Reset input value so the same file can be re-selected after error
      e.target.value = '';
    },
    [processFile],
  );

  const isProcessing = status === 'parsing' || status === 'validating';

  return (
    <div className="space-y-1">
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleInputChange}
        aria-label="Upload CALM JSON file"
      />

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Drop CALM JSON file here or click to browse"
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') handleClick();
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          'relative border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-all duration-200',
          // Idle state
          status === 'idle' &&
            !isDragOver &&
            'border-slate-700 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-800/30',
          // Drag-over state
          isDragOver &&
            'border-emerald-500 bg-emerald-500/5',
          // Processing states
          isProcessing &&
            'border-blue-500/50 bg-blue-500/5 cursor-not-allowed',
          // Ready state
          status === 'ready' &&
            'border-emerald-500/50 bg-emerald-500/5',
          // Error state
          status === 'error' &&
            'border-red-500/50 bg-red-500/5',
        )}
      >
        {/* Idle */}
        {status === 'idle' && !isDragOver && (
          <>
            <Upload className="mx-auto h-8 w-8 text-slate-600 mb-2" />
            <p className="text-sm text-slate-400">Drop CALM JSON here</p>
            <p className="text-xs text-slate-500 mt-0.5">or click to browse</p>
          </>
        )}

        {/* Drag over */}
        {isDragOver && (
          <>
            <Upload className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
            <p className="text-sm text-emerald-400 font-medium">Release to upload</p>
          </>
        )}

        {/* Parsing */}
        {status === 'parsing' && (
          <>
            <Loader2 className="mx-auto h-8 w-8 text-blue-400 mb-2 animate-spin" />
            <p className="text-sm text-blue-400">Parsing JSON...</p>
            {fileName && (
              <p className="text-xs text-slate-500 mt-0.5 truncate">{fileName}</p>
            )}
          </>
        )}

        {/* Validating */}
        {status === 'validating' && (
          <>
            <Loader2 className="mx-auto h-8 w-8 text-blue-400 mb-2 animate-spin" />
            <p className="text-sm text-blue-400">Validating CALM schema...</p>
            {fileName && (
              <p className="text-xs text-slate-500 mt-0.5 truncate">{fileName}</p>
            )}
          </>
        )}

        {/* Ready */}
        {status === 'ready' && (
          <>
            <CheckCircle className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
            <p className="text-sm text-emerald-400 font-medium">Ready for analysis</p>
            {fileName && (
              <p className="text-xs text-slate-500 mt-0.5 truncate">{fileName}</p>
            )}
          </>
        )}

        {/* Error */}
        {status === 'error' && (
          <>
            <XCircle className="mx-auto h-8 w-8 text-red-500 mb-2" />
            <p className="text-sm text-red-400 font-medium mb-1">Validation failed</p>
            {errors.length > 0 && (
              <ul className="text-xs text-red-400/80 space-y-0.5 text-left px-2">
                {errors.map((err, i) => (
                  <li key={i} className="truncate">
                    &bull; {err}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-slate-500 mt-2">Click to try another file</p>
          </>
        )}
      </div>
    </div>
  );
}
