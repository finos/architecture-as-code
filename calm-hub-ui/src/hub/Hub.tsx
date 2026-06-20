import { useCallback, useMemo, useState } from 'react';
import { IoChevronForwardOutline, IoMenuOutline } from 'react-icons/io5';
import { TreeNavigation } from './components/tree-navigation/TreeNavigation.js';
import { useIsMobile } from '../hooks/useMediaQuery.js';
import { Data, Adr } from '../model/calm.js';
import { ControlData } from '../model/control.js';
import { InterfaceData } from '../model/interface.js';
import { Navbar } from '../components/navbar/Navbar.js';
import { AdrRenderer } from './components/adr-renderer/AdrRenderer.js';
import { DocumentDetailSection } from './components/document-detail-section/DocumentDetailSection.js';
import { ControlDetailSection } from './components/control-detail-section/ControlDetailSection.js';
import { InterfaceDetailSection } from './components/interface-detail-section/InterfaceDetailSection.js';
import { DiagramSection } from './components/diagram-section/DiagramSection.js';
import { Sidebar } from '../visualizer/components/sidebar/Sidebar.js';
import type { SelectedItem } from '../visualizer/contracts/contracts.js';
import './Hub.css';

export default function Hub() {
    const [data, setData] = useState<Data | undefined>();
    const [adrData, setAdrData] = useState<Adr | undefined>();
    const [controlData, setControlData] = useState<ControlData | undefined>();
    const [interfaceData, setInterfaceData] = useState<InterfaceData | undefined>();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);
    const isMobile = useIsMobile();

    function handleDataLoad(data: Data) {
        setData(data);
        setAdrData(undefined);
        setControlData(undefined);
        setInterfaceData(undefined);
        setSelectedItem(null);
        setIsMobileNavOpen(false);
    }

    function handleAdrLoad(adr: Adr) {
        setAdrData(adr);
        setData(undefined);
        setControlData(undefined);
        setInterfaceData(undefined);
        setSelectedItem(null);
        setIsMobileNavOpen(false);
    }

    function handleControlLoad(control: ControlData) {
        setControlData(control);
        setData(undefined);
        setAdrData(undefined);
        setInterfaceData(undefined);
        setSelectedItem(null);
        setIsMobileNavOpen(false);
    }

    function handleInterfaceLoad(iface: InterfaceData) {
        setInterfaceData(iface);
        setData(undefined);
        setAdrData(undefined);
        setControlData(undefined);
        setSelectedItem(null);
        setIsMobileNavOpen(false);
    }

    const handleItemSelect = useCallback((item: SelectedItem) => {
        setSelectedItem(item);
    }, []);

    const closeSidebar = useCallback(() => {
        setSelectedItem(null);
    }, []);

    const isDiagramView = data?.calmType === 'Architectures' || data?.calmType === 'Patterns';

    const memoizedDataLoad = useMemo(() => handleDataLoad, []);
    const memoizedAdrLoad = useMemo(() => handleAdrLoad, []);

    const treeNavigation = (
        <TreeNavigation
            onDataLoad={memoizedDataLoad}
            onAdrLoad={memoizedAdrLoad}
            onControlLoad={handleControlLoad}
            onInterfaceLoad={handleInterfaceLoad}
            onCollapse={isMobile ? () => setIsMobileNavOpen(false) : () => setIsSidebarOpen(false)}
        />
    );

    const detailContent = interfaceData ? (
        <InterfaceDetailSection interfaceData={interfaceData} />
    ) : controlData ? (
        <ControlDetailSection controlData={controlData} />
    ) : adrData ? (
        <AdrRenderer adrDetails={adrData} />
    ) : isDiagramView ? (
        <DiagramSection data={data} onItemSelect={handleItemSelect} hasDetailsPanel={!!selectedItem} />
    ) : (
        <DocumentDetailSection data={data} />
    );

    return (
        <div className="flex flex-col h-screen overflow-hidden">
            <Navbar />
            <div className="relative flex flex-row flex-1 overflow-hidden bg-base-300">
                {/* Desktop: inline, collapsible tree-navigation column */}
                {!isMobile && (
                    <div className={`${isSidebarOpen ? 'w-1/4' : 'w-12'} p-4 pr-2 transition-all duration-300`}>
                        <div className="h-full bg-base-100 rounded-box overflow-hidden shadow-xl flex flex-col">
                            {isSidebarOpen ? (
                                <div className="flex-1 min-h-0 overflow-hidden">{treeNavigation}</div>
                            ) : (
                                <div className="flex items-center justify-center pt-3">
                                    <button
                                        aria-label="Expand sidebar"
                                        className="btn btn-ghost btn-xs btn-circle"
                                        onClick={() => setIsSidebarOpen(true)}
                                    >
                                        <IoChevronForwardOutline />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Mobile: off-canvas tree-navigation drawer */}
                {isMobile && isMobileNavOpen && (
                    <div className="fixed inset-0 z-40 flex" role="dialog" aria-modal="true">
                        <button
                            aria-label="Close navigation"
                            className="absolute inset-0 bg-black/40"
                            onClick={() => setIsMobileNavOpen(false)}
                        />
                        <div className="relative h-full w-80 max-w-[85%] p-3 pr-0">
                            <div className="h-full bg-base-100 rounded-box overflow-hidden shadow-xl flex flex-col">
                                <div className="flex-1 min-h-0 overflow-hidden">{treeNavigation}</div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    {isMobile && (
                        <div className="px-3 pt-3 shrink-0">
                            <button
                                aria-label="Open navigation"
                                className="btn btn-sm btn-ghost gap-2"
                                onClick={() => setIsMobileNavOpen(true)}
                            >
                                <IoMenuOutline className="text-lg" />
                                Explore
                            </button>
                        </div>
                    )}
                    <div className="flex-1 overflow-auto min-w-0">{detailContent}</div>
                </div>

                {selectedItem && isDiagramView && (
                    isMobile ? (
                        <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true">
                            <button
                                aria-label="Close details"
                                className="absolute inset-0 bg-black/40"
                                onClick={closeSidebar}
                            />
                            <div className="relative h-full w-full max-w-sm">
                                <Sidebar selectedData={selectedItem.data} closeSidebar={closeSidebar} />
                            </div>
                        </div>
                    ) : (
                        <Sidebar selectedData={selectedItem.data} closeSidebar={closeSidebar} />
                    )
                )}
            </div>
        </div>
    );
}
