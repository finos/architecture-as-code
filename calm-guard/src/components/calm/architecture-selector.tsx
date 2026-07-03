'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DEMO_ARCHITECTURES } from '../../../examples';
import { parseCalm } from '@/lib/calm/parser';
import { extractAnalysisInput } from '@/lib/calm/extractor';
import { useAnalysisStore } from '@/store/analysis-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, ArrowRight } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalmUploadZone } from '@/components/calm/calm-upload-zone';
import { GitHubInput } from '@/components/calm/github-input';

const FRAMEWORKS = [
  { value: 'SOX', label: 'SOX' },
  { value: 'PCI-DSS', label: 'PCI-DSS' },
  { value: 'NIST-CSF', label: 'NIST-CSF' },
  { value: 'CCC', label: 'FINOS-CCC' },
  { value: 'SOC2', label: 'SOC2' },
] as const;

export function ArchitectureSelector() {
  const router = useRouter();
  const { status, setCalmData, setStatus, setError } = useAnalysisStore();
  const selectedFrameworks = useAnalysisStore((state) => state.selectedFrameworks);
  const toggleFramework = useAnalysisStore((state) => state.toggleFramework);

  const setGitHubAuthEnabled = useAnalysisStore((state) => state.setGitHubAuthEnabled);

  // Check on mount whether GITHUB_TOKEN is configured (for PR generation)
  useEffect(() => {
    fetch('/api/github/status')
      .then((res) => res.json())
      .then((data: unknown) => {
        if (
          typeof data === 'object' &&
          data !== null &&
          'authEnabled' in data &&
          typeof (data as { authEnabled: unknown }).authEnabled === 'boolean'
        ) {
          setGitHubAuthEnabled((data as { authEnabled: boolean }).authEnabled);
        }
      })
      .catch(() => {
        setGitHubAuthEnabled(false);
      });
  }, [setGitHubAuthEnabled]);

  const handleDemoSelection = (demoId: string) => {
    const demo = DEMO_ARCHITECTURES.find((d) => d.id === demoId);

    if (!demo) return;

    setStatus('loading');

    // Parse the selected demo
    const result = parseCalm(demo.data);

    if (result.success) {
      const analysisInput = extractAnalysisInput(result.data);
      setCalmData(result.data, analysisInput, result.version);
    } else {
      setError(result.error);
    }
  };

  const handleStartAnalysis = () => {
    if (status === 'parsed') {
      router.push('/dashboard');
    }
  };

  const isLoading = status === 'loading';
  const isParsed = status === 'parsed';

  return (
    <div className="space-y-6">
      {/* Compliance Framework Selector — visible regardless of active tab */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300">Compliance Frameworks</label>
        <div className="flex items-center gap-4">
          {FRAMEWORKS.map((fw) => (
            <label key={fw.value} className="flex items-center gap-1.5 cursor-pointer">
              <Checkbox
                checked={selectedFrameworks.includes(fw.value)}
                onCheckedChange={() => toggleFramework(fw.value)}
                disabled={selectedFrameworks.length === 1 && selectedFrameworks.includes(fw.value)}
                className="border-slate-600 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
              />
              <span className="text-sm text-slate-300">{fw.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Tab-based input selection */}
      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="w-full bg-slate-800 border border-slate-700 p-1 h-auto">
          <TabsTrigger
            value="upload"
            className="flex-1 data-[state=active]:bg-slate-700 data-[state=active]:text-slate-100 text-slate-400 transition-colors"
          >
            Upload File
          </TabsTrigger>
          <TabsTrigger
            value="github"
            className="flex-1 data-[state=active]:bg-slate-700 data-[state=active]:text-slate-100 text-slate-400 transition-colors"
          >
            From GitHub
          </TabsTrigger>
        </TabsList>

        {/* Upload File tab */}
        <TabsContent value="upload" className="space-y-4 mt-4">
          {/* Demo Architecture Selector */}
          <div className="space-y-2">
            <label
              htmlFor="demo-select"
              className="text-sm font-medium text-slate-300"
            >
              Select Demo Architecture
            </label>
            <Select onValueChange={handleDemoSelection} disabled={isLoading}>
              <SelectTrigger
                id="demo-select"
                className="w-full bg-slate-800 border-slate-700 text-slate-100 hover:bg-slate-700 focus:ring-slate-600"
              >
                <SelectValue placeholder="Choose a demo architecture..." />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {DEMO_ARCHITECTURES.map((demo) => (
                  <SelectItem
                    key={demo.id}
                    value={demo.id}
                    className="text-slate-100 focus:bg-slate-700 focus:text-slate-50"
                  >
                    <div className="flex flex-col items-start">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{demo.name}</span>
                        <Badge
                          variant="secondary"
                          className="bg-slate-700 text-slate-300 text-xs"
                        >
                          {demo.nodeCount} nodes
                        </Badge>
                      </div>
                      <span className="text-xs text-slate-400 mt-1">
                        {demo.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Start Analysis Button */}
          <Button
            onClick={handleStartAnalysis}
            disabled={!isParsed || isLoading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white disabled:bg-slate-700 disabled:text-slate-500 transition-colors"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Parsing Architecture...
              </>
            ) : isParsed ? (
              <>
                Start Analysis
                <ArrowRight className="ml-2 h-5 w-5" />
              </>
            ) : (
              <>Select an architecture to begin</>
            )}
          </Button>

          {/* File Upload */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-300">Or upload your own CALM file</p>
            <CalmUploadZone />
          </div>
        </TabsContent>

        {/* From GitHub tab — always available (public repos work without auth) */}
        <TabsContent value="github" className="mt-4">
          <GitHubInput />
        </TabsContent>
      </Tabs>
    </div>
  );
}
