import { useMemo, useState } from 'react';
import { ViewToggle } from './ViewToggle.js';
import { OptionSelect } from './OptionSelect.js';
import { ReadableControlDoc } from './ReadableControlDoc.js';
import { ControlSectionColumn } from './ControlSectionColumn.js';
import { ControlConfigurationDoc, ControlData, ControlRequirementDoc } from '../../../model/control.js';
import { JsonRenderer } from '../json-renderer/JsonRenderer.js';
import { ControlService } from '../../../service/control-service.js';
import { useIsMobile } from '../../../hooks/useMediaQuery.js';
import { useControlDocuments } from './useControlDocuments.js';

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

    const {
        controlKey,
        requirementVersions,
        selectedReqVersion,
        requirementJson,
        configs,
        selectedConfigId,
        configVersions,
        selectedConfigVersion,
        configJson,
        selectReqVersion: handleReqVersionClick,
        selectConfig: handleConfigClick,
        selectConfigVersion: handleConfigVersionClick,
    } = useControlDocuments(controlService, controlData);

    // Each section keeps its own readable/raw choice (used only when uncontrolled).
    const [reqViewMode, setReqViewMode] = useState<ViewMode>('readable');
    const [cfgViewMode, setCfgViewMode] = useState<ViewMode>('readable');

    // Mobile only: which of the two sections the tab bar is showing. A new control
    // opens on the requirement.
    const [chosenPanel, setChosenPanel] = useState<{ key: string; panel: ActivePanel } | null>(null);
    const activePanel = chosenPanel?.key === controlKey ? chosenPanel.panel : 'requirement';
    const setActivePanel = (panel: ActivePanel) => setChosenPanel({ key: controlKey, panel });

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
                    className="w-full sm:w-auto"
                    options={configOptions}
                    value={selectedConfigId !== null ? String(selectedConfigId) : ''}
                    onChange={(v) => handleConfigClick(Number(v))}
                />
                <OptionSelect
                    label="Configuration version"
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
