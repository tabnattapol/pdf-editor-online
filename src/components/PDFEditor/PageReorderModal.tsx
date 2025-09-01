import React, { useState, useEffect } from 'react';
import { X, GripVertical, Check } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';

interface PageReorderModalProps {
  isOpen: boolean;
  file: File | null;
  onClose: () => void;
  onReorder: (newOrder: number[]) => void;
}

interface PageItem {
  originalIndex: number;
  currentIndex: number;
}

export const PageReorderModal: React.FC<PageReorderModalProps> = ({
  isOpen,
  file,
  onClose,
  onReorder
}) => {
  const [pages, setPages] = useState<PageItem[]>([]);
  const [numPages, setNumPages] = useState(0);
  const [draggedItem, setDraggedItem] = useState<number | null>(null);
  const [dragOverItem, setDragOverItem] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen && numPages > 0) {
      setPages(
        Array.from({ length: numPages }, (_, i) => ({
          originalIndex: i,
          currentIndex: i
        }))
      );
    }
  }, [isOpen, numPages]);

  const handleDragStart = (index: number) => {
    setDraggedItem(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverItem(index);
  };

  const handleDragEnd = () => {
    if (draggedItem !== null && dragOverItem !== null && draggedItem !== dragOverItem) {
      const newPages = [...pages];
      const draggedPage = newPages[draggedItem];
      
      // Remove dragged item
      newPages.splice(draggedItem, 1);
      
      // Insert at new position
      const insertIndex = dragOverItem > draggedItem ? dragOverItem - 1 : dragOverItem;
      newPages.splice(insertIndex, 0, draggedPage);
      
      // Update current indices
      newPages.forEach((page, idx) => {
        page.currentIndex = idx;
      });
      
      setPages(newPages);
    }
    
    setDraggedItem(null);
    setDragOverItem(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleConfirm = () => {
    const newOrder = pages.map(page => page.originalIndex);
    onReorder(newOrder);
    onClose();
  };

  const handleReset = () => {
    setPages(
      Array.from({ length: numPages }, (_, i) => ({
        originalIndex: i,
        currentIndex: i
      }))
    );
  };

  if (!isOpen || !file) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-5/6 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-xl font-semibold">Reorder Pages</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleReset}
              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
            >
              Reset
            </button>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <Document
            file={file}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          >
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {pages.map((page, index) => (
                <div
                  key={page.originalIndex}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  onDrop={handleDrop}
                  className={`relative group cursor-move transition-all ${
                    draggedItem === index ? 'opacity-50' : ''
                  } ${
                    dragOverItem === index && draggedItem !== index
                      ? 'ring-2 ring-blue-500 ring-offset-2'
                      : ''
                  }`}
                >
                  <div className="relative bg-white border-2 border-gray-200 rounded-lg overflow-hidden hover:border-blue-400">
                    <div className="absolute top-2 left-2 z-10 bg-gray-800 text-white px-2 py-1 rounded text-xs font-medium">
                      {index + 1}
                    </div>
                    <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                      <GripVertical className="w-5 h-5 text-gray-600" />
                    </div>
                    <div className="pointer-events-none">
                      <Page
                        pageNumber={page.originalIndex + 1}
                        width={150}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                      />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-white bg-opacity-90 px-2 py-1 text-center">
                      <span className="text-xs text-gray-600">
                        Original: {page.originalIndex + 1}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Document>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t">
          <p className="text-sm text-gray-600">
            Drag and drop pages to reorder them
          </p>
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="flex items-center px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              <Check className="w-4 h-4 mr-2" />
              Apply Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};