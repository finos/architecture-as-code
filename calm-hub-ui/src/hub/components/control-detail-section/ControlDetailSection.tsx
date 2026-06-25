import { useCallback, useEffect, useMemo, useState } from 'react';
import { IoShieldCheckmarkOutline } from 'react-icons/io5';
import { ControlConfigDetail, ControlData } from '../../../model/control.js';
import { JsonRenderer } from '../json-renderer/JsonRenderer.js';
import { ReadableJsonView } from './ReadableJsonView.js';
import { ControlService } from '../../../service/control-service.js';
import { useIsMobile } from '../../../hooks/useMediaQuery.js';

type ViewMode = 'readable' | 'raw';
type ControlPanel = 'requirement' | 'configuration';

interface ControlDetailSectionProps {
    controlData: ControlData;
}

export function ControlDetailSection({ controlData }: ControlDetailSectionProps) {
    const controlService = useMemo(() => new ControlService(), []);
    const isMobile = useIsMobile();

    // Requirement state
    const [requirementVersions, setRequirementVersions] = useState<string[]>([]);
    const [selectedReqVersion, setSelectedReqVersion] = useState<string>('');
    const [requirementJson, setRequirementJson] = useState<object | undefined>();

    // Configuration state
    const [configs, setConfigs] = useState<ControlConfigDetail[]>([]);
    const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null);
    const [configVersions, setConfigVersions] = useState<string[]>([]);
    const [selectedConfigVersion, setSelectedConfigVersion] = useState<string>('');
    const [configJson, setConfigJson] = useState<object | undefined>();

    // View mode state (readable is the primary/default view)
    const [reqViewMode, setReqViewMode] = useState<ViewMode>('readable');
    const [cfgViewMode, setCfgViewMode] = useState<ViewMode>('readable');

    // On mobile the requirement and configuration panels are shown as tabs
    // rather than stacked, so we track which one is active.
    const [activePanel, setActivePanel] = useState<ControlPanel>('requirement');

    const handleReqVersionClick = useCallback((version: string) => {
        setSelectedReqVersion(version);
        controlService.fetchRequirementForVersion(
            controlData.domain,
            controlData.controlId,
            version
        ).then((data) => {
            setRequirementJson(data as object | undefined);
        });
    }, [controlService, controlData.domain, controlData.controlId]);

    // When control changes, load requirement versions and configurations
    useEffect(() => {
        setRequirementVersions([]);
        setSelectedReqVersion('');
        setRequirementJson(undefined);
        setConfigs([]);
        setSelectedConfigId(null);
        setConfigVersions([]);
        setSelectedConfigVersion('');
        setConfigJson(undefined);
        setActivePanel('requirement');

        controlService.fetchRequirementVersions(
            controlData.domain,
            controlData.controlId,
        ).then(setRequirementVersions);
        controlService.fetchConfigurationsForControl(
            controlData.domain,
            controlData.controlId,
        ).then(setConfigs);
    }, [controlService, controlData.domain, controlData.controlId]);

    // Auto-select first requirement version when versions load
    useEffect(() => {
        if (requirementVersions.length > 0 && !selectedReqVersion) {
            handleReqVersionClick(requirementVersions[0]);
        }
    }, [requirementVersions, selectedReqVersion, handleReqVersionClick]);

    const handleConfigClick = (configId: number) => {
        setSelectedConfigId(configId);
        setSelectedConfigVersion('');
        setConfigJson(undefined);
        controlService.fetchConfigurationVersions(
            controlData.domain,
            controlData.controlId,
            configId,
        ).then(setConfigVersions);
    };

    const handleConfigVersionClick = (version: string) => {
        if (selectedConfigId === null) return;
        setSelectedConfigVersion(version);
        controlService.fetchConfigurationForVersion(
            controlData.domain,
            controlData.controlId,
            selectedConfigId,
            version
        ).then((data) => {
            setConfigJson(data as object | undefined);
        });
    };

    // ── Shared builders (used by both the desktop stacked layout and the
    //    mobile tabbed layout) so role/name selectors stay identical. ─────────

    const viewToggle = (mode: ViewMode, setMode: (m: ViewMode) => void) => (
        <div role="tablist" className="tabs tabs-boxed tabs-xs bg-base-100">
            <button
                role="tab"
                className={`tab ${mode === 'readable' ? 'tab-active !bg-primary !text-primary-content' : ''}`}
                onClick={() => setMode('readable')}
            >
                Readable
            </button>
            <button
                role="tab"
                className={`tab ${mode === 'raw' ? 'tab-active !bg-primary !text-primary-content' : ''}`}
                onClick={() => setMode('raw')}
            >
                Raw JSON
            </button>
        </div>
    );

    const reqVersionButtons = requirementVersions.map((v) => (
        <button
            key={v}
            role="tab"
            className={`tab gap-1 rounded-lg ${selectedReqVersion === v ? 'tab-active !bg-primary !text-primary-content' : ''}`}
            onClick={() => handleReqVersionClick(v)}
        >
            {v}
        </button>
    ));

    const configIdButtons = configs.map((cfg) => (
        <button
            key={cfg.id}
            role="tab"
            className={`tab gap-1 rounded-lg ${selectedConfigId === cfg.id ? 'tab-active !bg-primary !text-primary-content' : ''}`}
            onClick={() => handleConfigClick(cfg.id)}
        >
            {cfg.title ?? cfg.name ?? `Config ${cfg.id}`}
        </button>
    ));

    const configVersionButtons = configVersions.map((v) => (
        <button
            key={v}
            role="tab"
            className={`tab gap-1 rounded-lg ${selectedConfigVersion === v ? 'tab-active !bg-primary !text-primary-content' : ''}`}
            onClick={() => handleConfigVersionClick(v)}
        >
            {v}
        </button>
    ));

    const requirementContent = reqViewMode === 'readable' ? (
        <ReadableJsonView json={requirementJson} />
    ) : (
        <JsonRenderer json={requirementJson} />
    );

    const configurationContent = cfgViewMode === 'readable' ? (
        <ReadableJsonView json={configJson} />
    ) : (
        <JsonRenderer json={configJson} />
    );

    // ── Mobile: a single full-bleed pane with Requirement / Configuration
    //    tabs, stacked headers, and horizontally scrollable version pickers. ──
    if (isMobile) {
        const showConfig = configs.length > 0;
        const panel = activePanel === 'configuration' && showConfig ? 'configuration' : 'requirement';

        return (
            <div className="w-full h-full flex flex-col bg-base-100">
                {/* Control name */}
                <div className="bg-base-200 px-4 py-3 border-b border-base-300">
                    <h2 className="text-base font-bold flex items-center gap-2 text-primary min-w-0">
                        <IoShieldCheckmarkOutline className="text-primary shrink-0" />
                        <span className="truncate">{controlData.controlName}</span>
                    </h2>
                </div>

                {/* Requirement / Configuration tabs */}
                <div role="tablist" className="tabs tabs-bordered bg-base-100 border-b border-base-200 px-2">
                    <button
                        role="tab"
                        className={`tab flex-1 ${panel === 'requirement' ? 'tab-active text-primary font-semibold' : ''}`}
                        onClick={() => setActivePanel('requirement')}
                    >
                        Requirement
                    </button>
                    {showConfig && (
                        <button
                            role="tab"
                            className={`tab flex-1 ${panel === 'configuration' ? 'tab-active text-primary font-semibold' : ''}`}
                            onClick={() => setActivePanel('configuration')}
                        >
                            Configuration
                        </button>
                    )}
                </div>

                {panel === 'requirement' ? (
                    <div className="flex-1 min-h-0 flex flex-col">
                        {/* Breadcrumb + view toggle */}
                        <div className="bg-base-200 px-4 py-2 border-b border-base-300 flex items-center justify-between gap-2">
                            <h2 className="text-xs font-semibold text-base-content/70 truncate">
                                Requirement{selectedReqVersion ? ` / ${selectedReqVersion}` : ''}
                            </h2>
                            {viewToggle(reqViewMode, setReqViewMode)}
                        </div>
                        {requirementVersions.length > 1 && (
                            <div className="bg-base-200 px-4 pb-2 border-b border-base-300 overflow-x-auto">
                                <div role="tablist" className="tabs tabs-boxed tabs-sm bg-base-100 w-max">
                                    {reqVersionButtons}
                                </div>
                            </div>
                        )}
                        <div className="flex-1 min-h-0 overflow-auto bg-base-200">
                            {requirementContent}
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 min-h-0 flex flex-col">
                        {/* Breadcrumb + view toggle */}
                        <div className="bg-base-200 px-4 py-2 border-b border-base-300 flex items-center justify-between gap-2">
                            <h2 className="text-xs font-semibold text-base-content/70 truncate">
                                Configurations
                                {selectedConfigId !== null ? ` / ${configs.find(c => c.id === selectedConfigId)?.title ?? configs.find(c => c.id === selectedConfigId)?.name ?? `Config ${selectedConfigId}`}` : ''}
                                {selectedConfigVersion ? ` / ${selectedConfigVersion}` : ''}
                            </h2>
                            {viewToggle(cfgViewMode, setCfgViewMode)}
                        </div>
                        <div className="bg-base-200 px-4 pb-2 border-b border-base-300 overflow-x-auto">
                            <div className="flex items-center gap-2 w-max">
                                <div role="tablist" className="tabs tabs-boxed tabs-sm bg-base-100">
                                    {configIdButtons}
                                </div>
                                {selectedConfigId !== null && configVersions.length > 0 && (
                                    <>
                                        <span className="text-gray-400">/</span>
                                        <div role="tablist" className="tabs tabs-boxed tabs-sm bg-base-100">
                                            {configVersionButtons}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="flex-1 min-h-0 overflow-auto bg-base-200">
                            {configurationContent}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ── Desktop: the original two stacked panels (Requirement / Configurations). ──
    return (
        <div className="w-full h-full py-4 pl-2 pr-4 flex flex-col gap-4">
            {/* Top section: Requirement */}
            <div className="flex-1 min-h-0 bg-base-100 rounded-2xl overflow-hidden flex flex-col shadow-xl">
                {/* Requirement breadcrumb header */}
                <div className="bg-base-200 px-6 py-2 flex items-center justify-between border-b border-base-300">
                    <h2 className="text-sm font-bold flex items-center gap-2 text-primary">
                        <IoShieldCheckmarkOutline className="text-primary" />
                        <span>{controlData.controlName}</span>
                        <span className="text-gray-400">/</span>
                        <span>Requirement</span>
                        {selectedReqVersion && (
                            <>
                                <span className="text-gray-400">/</span>
                                <span>{selectedReqVersion}</span>
                            </>
                        )}
                    </h2>
                    {/* Readable / Raw toggle */}
                    {viewToggle(reqViewMode, setReqViewMode)}
                </div>

                {/* Requirement version tabs */}
                {requirementVersions.length > 1 && (
                    <div className="bg-base-200 px-6 pb-2 border-b border-base-300">
                        <div role="tablist" className="tabs tabs-boxed tabs-sm bg-base-100">
                            {reqVersionButtons}
                        </div>
                    </div>
                )}

                {/* Requirement content */}
                <div className="flex-1 min-h-0 overflow-auto bg-base-200">
                    {requirementContent}
                </div>
            </div>

            {/* Bottom section: Configurations (only shown if any exist) */}
            {configs.length > 0 && (
                <div className="flex-1 min-h-0 bg-base-100 rounded-2xl overflow-hidden flex flex-col shadow-xl">
                {/* Configuration breadcrumb header */}
                <div className="bg-base-200 px-6 py-2 flex items-center justify-between border-b border-base-300">
                    <h2 className="text-sm font-bold flex items-center gap-2">
                        <IoShieldCheckmarkOutline className="text-accent" />
                        <span>{controlData.controlName}</span>
                        <span className="text-gray-400">/</span>
                        <span>Configurations</span>
                        {selectedConfigId !== null && (
                            <>
                                <span className="text-gray-400">/</span>
                                <span>{configs.find(c => c.id === selectedConfigId)?.title ?? configs.find(c => c.id === selectedConfigId)?.name ?? `Config ${selectedConfigId}`}</span>
                            </>
                        )}
                        {selectedConfigVersion && (
                            <>
                                <span className="text-gray-400">/</span>
                                <span>{selectedConfigVersion}</span>
                            </>
                        )}
                    </h2>
                    {/* Readable / Raw toggle */}
                    {viewToggle(cfgViewMode, setCfgViewMode)}
                </div>

                {/* Configuration breadcrumb navigation */}
                <div className="bg-base-200 px-6 pb-2 border-b border-base-300 flex gap-2 flex-wrap">
                    {/* Config ID tabs */}
                    <div role="tablist" className="tabs tabs-boxed tabs-sm bg-base-100">
                        {configIdButtons}
                    </div>

                    {/* Config version tabs (shown when a config is selected) */}
                    {selectedConfigId !== null && configVersions.length > 0 && (
                        <>
                            <span className="text-gray-400 self-center">/</span>
                            <div role="tablist" className="tabs tabs-boxed tabs-sm bg-base-100">
                                {configVersionButtons}
                            </div>
                        </>
                    )}
                </div>

                {/* Configuration content */}
                <div className="flex-1 min-h-0 overflow-auto bg-base-200">
                    {configurationContent}
                </div>
                </div>
            )}
        </div>
    );
}
