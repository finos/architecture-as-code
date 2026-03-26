import { useEffect, useState } from 'react';
import { IoShieldCheckmarkOutline } from 'react-icons/io5';
import { ControlData } from '../../../model/control.js';
import { JsonRenderer } from '../json-renderer/JsonRenderer.js';
import { ReadableJsonView } from './ReadableJsonView.js';
import {
    fetchRequirementVersions,
    fetchRequirementForVersion,
    fetchConfigurationsForControl,
    fetchConfigurationVersions,
    fetchConfigurationForVersion,
} from '../../../service/control-service.js';

type ViewMode = 'readable' | 'raw';

interface ControlDetailSectionProps {
    controlData: ControlData;
}

export function ControlDetailSection({ controlData }: ControlDetailSectionProps) {
    // Requirement state
    const [requirementVersions, setRequirementVersions] = useState<string[]>([]);
    const [selectedReqVersion, setSelectedReqVersion] = useState<string>('');
    const [requirementJson, setRequirementJson] = useState<object | undefined>();

    // Configuration state
    const [configIds, setConfigIds] = useState<number[]>([]);
    const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null);
    const [configVersions, setConfigVersions] = useState<string[]>([]);
    const [selectedConfigVersion, setSelectedConfigVersion] = useState<string>('');
    const [configJson, setConfigJson] = useState<object | undefined>();

    // View mode state (readable is the primary/default view)
    const [reqViewMode, setReqViewMode] = useState<ViewMode>('readable');
    const [cfgViewMode, setCfgViewMode] = useState<ViewMode>('readable');

    // When control changes, load requirement versions and configurations
    useEffect(() => {
        setRequirementVersions([]);
        setSelectedReqVersion('');
        setRequirementJson(undefined);
        setConfigIds([]);
        setSelectedConfigId(null);
        setConfigVersions([]);
        setSelectedConfigVersion('');
        setConfigJson(undefined);

        fetchRequirementVersions(
            controlData.domain,
            controlData.controlId,
            setRequirementVersions
        );
        fetchConfigurationsForControl(
            controlData.domain,
            controlData.controlId,
            setConfigIds
        );
    }, [controlData.domain, controlData.controlId]);

    // Auto-select first requirement version when versions load
    useEffect(() => {
        if (requirementVersions.length > 0 && !selectedReqVersion) {
            handleReqVersionClick(requirementVersions[0]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [requirementVersions]);

    const handleReqVersionClick = (version: string) => {
        setSelectedReqVersion(version);
        fetchRequirementForVersion(
            controlData.domain,
            controlData.controlId,
            version
        ).then((data) => {
            setRequirementJson(data as object | undefined);
        });
    };

    const handleConfigClick = (configId: number) => {
        setSelectedConfigId(configId);
        setSelectedConfigVersion('');
        setConfigJson(undefined);
        fetchConfigurationVersions(
            controlData.domain,
            controlData.controlId,
            configId,
            setConfigVersions
        );
    };

    const handleConfigVersionClick = (version: string) => {
        if (selectedConfigId === null) return;
        setSelectedConfigVersion(version);
        fetchConfigurationForVersion(
            controlData.domain,
            controlData.controlId,
            selectedConfigId,
            version
        ).then((data) => {
            setConfigJson(data as object | undefined);
        });
    };

    return (
        <div className="w-full h-full py-4 pl-2 pr-4 flex flex-col gap-4">
            {/* Top section: Requirement */}
            <div className="flex-1 min-h-0 bg-base-100 rounded-2xl overflow-hidden flex flex-col shadow-xl">
                {/* Requirement breadcrumb header */}
                <div className="bg-base-200 px-6 py-2 flex items-center justify-between border-b border-base-300">
                    <h2 className="text-sm font-bold flex items-center gap-2">
                        <IoShieldCheckmarkOutline className="text-accent" />
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
                    <div role="tablist" className="tabs tabs-boxed tabs-xs bg-base-100">
                        <button
                            role="tab"
                            className={`tab ${reqViewMode === 'readable' ? 'tab-active !bg-accent !text-white' : ''}`}
                            onClick={() => setReqViewMode('readable')}
                        >
                            Readable
                        </button>
                        <button
                            role="tab"
                            className={`tab ${reqViewMode === 'raw' ? 'tab-active !bg-accent !text-white' : ''}`}
                            onClick={() => setReqViewMode('raw')}
                        >
                            Raw JSON
                        </button>
                    </div>
                </div>

                {/* Requirement version tabs */}
                {requirementVersions.length > 1 && (
                    <div className="bg-base-200 px-6 pb-2 border-b border-base-300">
                        <div role="tablist" className="tabs tabs-boxed tabs-sm bg-base-100">
                            {requirementVersions.map((v) => (
                                <button
                                    key={v}
                                    role="tab"
                                    className={`tab gap-1 rounded-lg ${selectedReqVersion === v ? 'tab-active !bg-accent !text-white' : ''}`}
                                    onClick={() => handleReqVersionClick(v)}
                                >
                                    {v}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Requirement content */}
                <div className="flex-1 min-h-0 overflow-auto bg-base-200">
                    {reqViewMode === 'readable' ? (
                        <ReadableJsonView json={requirementJson} />
                    ) : (
                        <JsonRenderer json={requirementJson} />
                    )}
                </div>
            </div>

            {/* Bottom section: Configurations */}
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
                                <span>{selectedConfigId}</span>
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
                    <div role="tablist" className="tabs tabs-boxed tabs-xs bg-base-100">
                        <button
                            role="tab"
                            className={`tab ${cfgViewMode === 'readable' ? 'tab-active !bg-accent !text-white' : ''}`}
                            onClick={() => setCfgViewMode('readable')}
                        >
                            Readable
                        </button>
                        <button
                            role="tab"
                            className={`tab ${cfgViewMode === 'raw' ? 'tab-active !bg-accent !text-white' : ''}`}
                            onClick={() => setCfgViewMode('raw')}
                        >
                            Raw JSON
                        </button>
                    </div>
                </div>

                {/* Configuration breadcrumb navigation */}
                <div className="bg-base-200 px-6 pb-2 border-b border-base-300 flex gap-2 flex-wrap">
                    {/* Config ID tabs */}
                    <div role="tablist" className="tabs tabs-boxed tabs-sm bg-base-100">
                        {configIds.map((cid) => (
                            <button
                                key={cid}
                                role="tab"
                                className={`tab gap-1 rounded-lg ${selectedConfigId === cid ? 'tab-active !bg-accent !text-white' : ''}`}
                                onClick={() => handleConfigClick(cid)}
                            >
                                Config {cid}
                            </button>
                        ))}
                        {configIds.length === 0 && (
                            <span className="text-base-content/60 text-sm px-2 py-1">No configurations</span>
                        )}
                    </div>

                    {/* Config version tabs (shown when a config is selected) */}
                    {selectedConfigId !== null && configVersions.length > 0 && (
                        <>
                            <span className="text-gray-400 self-center">/</span>
                            <div role="tablist" className="tabs tabs-boxed tabs-sm bg-base-100">
                                {configVersions.map((v) => (
                                    <button
                                        key={v}
                                        role="tab"
                                        className={`tab gap-1 rounded-lg ${selectedConfigVersion === v ? 'tab-active !bg-accent !text-white' : ''}`}
                                        onClick={() => handleConfigVersionClick(v)}
                                    >
                                        {v}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Configuration content */}
                <div className="flex-1 min-h-0 overflow-auto bg-base-200">
                    {cfgViewMode === 'readable' ? (
                        <ReadableJsonView json={configJson} />
                    ) : (
                        <JsonRenderer json={configJson} />
                    )}
                </div>
            </div>
        </div>
    );
}
