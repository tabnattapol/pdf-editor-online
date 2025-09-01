import React from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface FabricZoomControlsProps {
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToWidth: () => void;
}

export const FabricZoomControls: React.FC<FabricZoomControlsProps> = ({
  zoomLevel,
  onZoomIn,
  onZoomOut,
  onFitToWidth
}) => {
  return (
    <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-2 flex items-center space-x-2">
      <button
        onClick={onZoomOut}
        className="p-2 hover:bg-gray-100 rounded"
        title="Zoom Out"
      >
        <ZoomOut className="w-5 h-5" />
      </button>
      
      <span className="px-3 py-1 min-w-[80px] text-center text-sm font-medium">
        {Math.round(zoomLevel * 100)}%
      </span>
      
      <button
        onClick={onZoomIn}
        className="p-2 hover:bg-gray-100 rounded"
        title="Zoom In"
      >
        <ZoomIn className="w-5 h-5" />
      </button>
      
      <div className="w-px h-6 bg-gray-300" />
      
      <button
        onClick={onFitToWidth}
        className="p-2 hover:bg-gray-100 rounded"
        title="Fit to Width"
      >
        <Maximize2 className="w-5 h-5" />
      </button>
    </div>
  );
};