import { useCallback, useEffect, useMemo, useState } from 'react';
import { IoLayersOutline } from 'react-icons/io5';
import { InterfaceData } from '../../../model/interface.js';
import { JsonRenderer } from '../json-renderer/JsonRenderer.js';
import { ReadableJsonView } from '../control-detail-section/ReadableJsonView.js';
import { InterfaceService } from '../../../service/interface-service.js';

type ViewMode = 'readable' | 'raw';

interface InterfaceDetailSectionProps {
    interfaceData: InterfaceData;
}

export function InterfaceDetailSection({ interfaceData }: InterfaceDetailSectionProps) {
    const interfaceService = useMemo(() => new InterfaceService(), []);

    const [versions, setVersions] = useState<string[]>([]);
    const [selectedVersion, setSelectedVersion] = useState<string>('');
    const [interfaceJson, setInterfaceJson] = useState<object | undefined>();
    const [viewMode, setViewMode] = useState<ViewMode>('readable');

    const handleVersionClick = useCallback((version: string) => {
        setSelectedVersion(version);
        interfaceService.fetchInterfaceForVersion(
            interfaceData.namespace,
            interfaceData.interfaceId,
            version
        ).then((data) => {
            setInterfaceJson(data as object | undefined);
        }).catch((error) => {
            console.error('Failed to fetch interface version', error);
            setInterfaceJson(undefined);
        });
    }, [interfaceService, interfaceData.namespace, interfaceData.interfaceId]);

    // When the interface changes, load versions
    useEffect(() => {
        setVersions([]);
        setSelectedVersion('');
        setInterfaceJson(undefined);

        interfaceService.fetchInterfaceVersions(
            interfaceData.namespace,
            interfaceData.interfaceId,
        ).then(setVersions).catch((error) => {
            console.error('Failed to fetch interface versions', error);
            setVersions([]);
        });
    }, [interfaceService, interfaceData.namespace, interfaceData.interfaceId]);

    // Auto-select first version when versions load
    useEffect(() => {
        if (versions.length > 0 && !selectedVersion) {
            handleVersionClick(versions[0]);
        }
    }, [versions, selectedVersion, handleVersionClick]);

    return (
        <div className="w-full h-full py-4 pl-2 pr-4 flex flex-col gap-4">
            <div className="flex-1 min-h-0 bg-base-100 rounded-2xl overflow-hidden flex flex-col shadow-xl">
                {/* Breadcrumb header */}
                <div className="bg-base-200 px-6 py-2 flex items-center justify-between border-b border-base-300">
                    <h2 className="text-sm font-bold flex items-center gap-2">
                        <IoLayersOutline className="text-accent" />
                        <span>{interfaceData.interfaceName}</span>
                        {selectedVersion && (
                            <>
                                <span className="text-gray-400">/</span>
                                <span>{selectedVersion}</span>
                            </>
                        )}
                    </h2>
                    {/* Readable / Raw toggle */}
                    <div role="tablist" className="tabs tabs-boxed tabs-xs bg-base-100">
                        <button
                            role="tab"
                            className={`tab ${viewMode === 'readable' ? 'tab-active !bg-accent !text-white' : ''}`}
                            onClick={() => setViewMode('readable')}
                        >
                            Readable
                        </button>
                        <button
                            role="tab"
                            className={`tab ${viewMode === 'raw' ? 'tab-active !bg-accent !text-white' : ''}`}
                            onClick={() => setViewMode('raw')}
                        >
                            Raw JSON
                        </button>
                    </div>
                </div>

                {/* Version tabs */}
                {versions.length > 1 && (
                    <div className="bg-base-200 px-6 pb-2 border-b border-base-300">
                        <div role="tablist" className="tabs tabs-boxed tabs-sm bg-base-100">
                            {versions.map((v) => (
                                <button
                                    key={v}
                                    role="tab"
                                    className={`tab gap-1 rounded-lg ${selectedVersion === v ? 'tab-active !bg-accent !text-white' : ''}`}
                                    onClick={() => handleVersionClick(v)}
                                >
                                    {v}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 min-h-0 overflow-auto bg-base-200">
                    {viewMode === 'readable' ? (
                        <ReadableJsonView json={interfaceJson} />
                    ) : (
                        <JsonRenderer json={interfaceJson} />
                    )}
                </div>
            </div>
        </div>
    );
}
