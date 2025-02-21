import React, { createContext, useState } from 'react';

type ZoomContextProps = {
    zoomLevel: number,
    updateZoom: (newZoomLevel: number) => void
}

type ZoomProviderProps = { children: React.ReactNode; };

const ZoomContext = createContext<ZoomContextProps>({
    zoomLevel: 1, updateZoom: () => {}
});

const ZoomProvider = ({children}: ZoomProviderProps) => {
  const [zoomLevel, setZoomLevel] = useState(1);

  const updateZoom = (newZoomLevel: number) => {
    setZoomLevel(newZoomLevel);
  };

  return (
    <ZoomContext.Provider value={{ zoomLevel, updateZoom }}>
      {children}
    </ZoomContext.Provider>
  );
};

export { ZoomContext, ZoomProvider };