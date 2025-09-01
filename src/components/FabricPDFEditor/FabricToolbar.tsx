import React from 'react';
import { Type, MousePointer } from 'lucide-react';

interface FabricToolbarProps {
  isAddingText: boolean;
  onToggleAddText: () => void;
  textSettings: {
    fontSize: number;
    color: string;
    fontFamily: string;
  };
  onTextSettingsChange: (settings: any) => void;
}

export const FabricToolbar: React.FC<FabricToolbarProps> = ({
  isAddingText,
  onToggleAddText,
  textSettings,
  onTextSettingsChange
}) => {
  return (
    <div className="w-64 bg-white border-r p-4 space-y-4">
      <h2 className="font-semibold text-gray-700">Tools</h2>
      
      {/* Tool Buttons */}
      <div className="space-y-2">
        <button
          onClick={() => { if (isAddingText) onToggleAddText(); }}
          className={`w-full flex items-center space-x-2 px-3 py-2 rounded ${
            !isAddingText ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50'
          }`}
        >
          <MousePointer className="w-4 h-4" />
          <span>Select</span>
        </button>
        
        <button
          onClick={onToggleAddText}
          className={`w-full flex items-center space-x-2 px-3 py-2 rounded ${
            isAddingText ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50'
          }`}
        >
          <Type className="w-4 h-4" />
          <span>Add Text</span>
        </button>
      </div>

      {/* Text Settings */}
      <div className="space-y-3">
        <h3 className="font-medium text-gray-700">Text Settings</h3>
        
        {/* Font Size */}
        <div>
          <label className="text-sm text-gray-600">Size</label>
          <input
            type="number"
            min="8"
            max="72"
            value={textSettings.fontSize}
            onChange={(e) => onTextSettingsChange({
              ...textSettings,
              fontSize: parseInt(e.target.value) || 16
            })}
            className="w-full px-2 py-1 border rounded"
          />
        </div>

        {/* Color */}
        <div>
          <label className="text-sm text-gray-600">Color</label>
          <div className="flex space-x-2">
            <input
              type="color"
              value={textSettings.color}
              onChange={(e) => onTextSettingsChange({
                ...textSettings,
                color: e.target.value
              })}
              className="w-12 h-8 border rounded cursor-pointer"
            />
            <input
              type="text"
              value={textSettings.color}
              onChange={(e) => onTextSettingsChange({
                ...textSettings,
                color: e.target.value
              })}
              className="flex-1 px-2 py-1 border rounded text-sm"
            />
          </div>
        </div>

        {/* Font Family */}
        <div>
          <label className="text-sm text-gray-600">Font</label>
          <select
            value={textSettings.fontFamily}
            onChange={(e) => onTextSettingsChange({
              ...textSettings,
              fontFamily: e.target.value
            })}
            className="w-full px-2 py-1 border rounded"
          >
            <option value="Helvetica">Helvetica</option>
            <option value="Times-Roman">Times Roman</option>
            <option value="Courier">Courier</option>
            <option value="Arial">Arial</option>
            <option value="Georgia">Georgia</option>
            <option value="Verdana">Verdana</option>
          </select>
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-6 p-3 bg-gray-50 rounded text-sm text-gray-600">
        <p className="font-medium mb-1">Tips:</p>
        <ul className="space-y-1 text-xs">
          <li>• Click "Add Text" then click on PDF to add text</li>
          <li>• Double-click text to edit</li>
          <li>• Drag text to move</li>
          <li>• Use handles to resize</li>
        </ul>
      </div>
    </div>
  );
};