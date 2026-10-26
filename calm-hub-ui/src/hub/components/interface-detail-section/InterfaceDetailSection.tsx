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

    const { namespace, interfaceId } = interfaceData;
    const interfaceKey = `${namespace}|${interfaceId}`;
    const [viewMode, setViewMode] = useState<ViewMode>('readable');

    // Each result is kept with the interface (and version) it was fetched for, so a
    // change of interface resets the view during render.
    const [loadedVersions, setLoadedVersions] = useState<{ key: string; versions: string[] } | null>(null);
    const [chosenVersion, setChosenVersion] = useState<{ key: string; version: string } | null>(null);
    const [loadedJson, setLoadedJson] = useState<{ key: string; json: object | undefined } | null>(null);

    const versions = loadedVersions?.key === interfaceKey ? loadedVersions.versions : [];
    // The first version is selected until the user picks another.
    const selectedVersion = chosenVersion?.key === interfaceKey ? chosenVersion.version : (versions[0] ?? '');
    const jsonKey = `${interfaceKey}|${selectedVersion}`;
    const interfaceJson = loadedJson?.key === jsonKey ? loadedJson.json : undefined;

    const handleVersionClick = useCallback(
        (version: string) => setChosenVersion({ key: interfaceKey, version }),
        [interfaceKey]
    );

    useEffect(() => {
        let cancelled = false;
        interfaceService.fetchInterfaceVersions(namespace, interfaceId)
            .catch((error) => {
                console.error('Failed to fetch interface versions', error);
                return [];
            })
            .then((list) => {
                if (!cancelled) setLoadedVersions({ key: interfaceKey, versions: list });
            });
        return () => {
            cancelled = true;
        };
    }, [interfaceService, namespace, interfaceId, interfaceKey]);

    useEffect(() => {
        if (!selectedVersion) return;
        let cancelled = false;
        interfaceService.fetchInterfaceForVersion(namespace, interfaceId, selectedVersion)
            .then((data) => data as object | undefined)
            .catch((error) => {
                console.error('Failed to fetch interface version', error);
                return undefined;
            })
            .then((json) => {
                if (!cancelled) setLoadedJson({ key: jsonKey, json });
            });
        return () => {
            cancelled = true;
        };
    }, [interfaceService, namespace, interfaceId, selectedVersion, jsonKey]);

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
                                <span className="text-base-content/40">/</span>
                                <span>{selectedVersion}</span>
                            </>
                        )}
                    </h2>
                    {/* Readable / Raw toggle */}
                    <div role="tablist" className="tabs tabs-boxed tabs-xs bg-base-100">
                        <button
                            role="tab"
                            className={`tab ${viewMode === 'readable' ? 'tab-active !bg-accent !text-accent-content' : ''}`}
                            onClick={() => setViewMode('readable')}
                        >
                            Readable
                        </button>
                        <button
                            role="tab"
                            className={`tab ${viewMode === 'raw' ? 'tab-active !bg-accent !text-accent-content' : ''}`}
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
                                    className={`tab gap-1 rounded-lg ${selectedVersion === v ? 'tab-active !bg-accent !text-accent-content' : ''}`}
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
