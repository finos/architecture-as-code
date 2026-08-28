import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ViewToggle } from './ViewToggle.js';
import { OptionSelect } from './OptionSelect.js';
import { ReadableControlDoc } from './ReadableControlDoc.js';
import { ControlSectionColumn } from './ControlSectionColumn.js';
import {
    ControlConfigDetail,
    ControlConfigurationDoc,
    ControlData,
    ControlRequirementDoc,
} from '../../../model/control.js';
import { JsonRenderer } from '../json-renderer/JsonRenderer.js';
import { ControlService } from '../../../service/control-service.js';
import { useIsMobile } from '../../../hooks/useMediaQuery.js';

export type ViewMode = 'readable' | 'raw';
type ActivePanel = 'requirement' | 'configuration';

interface ControlDetailSectionProps {
    controlData: ControlData;
    /**
     * When provided, the readable/raw view is controlled by the parent (the
     * ControlPanel renders a single toggle in its header) and the per-section
     * toggles are hidden. When omitted, each section manages its own toggle
     * (standalone use).
     */
    viewMode?: ViewMode;
}

/**
 * Requirement and Configuration for a selected control. Desktop shows the two
 * side by side; mobile shows them as tabs. Each keeps its own version pickers and
 * its own readable/raw state.
 */
export function ControlDetailSection({ controlData, viewMode }: ControlDetailSectionProps) {
    const controlService = useMemo(() => new ControlService(), []);
    const isMobile = useIsMobile();

    // Requirement state
    const [requirementVersions, setRequirementVersions] = useState<string[]>([]);
    const [selectedReqVersion, setSelectedReqVersion] = useState<string>('');
    const [requirementJson, setRequirementJson] = useState<ControlRequirementDoc | undefined>();

    // Configuration state
    const [configs, setConfigs] = useState<ControlConfigDetail[]>([]);
    const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null);
    const [configVersions, setConfigVersions] = useState<string[]>([]);
    const [selectedConfigVersion, setSelectedConfigVersion] = useState<string>('');
    const [configJson, setConfigJson] = useState<ControlConfigurationDoc | undefined>();

    // Each section keeps its own readable/raw choice (used only when uncontrolled).
    const [reqViewMode, setReqViewMode] = useState<ViewMode>('readable');
    const [cfgViewMode, setCfgViewMode] = useState<ViewMode>('readable');

    // Mobile only: which of the two sections the tab bar is showing.
    const [activePanel, setActivePanel] = useState<ActivePanel>('requirement');

    // Bumped whenever the control changes; async responses that resolve after a
    // switch are ignored so a slow request for the previous control can never
    // populate the panel (and its rejection is swallowed rather than left
    // unhandled).
    const loadGen = useRef(0);

    const handleReqVersionClick = useCallback((version: string) => {
        const gen = loadGen.current;
        setSelectedReqVersion(version);
        controlService.fetchRequirementForVersion(
            controlData.domain,
            controlData.controlId,
            version
        )
            .then((doc) => { if (loadGen.current === gen) setRequirementJson(doc); })
            .catch((error) => {
                if (loadGen.current !== gen) return;
                console.error('%s', 'Failed to load control requirement:', error);
                setRequirementJson(undefined);
            });
    }, [controlService, controlData.domain, controlData.controlId]);

    const handleConfigClick = useCallback((configId: number) => {
        const gen = loadGen.current;
        setSelectedConfigId(configId);
        setSelectedConfigVersion('');
        setConfigJson(undefined);
        controlService.fetchConfigurationVersions(
            controlData.domain,
            controlData.controlId,
            configId,
        )
            .then((versions) => { if (loadGen.current === gen) setConfigVersions(versions); })
            .catch((error) => {
                if (loadGen.current !== gen) return;
                console.error('%s', 'Failed to load configuration versions:', error);
                setConfigVersions([]);
            });
    }, [controlService, controlData.domain, controlData.controlId]);

    const handleConfigVersionClick = useCallback((version: string) => {
        if (selectedConfigId === null) return;
        const gen = loadGen.current;
        setSelectedConfigVersion(version);
        controlService.fetchConfigurationForVersion(
            controlData.domain,
            controlData.controlId,
            selectedConfigId,
            version
        )
            .then((doc) => { if (loadGen.current === gen) setConfigJson(doc); })
            .catch((error) => {
                if (loadGen.current !== gen) return;
                console.error('%s', 'Failed to load configuration:', error);
                setConfigJson(undefined);
            });
    }, [controlService, controlData.domain, controlData.controlId, selectedConfigId]);

    // When the control changes, load requirement versions and configurations
    useEffect(() => {
        const gen = ++loadGen.current;
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
        )
            .then((versions) => { if (loadGen.current === gen) setRequirementVersions(versions); })
            .catch((error) => {
                if (loadGen.current !== gen) return;
                console.error('%s', 'Failed to load requirement versions:', error);
                setRequirementVersions([]);
            });
        controlService.fetchConfigurationsForControl(
            controlData.domain,
            controlData.controlId,
        )
            .then((list) => { if (loadGen.current === gen) setConfigs(list); })
            .catch((error) => {
                if (loadGen.current !== gen) return;
                console.error('%s', 'Failed to load configurations:', error);
                setConfigs([]);
            });
    }, [controlService, controlData.domain, controlData.controlId]);

    // Auto-select first requirement version when versions load
    useEffect(() => {
        if (requirementVersions.length > 0 && !selectedReqVersion) {
            handleReqVersionClick(requirementVersions[0]);
        }
    }, [requirementVersions, selectedReqVersion, handleReqVersionClick]);

    // Auto-select a lone configuration (its picker is hidden for a single option)
    useEffect(() => {
        if (configs.length === 1 && selectedConfigId === null) {
            handleConfigClick(configs[0].id);
        }
    }, [configs, selectedConfigId, handleConfigClick]);

    // Auto-select a lone configuration version
    useEffect(() => {
        if (configVersions.length === 1 && !selectedConfigVersion) {
            handleConfigVersionClick(configVersions[0]);
        }
    }, [configVersions, selectedConfigVersion, handleConfigVersionClick]);

    const reqVersionOptions = requirementVersions.map((v) => ({ value: v, label: v }));
    const configOptions = configs.map((c) => ({
        value: String(c.id),
        label: c.title ?? c.name ?? `Config ${c.id}`,
    }));
    const configVersionOptions = configVersions.map((v) => ({ value: v, label: v }));
    const showConfig = configs.length > 0;

    const renderBody = (
        doc: ControlRequirementDoc | ControlConfigurationDoc | undefined,
        mode: ViewMode,
    ) =>
        mode === 'readable' ? (
            <ReadableControlDoc doc={doc} />
        ) : (
            <div className="h-full">
                <JsonRenderer json={doc} />
            </div>
        );

    const reqPicker =
        reqVersionOptions.length > 1 ? (
            <OptionSelect
                label="Requirement version"
                className="w-full sm:w-auto"
                options={reqVersionOptions}
                value={selectedReqVersion}
                onChange={handleReqVersionClick}
            />
        ) : null;

    const configPicker =
        configOptions.length > 1 || configVersionOptions.length > 1 ? (
            <>
                <OptionSelect
                    label="Configuration"
                    placeholder="Select a configuration"
                    className="w-full sm:w-auto"
                    options={configOptions}
                    value={selectedConfigId !== null ? String(selectedConfigId) : ''}
                    onChange={(v) => handleConfigClick(Number(v))}
                />
                <OptionSelect
                    label="Configuration version"
                    placeholder="Select a version"
                    className="w-full sm:w-auto"
                    options={configVersionOptions}
                    value={selectedConfigVersion}
                    onChange={handleConfigVersionClick}
                />
            </>
        ) : null;

    // ── Mobile: Requirement / Configuration as tabs ─────────────────────────
    if (isMobile) {
        const panel: ActivePanel =
            activePanel === 'configuration' && showConfig ? 'configuration' : 'requirement';
        const activeViewMode =
            viewMode ?? (panel === 'requirement' ? reqViewMode : cfgViewMode);
        const setActiveViewMode = panel === 'requirement' ? setReqViewMode : setCfgViewMode;

        return (
            <div className="w-full h-full flex flex-col bg-base-100">
                <div className="flex items-center justify-between pr-2">
                    <div role="tablist" className="tabs tabs-bordered">
                        <button
                            type="button"
                            role="tab"
                            className={`tab ${panel === 'requirement' ? 'tab-active text-primary font-semibold' : ''}`}
                            onClick={() => setActivePanel('requirement')}
                        >
                            Requirement
                        </button>
                        {showConfig && (
                            <button
                                type="button"
                                role="tab"
                                className={`tab ${panel === 'configuration' ? 'tab-active text-primary font-semibold' : ''}`}
                                onClick={() => setActivePanel('configuration')}
                            >
                                Configuration
                            </button>
                        )}
                    </div>
                    {viewMode === undefined && (
                        <ViewToggle mode={activeViewMode} onChange={setActiveViewMode} />
                    )}
                </div>

                {panel === 'requirement' ? (
                    <div className="flex-1 min-h-0 flex flex-col">
                        {reqPicker && <div className="px-4 pb-2">{reqPicker}</div>}
                        <div className="flex-1 min-h-0 overflow-auto bg-base-100">
                            {renderBody(requirementJson, activeViewMode)}
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 min-h-0 flex flex-col">
                        {configPicker && (
                            <div className="px-4 pb-2 flex flex-col gap-2">{configPicker}</div>
                        )}
                        <div className="flex-1 min-h-0 overflow-auto bg-base-100">
                            {renderBody(configJson, activeViewMode)}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ── Desktop: Requirement and Configuration side by side ─────────────────
    return (
        <div className="w-full h-full flex gap-4 bg-base-100">
            <ControlSectionColumn
                label="Requirement"
                picker={reqPicker}
                toggle={
                    viewMode === undefined ? (
                        <ViewToggle mode={reqViewMode} onChange={setReqViewMode} />
                    ) : null
                }
            >
                {renderBody(requirementJson, viewMode ?? reqViewMode)}
            </ControlSectionColumn>

            {showConfig && (
                <ControlSectionColumn
                    label="Configuration"
                    picker={configPicker}
                    toggle={
                        viewMode === undefined ? (
                            <ViewToggle mode={cfgViewMode} onChange={setCfgViewMode} />
                        ) : null
                    }
                >
                    {renderBody(configJson, viewMode ?? cfgViewMode)}
                </ControlSectionColumn>
            )}
        </div>
    );
}
