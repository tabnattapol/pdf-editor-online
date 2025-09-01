import React, { useState, useRef, useEffect } from 'react';
import { Move, X, Check } from 'lucide-react';
import type { TextAnnotation as TextAnnotationType } from '../../types/pdf.types';

interface TextAnnotationProps {
  annotation: TextAnnotationType;
  isSelected: boolean;
  onUpdate: (id: string, updates: Partial<TextAnnotationType>) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export const TextAnnotation: React.FC<TextAnnotationProps> = ({
  annotation,
  isSelected,
  onUpdate,
  onSelect,
  onDelete
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(annotation.text);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const elementRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
      // Auto-resize
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [isEditing]);

  useEffect(() => {
    // Auto-resize on text change
    if (isEditing && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [editText, isEditing]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isEditing) return;
    
    e.preventDefault();
    e.stopPropagation();
    onSelect(annotation.id);
    
    setIsDragging(true);
    setDragStart({
      x: e.clientX - annotation.x,
      y: e.clientY - annotation.y
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    
    // Get the page container to calculate PDF coordinates
    const pageContainer = elementRef.current?.closest('.pdf-page-container');
    if (pageContainer) {
      const displayWidth = pageContainer.clientWidth;
      const displayHeight = pageContainer.clientHeight;
      const pageWidth = annotation.pageWidth || 595.28;
      const pageHeight = annotation.pageHeight || 841.89;
      
      // Calculate PDF coordinates based on new position
      const pdfX = (newX / displayWidth) * pageWidth;
      const pdfY = (newY / displayHeight) * pageHeight;
      
      // Only update PDF coordinates, screen coordinates will be calculated from these
      onUpdate(annotation.id, { 
        pdfX: pdfX,
        pdfY: pdfY
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragStart]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsEditing(true);
    setEditText(annotation.text);
  };

  const handleSaveEdit = () => {
    if (editText.trim()) {
      onUpdate(annotation.id, { text: editText });
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditText(annotation.text);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  return (
    <div
      ref={elementRef}
      className={`absolute group ${isDragging ? 'cursor-move' : 'cursor-pointer'} ${
        isSelected ? 'z-20' : 'z-10'
      }`}
      style={{
        left: `${annotation.x}px`,
        top: `${annotation.y}px`
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      {isEditing ? (
        <div className="flex items-start bg-white border-2 border-blue-500 rounded px-2 py-1 shadow-lg">
          <textarea
            ref={textareaRef}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={handleKeyDown}
            className="outline-none min-w-[100px] max-w-[400px] resize-none"
            style={{
              fontSize: `${annotation.fontSize}px`,
              color: annotation.color,
              fontFamily: annotation.fontFamily === 'NotoSansThai' ? 'Noto Sans Thai, sans-serif' : annotation.fontFamily,
              lineHeight: 1.4
            }}
            onClick={(e) => e.stopPropagation()}
          />
          <div className="flex flex-col ml-2">
            <button
              onClick={handleSaveEdit}
              className="p-1 hover:bg-green-100 rounded"
              title="Save (Ctrl+Enter)"
            >
              <Check className="w-4 h-4 text-green-600" />
            </button>
            <button
              onClick={handleCancelEdit}
              className="p-1 hover:bg-red-100 rounded"
              title="Cancel (Esc)"
            >
              <X className="w-4 h-4 text-red-600" />
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`relative ${
            isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''
          }`}
        >
          <div
            style={{
              fontSize: `${annotation.fontSize}px`,
              color: annotation.color,
              fontFamily: annotation.fontFamily === 'NotoSansThai' ? 'Noto Sans Thai, sans-serif' : annotation.fontFamily,
              userSelect: 'none',
              whiteSpace: 'pre-wrap',
              lineHeight: 1.4
            }}
          >
            {annotation.text}
          </div>
          
          {isSelected && (
            <div className="absolute -top-8 left-0 flex items-center space-x-1 bg-white border rounded shadow-sm p-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="p-1 text-gray-500">
                <Move className="w-3 h-3" />
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(annotation.id);
                }}
                className="p-1 hover:bg-red-100 rounded"
              >
                <X className="w-3 h-3 text-red-600" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};