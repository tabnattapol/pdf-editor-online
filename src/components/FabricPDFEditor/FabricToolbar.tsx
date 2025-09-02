import React from 'react';
import { Type, MousePointer, Trash2 } from 'lucide-react';

interface FabricToolbarProps {
  isAddingText: boolean;
  onToggleAddText: () => void;
  textSettings: {
    fontSize: number;
    color: string;
    fontFamily: string;
  };
  onTextSettingsChange: (settings: any) => void;
  selectedTextObject?: any;
  onUpdateSelectedText?: (updates: any) => void;
  onDeleteSelectedText?: () => void;
}

export const FabricToolbar: React.FC<FabricToolbarProps> = ({
  isAddingText,
  onToggleAddText,
  textSettings,
  onTextSettingsChange,
  selectedTextObject,
  onUpdateSelectedText,
  onDeleteSelectedText
}) => {
  // Debug log every render
  console.log('=== FabricToolbar render ===');
  console.log('selectedTextObject:', selectedTextObject);
  console.log('Has selectedTextObject:', !!selectedTextObject);
  console.log('onUpdateSelectedText function:', !!onUpdateSelectedText);
  console.log('onDeleteSelectedText function:', !!onDeleteSelectedText);
  
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

      {/* Show Edit Panel when text is selected */}
      {selectedTextObject ? (
        <div className="space-y-3 p-3 bg-blue-50 border-2 border-blue-200 rounded-lg">
          <div className="flex justify-between items-center">
            <h3 className="font-medium text-blue-900">
              ✏️ Edit Selected Text
            </h3>
            {onDeleteSelectedText && (
              <button
                onClick={onDeleteSelectedText}
                className="p-2 bg-red-500 text-white hover:bg-red-600 rounded-lg transition-colors"
                title="Delete selected text"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        
        {/* Font Size */}
        <div>
          <label className="text-sm text-gray-600">Size</label>
          <input
            type="number"
            min="8"
            max="72"
            value={textSettings.fontSize}
            onChange={(e) => {
              const newSize = parseInt(e.target.value) || 16;
              console.log('Font size change:', newSize);
              console.log('Has selected text:', !!selectedTextObject);
              console.log('Has update function:', !!onUpdateSelectedText);
              
              if (onUpdateSelectedText) {
                console.log('Calling onUpdateSelectedText with fontSize:', newSize);
                onUpdateSelectedText({ fontSize: newSize });
              }
              
              // Also update the local settings
              onTextSettingsChange({
                ...textSettings,
                fontSize: newSize
              });
            }}
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
              onChange={(e) => {
                console.log('Color picker change:', e.target.value);
                if (onUpdateSelectedText) {
                  console.log('Calling onUpdateSelectedText with color:', e.target.value);
                  onUpdateSelectedText({ color: e.target.value });
                }
                onTextSettingsChange({
                  ...textSettings,
                  color: e.target.value
                });
              }}
              className="w-12 h-8 border rounded cursor-pointer"
            />
            <input
              type="text"
              value={textSettings.color}
              onChange={(e) => {
                console.log('Color picker change:', e.target.value);
                if (onUpdateSelectedText) {
                  console.log('Calling onUpdateSelectedText with color:', e.target.value);
                  onUpdateSelectedText({ color: e.target.value });
                }
                onTextSettingsChange({
                  ...textSettings,
                  color: e.target.value
                });
              }}
              className="flex-1 px-2 py-1 border rounded text-sm"
            />
          </div>
        </div>

        {/* Font Family */}
        <div>
          <label className="text-sm text-gray-600">Font</label>
          <select
            value={textSettings.fontFamily}
            onChange={(e) => {
              console.log('Font family change:', e.target.value);
              if (onUpdateSelectedText) {
                console.log('Calling onUpdateSelectedText with fontFamily:', e.target.value);
                onUpdateSelectedText({ fontFamily: e.target.value });
              }
              onTextSettingsChange({
                ...textSettings,
                fontFamily: e.target.value
              })
            }}
            className="w-full px-2 py-1 border rounded"
          >
            <option value="Helvetica">Helvetica</option>
            <option value="Times-Roman">Times Roman</option>
            <option value="Courier">Courier</option>
            <option value="Arial">Arial</option>
            <option value="Georgia">Georgia</option>
            <option value="Verdana">Verdana</option>
            <option value="Sarabun">Sarabun (Thai)</option>
          </select>
        </div>

        <div className="p-2 bg-yellow-100 border border-yellow-400 rounded text-sm text-yellow-800">
          💡 Changes apply immediately to selected text
        </div>
      </div>
      ) : (
        // Default Text Settings (when no text is selected)
        <div className="space-y-3">
          <h3 className="font-medium text-gray-700">Default Text Settings</h3>
          <p className="text-xs text-gray-500">Settings for new text objects</p>
          
          {/* Font Size */}
          <div>
            <label className="text-sm text-gray-600">Size</label>
            <input
              type="number"
              min="8"
              max="72"
              value={textSettings.fontSize}
              onChange={(e) => {
                const newSize = parseInt(e.target.value) || 16;
                onTextSettingsChange({
                  ...textSettings,
                  fontSize: newSize
                });
              }}
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
                onChange={(e) => {
                  onTextSettingsChange({
                    ...textSettings,
                    color: e.target.value
                  });
                }}
                className="w-12 h-8 border rounded cursor-pointer"
              />
              <input
                type="text"
                value={textSettings.color}
                onChange={(e) => {
                  onTextSettingsChange({
                    ...textSettings,
                    color: e.target.value
                  });
                }}
                className="flex-1 px-2 py-1 border rounded text-sm"
              />
            </div>
          </div>

          {/* Font Family */}
          <div>
            <label className="text-sm text-gray-600">Font</label>
            <select
              value={textSettings.fontFamily}
              onChange={(e) => {
                onTextSettingsChange({
                  ...textSettings,
                  fontFamily: e.target.value
                });
              }}
              className="w-full px-2 py-1 border rounded"
            >
              <option value="Helvetica">Helvetica</option>
              <option value="Times-Roman">Times Roman</option>
              <option value="Courier">Courier</option>
              <option value="Arial">Arial</option>
              <option value="Georgia">Georgia</option>
              <option value="Verdana">Verdana</option>
              <option value="Sarabun">Sarabun (Thai)</option>
            </select>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-6 p-3 bg-gray-50 rounded text-sm text-gray-600">
        <p className="font-medium mb-1">Tips:</p>
        <ul className="space-y-1 text-xs">
          <li>• Click "Add Text" then click on PDF to add text</li>
          <li>• Click text once to select and edit properties</li>
          <li>• Double-click text to edit content</li>
          <li>• Drag text to move position</li>
          <li>• Press Delete key to remove selected text</li>
        </ul>
      </div>
    </div>
  );
};