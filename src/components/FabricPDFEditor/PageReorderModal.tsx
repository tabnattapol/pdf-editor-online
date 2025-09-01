import React, { useState, useEffect } from 'react';
import { X, GripVertical, FileText } from 'lucide-react';

interface PageData {
  pageNum: number;
  thumbnail: string;
  width: number;
  height: number;
}

interface PageReorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfDoc: any;
  onReorder: (newOrder: number[]) => void;
}

export const PageReorderModal: React.FC<PageReorderModalProps> = ({
  isOpen,
  onClose,
  pdfDoc,
  onReorder
}) => {
  const [pages, setPages] = useState<PageData[]>([]);
  const [draggedItem, setDraggedItem] = useState<number | null>(null);
  const [dragOverItem, setDragOverItem] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // Generate thumbnails for all pages
  useEffect(() => {
    if (!isOpen || !pdfDoc) return;

    const generateThumbnails = async () => {
      setLoading(true);
      const thumbnails: PageData[] = [];
      
      try {
        for (let i = 1; i <= pdfDoc.numPages; i++) {
          const page = await pdfDoc.getPage(i);
          const viewport = page.getViewport({ scale: 0.3 }); // Small scale for thumbnails
          
          // Create canvas for thumbnail
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          
          // Render page to canvas
          await page.render({
            canvasContext: context!,
            viewport: viewport
          }).promise;
          
          thumbnails.push({
            pageNum: i,
            thumbnail: canvas.toDataURL(),
            width: viewport.width,
            height: viewport.height
          });
        }
        
        setPages(thumbnails);
      } catch (error) {
        console.error('Error generating thumbnails:', error);
      } finally {
        setLoading(false);
      }
    };

    generateThumbnails();
  }, [isOpen, pdfDoc]);

  // Handle drag start
  const handleDragStart = (index: number) => {
    setDraggedItem(index);
  };

  // Handle drag over
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverItem(index);
  };

  // Handle drop
  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedItem === null) return;
    
    const draggedPage = pages[draggedItem];
    const newPages = [...pages];
    
    // Remove dragged item
    newPages.splice(draggedItem, 1);
    
    // Insert at new position
    newPages.splice(dropIndex, 0, draggedPage);
    
    setPages(newPages);
    setDraggedItem(null);
    setDragOverItem(null);
  };

  // Apply reordering
  const handleApplyReorder = () => {
    const newOrder = pages.map(page => page.pageNum);
    onReorder(newOrder);
    onClose();
  };

  // Reset order
  const handleResetOrder = () => {
    const originalPages = [...pages].sort((a, b) => a.pageNum - b.pageNum);
    setPages(originalPages);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-11/12 max-w-6xl h-5/6 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold">Reorder Pages</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-500">Loading pages...</div>
            </div>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {pages.map((page, index) => (
                <div
                  key={`page-${index}`}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index)}
                  className={`
                    relative cursor-move border-2 rounded-lg p-2 transition-all
                    ${draggedItem === index ? 'opacity-50' : ''}
                    ${dragOverItem === index ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
                    hover:border-gray-400 hover:shadow-md
                  `}
                >
                  {/* Drag Handle */}
                  <div className="absolute top-1 left-1 text-gray-400">
                    <GripVertical className="w-4 h-4" />
                  </div>
                  
                  {/* Page Number Badge */}
                  <div className="absolute top-1 right-1 bg-blue-600 text-white text-xs px-2 py-1 rounded">
                    {index + 1}
                  </div>
                  
                  {/* Original Page Number */}
                  <div className="absolute bottom-1 left-1 bg-gray-600 text-white text-xs px-2 py-0.5 rounded opacity-75">
                    Original: {page.pageNum}
                  </div>
                  
                  {/* Thumbnail */}
                  <div className="bg-gray-100 rounded overflow-hidden">
                    {page.thumbnail ? (
                      <img 
                        src={page.thumbnail} 
                        alt={`Page ${page.pageNum}`}
                        className="w-full h-auto"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-32 text-gray-400">
                        <FileText className="w-8 h-8" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t">
          <button
            onClick={handleResetOrder}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Reset Order
          </button>
          <div className="flex space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleApplyReorder}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Apply Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};