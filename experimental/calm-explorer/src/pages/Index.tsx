import { useState, useRef, useCallback, useEffect } from "react";
import { Header } from "@/components/Header";
import { NavigationBar } from "@/components/NavigationBar";
import { JsonEditor } from "@/components/JsonEditor";
import { ArchitectureGraph } from "@/components/ArchitectureGraph";
import { NodeDetails } from "@/components/NodeDetails";
import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { MetadataPanel } from "@/components/MetadataPanel";
import { GitHubConnectDialog } from "@/components/GitHubConnectDialog";
import { GitHubFileBrowser } from "@/components/GitHubFileBrowser";
import { GitHubService, GitHubTokenStorage, type GitHubFile } from "@/services/github";
import { safeFetch } from "@/utils/urlValidation";
import { extractId } from "@/utils/calmHelpers";
import { TIMEOUTS } from "@/utils/constants";
import { toast } from "sonner";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useJsonPositionMap } from "@/hooks/useJsonPositionMap";
import type { FileMappings, ControlConfiguration } from "@/types/calm";
import { ControlResolver } from "@/utils/controlResolver";
import SAMPLE_CALM from "../../calm-example.json";

interface ArchitectureLevel {
  name: string;
  jsonContent: string;
  parsedData: any;
}

const Index = () => {
  const [jsonContent, setJsonContent] = useState(JSON.stringify(SAMPLE_CALM, null, 2));
  const [parsedData, setParsedData] = useState<any>(SAMPLE_CALM);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [historyStack, setHistoryStack] = useState<ArchitectureLevel[]>([]);
  const editorRef = useRef<any>(null);
  const decorationsRef = useRef<string[]>([]);

  // GitHub integration state
  const [showGitHubDialog, setShowGitHubDialog] = useState(false);
  const [githubRepo, setGithubRepo] = useState<{ owner: string; repo: string } | null>(null);
  const [githubFiles, setGithubFiles] = useState<GitHubFile[]>([]);
  const [selectedGithubFile, setSelectedGithubFile] = useState<string | undefined>();
  const [githubService, setGithubService] = useState<GitHubService | null>(null);

  // Collapsible panel state
  const [isGithubCollapsed, setIsGithubCollapsed] = useState(false);
  const [isEditorCollapsed, setIsEditorCollapsed] = useState(false);
  const [isMetadataCollapsed, setIsMetadataCollapsed] = useState(false);
  const [editorSizeBeforeCollapse, setEditorSizeBeforeCollapse] = useState(40);

  // Control resolution state
  const [fileMappings, setFileMappings] = useState<FileMappings | null>(null);
  const [resolvedControls, setResolvedControls] = useState<Map<string, ControlConfiguration>>(new Map());
  const [controlResolver] = useState(() => new ControlResolver());

  // Build position map for jump-to-definition
  const positionMap = useJsonPositionMap(jsonContent);

  // Load collapsed states from localStorage on mount
  useEffect(() => {
    const savedGithubCollapsed = localStorage.getItem('panel-github-collapsed');
    const savedEditorCollapsed = localStorage.getItem('panel-editor-collapsed');
    const savedMetadataCollapsed = localStorage.getItem('panel-metadata-collapsed');
    const savedEditorSize = localStorage.getItem('panel-editor-size');

    if (savedGithubCollapsed !== null) setIsGithubCollapsed(savedGithubCollapsed === 'true');
    if (savedEditorCollapsed !== null) setIsEditorCollapsed(savedEditorCollapsed === 'true');
    if (savedMetadataCollapsed !== null) setIsMetadataCollapsed(savedMetadataCollapsed === 'true');
    if (savedEditorSize !== null) setEditorSizeBeforeCollapse(Number(savedEditorSize));
  }, []);

  // Save collapsed states to localStorage
  useEffect(() => {
    localStorage.setItem('panel-github-collapsed', String(isGithubCollapsed));
  }, [isGithubCollapsed]);

  useEffect(() => {
    localStorage.setItem('panel-editor-collapsed', String(isEditorCollapsed));
  }, [isEditorCollapsed]);

  useEffect(() => {
    localStorage.setItem('panel-metadata-collapsed', String(isMetadataCollapsed));
  }, [isMetadataCollapsed]);

  // Load file mappings into control resolver
  useEffect(() => {
    if (fileMappings) {
      controlResolver.loadFileMappings(fileMappings);
    }
  }, [fileMappings, controlResolver]);

  // Resolve controls when parsed data changes
  useEffect(() => {
    if (parsedData) {
      controlResolver.resolveAllControls(parsedData).then(resolved => {
        setResolvedControls(resolved);
      }).catch(error => {
        console.error('Failed to resolve controls:', error);
      });
    }
  }, [parsedData, controlResolver]);

  const handleJsonChange = (value: string) => {
    setJsonContent(value);
    try {
      const parsed = JSON.parse(value);
      setParsedData(parsed);
      toast.success("JSON parsed successfully");
    } catch (error) {
      toast.error("Invalid JSON format");
    }
  };

  const handleFileUpload = (content: string) => {
    setJsonContent(content);
    try {
      const parsed = JSON.parse(content);
      setParsedData(parsed);
      toast.success("File loaded successfully");
    } catch (error) {
      toast.error("Invalid JSON file");
    }
  };

  const handleFileMappingsUpload = (mappings: FileMappings) => {
    setFileMappings(mappings);
  };

  const jumpToDefinition = useCallback((id: string, type: 'node' | 'relationship' | 'control' | 'interface') => {
    console.log('jumpToDefinition called:', { id, type, hasEditor: !!editorRef.current });

    // Auto-expand editor if collapsed
    if (isEditorCollapsed) {
      setIsEditorCollapsed(false);
    }

    if (!editorRef.current) {
      console.warn('Editor not ready');
      return;
    }

    const location = type === 'node'
      ? positionMap.nodes.get(id)
      : type === 'relationship'
        ? positionMap.relationships.get(id)
        : type === 'interface'
          ? positionMap.interfaces.get(id)
          : positionMap.controls.get(id);

    if (!location) {
      console.warn(`No position found for ${type} with id: ${id}`);
      return;
    }

    const editor = editorRef.current;

    // json-source-map returns { value, valueEnd } or just { line, column, pos }
    const start = (location as any).value || (location as any).start || location;
    const end = (location as any).valueEnd || (location as any).end || location;

    if (!start || typeof start.line !== 'number') {
      console.warn(`Invalid location structure for ${type} with id: ${id}`, location);
      return;
    }

    // Convert 0-based positions to 1-based Monaco positions
    const startLine = start.line + 1;
    const startColumn = start.column + 1;
    const endLine = end.line + 1;
    const endColumn = end.column + 1;

    // Scroll to and reveal the line
    editor.revealLineInCenter(startLine);

    // Set selection to highlight the entire object
    editor.setSelection({
      startLineNumber: startLine,
      startColumn: startColumn,
      endLineNumber: endLine,
      endColumn: endColumn,
    });

    // Add decoration for visual highlighting
    const newDecorations = editor.deltaDecorations(decorationsRef.current, [
      {
        range: {
          startLineNumber: startLine,
          startColumn: 1,
          endLineNumber: endLine,
          endColumn: endColumn,
        },
        options: {
          isWholeLine: false,
          className: 'highlighted-definition',
          glyphMarginClassName: 'highlighted-glyph',
          inlineClassName: 'highlighted-inline',
        },
      },
    ]);

    decorationsRef.current = newDecorations;

    // Focus the editor
    editor.focus();

    // Clear decorations after timeout
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.deltaDecorations(decorationsRef.current, []);
        decorationsRef.current = [];
      }
    }, TIMEOUTS.EDITOR_DECORATION_TIMEOUT);
  }, [positionMap, isEditorCollapsed]);

  const handleNodeClick = useCallback((node: any) => {
    console.log('handleNodeClick called:', node);
    const nodeId = extractId(node);
    console.log('Extracted node ID:', nodeId);
    if (nodeId) {
      jumpToDefinition(nodeId, 'node');
    }
    setSelectedNode(node);
  }, [jumpToDefinition]);

  const handleEdgeClick = useCallback((edge: any) => {
    const edgeId = extractId(edge);
    if (edgeId) {
      jumpToDefinition(edgeId, 'relationship');
    }
  }, [jumpToDefinition]);

  const handleLoadDetailedArchitecture = useCallback(async (url: string, parentNodeName?: string) => {
    try {
      // Save current state to history before navigating
      const currentLevel: ArchitectureLevel = {
        name: parsedData?.metadata?.name || 'Root Architecture',
        jsonContent,
        parsedData,
      };

      // Security: Use safe fetch with URL validation and timeout
      const response = await safeFetch(url, {
        timeout: TIMEOUTS.FETCH_TIMEOUT,
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }
      const content = await response.text();
      const parsed = JSON.parse(content);

      // Update the editor and parsed data
      setJsonContent(JSON.stringify(parsed, null, 2));
      setParsedData(parsed);
      setSelectedNode(null); // Close node details

      // Push current state to history
      setHistoryStack(prev => [...prev, currentLevel]);

      toast.success(`Loaded detailed architecture${parentNodeName ? ` for ${parentNodeName}` : ''}`);
    } catch (error) {
      console.error('Error loading detailed architecture:', error);
      toast.error(`Failed to load architecture: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [jsonContent, parsedData]);

  const handleNavigateBack = useCallback(() => {
    if (historyStack.length === 0) return;

    // Pop the last level from history
    const previousLevel = historyStack[historyStack.length - 1];
    const newHistory = historyStack.slice(0, -1);

    // Restore previous state
    setJsonContent(previousLevel.jsonContent);
    setParsedData(previousLevel.parsedData);
    setSelectedNode(null);
    setHistoryStack(newHistory);

    toast.success(`Returned to ${previousLevel.name}`);
  }, [historyStack]);

  const handleConnectGitHub = useCallback(async (owner: string, repo: string, branch?: string, token?: string) => {
    try {
      // Save token if provided
      if (token) {
        await GitHubTokenStorage.save(token);
      } else {
        // Try to load saved token
        const savedToken = await GitHubTokenStorage.load();
        token = savedToken || undefined;
      }

      const service = new GitHubService(token);
      setGithubService(service);

      const branchInfo = branch ? ` (branch: ${branch})` : '';
      toast.promise(
        service.getRepoTree(owner, repo, branch),
        {
          loading: `Connecting to ${owner}/${repo}${branchInfo}...`,
          success: (files) => {
            setGithubRepo({ owner, repo });
            setGithubFiles(files);
            setSelectedGithubFile(undefined);
            return `Connected! Found ${files.length} JSON files`;
          },
          error: (err) => `Failed to connect: ${err.message}`,
        }
      );
    } catch (error) {
      console.error('Error connecting to GitHub:', error);
    }
  }, []);

  const handleGitHubFileSelect = useCallback(async (file: GitHubFile) => {
    if (!githubRepo || !githubService) {
      console.error('Missing GitHub repo or service:', { githubRepo, githubService });
      return;
    }

    try {
      console.log('handleGitHubFileSelect called with file:', file);
      setSelectedGithubFile(file.path);

      console.log('Calling githubService.getFileContent...');

      // Fetch content with loading toast
      toast.loading(`Loading ${file.path}...`);
      const content = await githubService.getFileContent(githubRepo.owner, githubRepo.repo, file.path);

      console.log('Got content from GitHub, type:', typeof content, 'length:', content?.length);
      console.log('Content preview:', typeof content === 'string' ? content.substring(0, 200) : content);

      if (typeof content !== 'string') {
        throw new Error(`Expected string content, got ${typeof content}`);
      }

      // Clear history when loading from GitHub
      setHistoryStack([]);

      console.log('Parsing JSON...');
      const parsed = JSON.parse(content);
      console.log('Parsed successfully, setting editor content...');

      const formattedContent = JSON.stringify(parsed, null, 2);
      console.log('Formatted content length:', formattedContent.length);

      setJsonContent(formattedContent);
      setParsedData(parsed);
      setSelectedNode(null);

      toast.dismiss();
      toast.success(`Loaded ${file.path}`);

      console.log('Editor content should now be updated');
    } catch (error) {
      console.error('Error loading GitHub file:', error);
      toast.dismiss();
      toast.error(`Failed to load file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [githubRepo, githubService]);

  const handleCloseGitHub = useCallback(() => {
    setGithubRepo(null);
    setGithubFiles([]);
    setSelectedGithubFile(undefined);
    setGithubService(null);
  }, []);

  const flows = parsedData?.flows || [];

  // Collect controls from both root level (old format) and from nodes and relationships (new CALM spec format)
  const rootControls = parsedData?.controls || {};
  const nodeControls: Record<string, any> = {};
  const relationshipControls: Record<string, any> = {};

  // Extract controls from nodes
  const nodes = parsedData?.nodes || [];
  nodes.forEach((node: any) => {
    if (node.controls) {
      const nodeId = extractId(node);
      Object.entries(node.controls).forEach(([controlId, control]: [string, any]) => {
        // Prefix with node ID to make it unique and show which node it applies to
        const uniqueControlId = `${nodeId}/${controlId}`;
        nodeControls[uniqueControlId] = {
          ...control,
          appliesTo: nodeId,
          nodeName: node.name || nodeId,
          appliesToType: 'node',
        };
      });
    }
  });

  // Extract controls from relationships
  const relationships = parsedData?.relationships || [];
  relationships.forEach((relationship: any) => {
    if (relationship.controls) {
      const relId = extractId(relationship);
      Object.entries(relationship.controls).forEach(([controlId, control]: [string, any]) => {
        // Prefix with relationship ID to make it unique and show which relationship it applies to
        const uniqueControlId = `${relId}/${controlId}`;
        relationshipControls[uniqueControlId] = {
          ...control,
          appliesTo: relId,
          relationshipDescription: relationship.description || relId,
          appliesToType: 'relationship',
        };
      });
    }
  });

  // Merge all control sources (root-level takes precedence for same IDs)
  const controls = { ...nodeControls, ...relationshipControls, ...rootControls };

  const hasFlows = flows.length > 0;
  const hasControls = Object.keys(controls).length > 0;
  const hasMetadata = hasFlows || hasControls;

  // Build breadcrumbs from history
  const breadcrumbs = historyStack.map(level => level.name);
  const currentArchitectureName = parsedData?.metadata?.name;

  const hasGithub = githubRepo && githubFiles.length > 0;

  return (
    <div className="h-screen bg-background flex flex-col">
      <Header onConnectGitHub={() => setShowGitHubDialog(true)} />
      <NavigationBar
        currentArchitectureName={currentArchitectureName}
        breadcrumbs={breadcrumbs}
        canNavigateBack={historyStack.length > 0}
        onNavigateBack={handleNavigateBack}
      />

      <GitHubConnectDialog
        open={showGitHubDialog}
        onOpenChange={setShowGitHubDialog}
        onConnect={handleConnectGitHub}
      />

      <main className="flex-1 flex flex-col overflow-hidden min-h-0">
        <div className="flex-1 w-full overflow-hidden min-h-0">
          <ResizablePanelGroup direction="vertical" className="h-full">
            {/* Main content area */}
            <ResizablePanel defaultSize={hasMetadata && !isMetadataCollapsed ? 70 : 100} minSize={30}>
              <ResizablePanelGroup direction="horizontal">
                {/* GitHub File Browser - Collapsible Left Panel */}
                {hasGithub && (
                  <>
                    <ResizablePanel
                      defaultSize={isGithubCollapsed ? 4 : 20}
                      minSize={isGithubCollapsed ? 4 : 15}
                      maxSize={isGithubCollapsed ? 4 : 35}
                      collapsible={true}
                    >
                      {!isGithubCollapsed ? (
                        <CollapsiblePanel
                          isCollapsed={false}
                          onToggle={() => setIsGithubCollapsed(true)}
                          position="left"
                          title="GitHub Files"
                        >
                          <GitHubFileBrowser
                            owner={githubRepo.owner}
                            repo={githubRepo.repo}
                            files={githubFiles}
                            selectedFile={selectedGithubFile}
                            onFileSelect={handleGitHubFileSelect}
                            onClose={handleCloseGitHub}
                          />
                        </CollapsiblePanel>
                      ) : (
                        <div className="h-full w-full">
                          <CollapsiblePanel
                            isCollapsed={true}
                            onToggle={() => setIsGithubCollapsed(false)}
                            position="left"
                            title="GitHub"
                          >
                            <div />
                          </CollapsiblePanel>
                        </div>
                      )}
                    </ResizablePanel>
                    {!isGithubCollapsed && <ResizableHandle withHandle />}
                  </>
                )}

                {/* JSON Editor - Collapsible Center-Left Panel */}
                <ResizablePanel
                  defaultSize={isEditorCollapsed ? 4 : editorSizeBeforeCollapse}
                  minSize={isEditorCollapsed ? 4 : 20}
                  maxSize={isEditorCollapsed ? 4 : 100}
                  collapsible={true}
                  onResize={(size) => {
                    if (!isEditorCollapsed && size > 0) {
                      setEditorSizeBeforeCollapse(size);
                      localStorage.setItem('panel-editor-size', String(size));
                    }
                  }}
                >
                  {!isEditorCollapsed ? (
                    <CollapsiblePanel
                      isCollapsed={false}
                      onToggle={() => setIsEditorCollapsed(true)}
                      position="left"
                      title="JSON Editor"
                    >
                      <JsonEditor
                        value={jsonContent}
                        onChange={handleJsonChange}
                        onFileUpload={handleFileUpload}
                        onEditorReady={(editor) => (editorRef.current = editor)}
                        onFileMappingsUpload={handleFileMappingsUpload}
                        hasFileMappings={!!fileMappings}
                      />
                    </CollapsiblePanel>
                  ) : (
                    <div className="h-full w-full">
                      <CollapsiblePanel
                        isCollapsed={true}
                        onToggle={() => setIsEditorCollapsed(false)}
                        position="left"
                        title="JSON"
                      >
                        <div />
                      </CollapsiblePanel>
                    </div>
                  )}
                </ResizablePanel>
                {!isEditorCollapsed && <ResizableHandle withHandle />}

                {/* Graph Visualization - Always visible, takes remaining space */}
                <ResizablePanel>
                  <div className="h-full p-6">
                    <ArchitectureGraph
                      jsonData={parsedData}
                      onNodeClick={handleNodeClick}
                      onEdgeClick={handleEdgeClick}
                      onJumpToControl={(controlId) => jumpToDefinition(controlId, 'control')}
                      onJumpToNode={(nodeId) => jumpToDefinition(nodeId, 'node')}
                    />
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>

            {/* Bottom Panel: Flows + Controls - Collapsible */}
            {hasMetadata && !isMetadataCollapsed && (
              <>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={30} minSize={15} maxSize={50}>
                  <MetadataPanel
                    flows={flows}
                    controls={controls}
                    onTransitionClick={(relId) => jumpToDefinition(relId, 'relationship')}
                    onNodeClick={(nodeId) => {
                      const node = parsedData?.nodes?.find((n: any) => n['unique-id'] === nodeId);
                      if (node) handleNodeClick(node);
                    }}
                    onControlClick={(controlId) => jumpToDefinition(controlId, 'control')}
                    isCollapsed={false}
                    onToggleCollapse={() => setIsMetadataCollapsed(true)}
                  />
                </ResizablePanel>
              </>
            )}

            {hasMetadata && isMetadataCollapsed && (
              <div style={{ height: '48px' }}>
                <MetadataPanel
                  flows={flows}
                  controls={controls}
                  onTransitionClick={(relId) => jumpToDefinition(relId, 'relationship')}
                  onNodeClick={(nodeId) => {
                    const node = parsedData?.nodes?.find((n: any) => n['unique-id'] === nodeId);
                    if (node) handleNodeClick(node);
                  }}
                  onControlClick={(controlId) => jumpToDefinition(controlId, 'control')}
                  isCollapsed={true}
                  onToggleCollapse={() => setIsMetadataCollapsed(false)}
                />
              </div>
            )}
          </ResizablePanelGroup>
        </div>
      </main>

      {/* Node Details Slide-out Panel */}
      <Sheet open={!!selectedNode} onOpenChange={(open) => !open && setSelectedNode(null)}>
        <SheetContent side="right" className="w-[500px] sm:w-[600px] overflow-y-auto">
          {selectedNode && (
            <NodeDetails
              node={selectedNode}
              onClose={() => setSelectedNode(null)}
              onLoadDetailedArchitecture={handleLoadDetailedArchitecture}
              onJumpToControl={(controlId) => jumpToDefinition(controlId, 'control')}
              onJumpToInterface={(interfaceId) => jumpToDefinition(interfaceId, 'interface')}
              resolvedControls={resolvedControls}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Index;
