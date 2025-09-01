import React from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface ZoomControlsProps {
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToWidth: () => void;
}

export const ZoomControls: React.FC<ZoomControlsProps> = ({
  zoomLevel,
  onZoomIn,
  onZoomOut,
  onFitToWidth
}) => {
  return (
    <div className="flex items-center space-x-2 bg-white border rounded-lg p-2 shadow-sm">
      <button
        onClick={onZoomOut}
        className="p-2 hover:bg-gray-100 rounded transition-colors"
        title="Zoom Out"
      >
        <ZoomOut className="w-4 h-4" />
      </button>
      <span className="px-3 min-w-[80px] text-center text-sm font-medium">
        {Math.round(zoomLevel * 100)}%
      </span>
      <button
        onClick={onZoomIn}
        className="p-2 hover:bg-gray-100 rounded transition-colors"
        title="Zoom In"
      >
        <ZoomIn className="w-4 h-4" />
      </button>
      <div className="w-px h-6 bg-gray-300 mx-1" />
      <button
        onClick={onFitToWidth}
        className="p-2 hover:bg-gray-100 rounded transition-colors"
        title="Fit to Width"
      >
        <Maximize2 className="w-4 h-4" />
      </button>
    </div>
  );
};