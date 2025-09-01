import React from 'react';
import { Type, MousePointer, Layers } from 'lucide-react';

interface ToolbarProps {
  isAddingText: boolean;
  onToggleAddText: () => void;
  textSettings: {
    fontSize: number;
    color: string;
    fontFamily: string;
  };
  onTextSettingsChange: (settings: any) => void;
  onReorderPages?: () => void;
  selectedText?: {
    fontSize: number;
    color: string;
    fontFamily: string;
  } | null;
  onSelectedTextChange?: (updates: Partial<{
    fontSize: number;
    color: string;
    fontFamily: string;
  }>) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  isAddingText,
  onToggleAddText,
  textSettings,
  onTextSettingsChange,
  onReorderPages,
  selectedText,
  onSelectedTextChange
}) => {
  return (
    <div className="bg-white border-b px-4 py-3">
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => isAddingText && onToggleAddText()}
            className={`flex items-center px-3 py-2 rounded transition-colors ${
              !isAddingText 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-100 hover:bg-gray-200'
            }`}
            title="Select Mode"
          >
            <MousePointer className="w-4 h-4" />
          </button>
          <button
            onClick={() => !isAddingText && onToggleAddText()}
            className={`flex items-center px-3 py-2 rounded transition-colors ${
              isAddingText 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-100 hover:bg-gray-200'
            }`}
            title="Add Text Mode - Click on PDF to add text"
          >
            <Type className="w-4 h-4 mr-2" />
            Add Text
          </button>
        </div>

        {onReorderPages && (
          <button
            onClick={onReorderPages}
            className="flex items-center px-3 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors"
            title="Reorder Pages"
          >
            <Layers className="w-4 h-4 mr-2" />
            Reorder Pages
          </button>
        )}

        {selectedText && onSelectedTextChange && (
          <>
            <div className="flex items-center px-3 py-1 bg-blue-100 border border-blue-300 rounded text-sm">
              <span className="font-medium text-blue-700">Editing Selected Text</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium">Size:</label>
              <input
                type="number"
                value={selectedText.fontSize}
                onChange={(e) => onSelectedTextChange({
                  fontSize: parseInt(e.target.value) || 12
                })}
                className="w-16 px-2 py-1 border rounded"
                min="8"
                max="72"
              />
            </div>

            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium">Color:</label>
              <input
                type="color"
                value={selectedText.color}
                onChange={(e) => onSelectedTextChange({
                  color: e.target.value
                })}
                className="w-8 h-8 border rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium">Font:</label>
              <select
                value={selectedText.fontFamily}
                onChange={(e) => onSelectedTextChange({
                  fontFamily: e.target.value
                })}
                className="px-2 py-1 border rounded"
              >
                <option value="Helvetica">Helvetica</option>
                <option value="Times-Roman">Times Roman</option>
                <option value="Courier">Courier</option>
                <option value="NotoSansThai">Noto Sans Thai (ภาษาไทย)</option>
              </select>
            </div>
          </>
        )}

        {isAddingText && !selectedText && (
          <>
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium">Size:</label>
              <input
                type="number"
                value={textSettings.fontSize}
                onChange={(e) => onTextSettingsChange({
                  ...textSettings,
                  fontSize: parseInt(e.target.value) || 12
                })}
                className="w-16 px-2 py-1 border rounded"
                min="8"
                max="72"
              />
            </div>

            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium">Color:</label>
              <input
                type="color"
                value={textSettings.color}
                onChange={(e) => onTextSettingsChange({
                  ...textSettings,
                  color: e.target.value
                })}
                className="w-8 h-8 border rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium">Font:</label>
              <select
                value={textSettings.fontFamily}
                onChange={(e) => onTextSettingsChange({
                  ...textSettings,
                  fontFamily: e.target.value
                })}
                className="px-2 py-1 border rounded"
              >
                <option value="Helvetica">Helvetica</option>
                <option value="Times-Roman">Times Roman</option>
                <option value="Courier">Courier</option>
                <option value="NotoSansThai">Noto Sans Thai (ภาษาไทย)</option>
              </select>
            </div>
          </>
        )}
      </div>
    </div>
  );
};