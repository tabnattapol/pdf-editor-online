import React, { useState, useRef, useEffect } from 'react';
import { Check, X } from 'lucide-react';

interface InlineTextEditorProps {
  x: number;
  y: number;
  fontSize: number;
  color: string;
  fontFamily: string;
  onSave: (text: string) => void;
  onCancel: () => void;
}

export const InlineTextEditor: React.FC<InlineTextEditorProps> = ({
  x,
  y,
  fontSize,
  color,
  fontFamily,
  onSave,
  onCancel
}) => {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  useEffect(() => {
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [text]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      if (text.trim()) {
        onSave(text);
      }
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  const handleSave = () => {
    if (text.trim()) {
      onSave(text);
    }
  };

  return (
    <div
      className="absolute z-50"
      style={{
        left: `${x}px`,
        top: `${y}px`
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start bg-white border-2 border-blue-500 rounded shadow-lg">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          className="px-2 py-1 outline-none min-w-[200px] max-w-[400px] resize-none"
          style={{
            fontSize: `${fontSize}px`,
            color: color,
            fontFamily: fontFamily === 'NotoSansThai' ? 'Noto Sans Thai, sans-serif' : fontFamily,
            lineHeight: 1.4,
            minHeight: `${fontSize * 1.5}px`
          }}
          placeholder="Enter text... (Ctrl+Enter to save)"
          rows={1}
        />
        <div className="flex flex-col border-l">
          <button
            onClick={handleSave}
            className="p-2 hover:bg-green-50 transition-colors border-b"
            title="Save (Ctrl+Enter)"
          >
            <Check className="w-4 h-4 text-green-600" />
          </button>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-red-50 transition-colors"
            title="Cancel (Esc)"
          >
            <X className="w-4 h-4 text-red-600" />
          </button>
        </div>
      </div>
      <div className="text-xs text-gray-500 mt-1 bg-white px-2 py-1 rounded shadow">
        Press Enter for new line, Ctrl+Enter to save
      </div>
    </div>
  );
};