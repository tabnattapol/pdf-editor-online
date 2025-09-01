import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { LoadingSpinner } from '../UI/LoadingSpinner';
import { TextAnnotation } from './TextAnnotation';
import { InlineTextEditor } from './InlineTextEditor';
import type { TextAnnotation as TextAnnotationType } from '../../types/pdf.types';
import { usePDFCoordinates } from '../../hooks/usePDFCoordinates';

// Configure PDF.js worker - use local file to avoid CORS issues
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

interface PDFViewerProps {
  file: File | null;
  zoomLevel: number;
  annotations: TextAnnotationType[];
  selectedAnnotationId: string | null;
  isAddingText: boolean;
  textSettings: {
    fontSize: number;
    color: string;
    fontFamily: string;
  };
  pageOrder?: number[];
  onAddAnnotation: (annotation: TextAnnotationType) => void;
  onDocumentLoad: (numPages: number) => void;
  onUpdateAnnotation: (id: string, updates: Partial<TextAnnotationType>) => void;
  onSelectAnnotation: (id: string | null) => void;
  onDeleteAnnotation: (id: string) => void;
}

interface EditingState {
  isEditing: boolean;
  pageIndex: number;
  x: number;
  y: number;
  pageWidth?: number;
  pageHeight?: number;
}

interface PageDimensions {
  [key: number]: {
    width: number;
    height: number;
  };
}

export const PDFViewer: React.FC<PDFViewerProps> = ({
  file,
  zoomLevel,
  annotations,
  selectedAnnotationId,
  isAddingText,
  textSettings,
  pageOrder,
  onAddAnnotation,
  onDocumentLoad,
  onUpdateAnnotation,
  onSelectAnnotation,
  onDeleteAnnotation
}) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageWidth, setPageWidth] = useState<number>(0);
  const [editingState, setEditingState] = useState<EditingState>({
    isEditing: false,
    pageIndex: 0,
    x: 0,
    y: 0
  });
  const [pageDimensions, setPageDimensions] = useState<PageDimensions>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<{ [key: number]: HTMLDivElement }>({});
  const { screenToPDF, pdfToScreen, calculatePDFFontSize } = usePDFCoordinates();

  useEffect(() => {
    const updatePageWidth = () => {
      if (containerRef.current) {
        setPageWidth(containerRef.current.clientWidth - 80);
      }
    };

    updatePageWidth();
    window.addEventListener('resize', updatePageWidth);
    return () => window.removeEventListener('resize', updatePageWidth);
  }, []);

  const handleDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    onDocumentLoad(numPages);
  };

  const handlePageClick = (e: React.MouseEvent, pageIndex: number) => {
    // Only proceed if we're in add text mode
    if (!isAddingText) return;
    
    // Deselect any selected text when adding new text
    onSelectAnnotation(null);
    
    const rect = e.currentTarget.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    
    // Get actual page dimensions
    const pageElement = e.currentTarget;
    const displayWidth = pageElement.offsetWidth;
    const displayHeight = pageElement.offsetHeight;
    
    // PDF standard dimensions (points)
    const pdfDims = pageDimensions[pageIndex] || { width: 595.28, height: 841.89 };
    
    e.preventDefault();
    e.stopPropagation();
    
    // Show inline editor at screen position
    setEditingState({
      isEditing: true,
      pageIndex,
      x: screenX,
      y: screenY,
      pageWidth: pdfDims.width,
      pageHeight: pdfDims.height
    });
  };

  const handleSaveText = (text: string) => {
    // Get the original page index from the display index
    let originalPageIndex = editingState.pageIndex;
    
    // If pages are reordered, map display index to original index
    if (pageOrder && pageOrder.length > 0) {
      originalPageIndex = pageOrder[editingState.pageIndex];
    }
    
    // Get the actual displayed page element
    const pageElement = pageRefs.current[editingState.pageIndex];
    if (!pageElement) {
      console.error('Page element not found');
      return;
    }
    
    const displayWidth = pageElement.offsetWidth;
    const displayHeight = pageElement.offsetHeight;
    
    // Get PDF page dimensions
    const pdfWidth = editingState.pageWidth || 595.28;
    const pdfHeight = editingState.pageHeight || 841.89;
    
    // Convert screen coordinates to PDF coordinates
    const { pdfX, pdfY } = screenToPDF(
      editingState.x,
      editingState.y,
      displayWidth,
      displayHeight,
      pdfWidth,
      pdfHeight
    );
    
    console.log('Screen to PDF conversion:');
    console.log(`  Screen: (${editingState.x}, ${editingState.y})`);
    console.log(`  Display size: ${displayWidth} x ${displayHeight}`);
    console.log(`  PDF page size: ${pdfWidth} x ${pdfHeight}`);
    console.log(`  PDF coords: (${pdfX}, ${pdfY})`);
    
    // Store the font size directly as it will be used in PDF
    // The user sees "16" which means 16pt in PDF
    const newAnnotation: TextAnnotationType = {
      id: Date.now().toString(),
      pageIndex: originalPageIndex,
      x: 0,  // We'll calculate this from pdfX when rendering
      y: 0,  // We'll calculate this from pdfY when rendering
      pdfX: pdfX,
      pdfY: pdfY,
      pageWidth: pdfWidth,
      pageHeight: pdfHeight,
      text,
      fontSize: textSettings.fontSize,  // Store font size as-is (in points)
      color: textSettings.color,
      fontFamily: textSettings.fontFamily
    };
    
    onAddAnnotation(newAnnotation);
    setEditingState({ isEditing: false, pageIndex: 0, x: 0, y: 0 });
    onSelectAnnotation(newAnnotation.id);
  };

  const handleCancelEdit = () => {
    setEditingState({ isEditing: false, pageIndex: 0, x: 0, y: 0 });
  };

  const handleBackgroundClick = (e: React.MouseEvent) => {
    // Check if the clicked element is the background container
    const target = e.target as HTMLElement;
    const isBackground = target.classList.contains('bg-gray-50') || 
                         target.classList.contains('pdf-container');
    
    if (isBackground) {
      onSelectAnnotation(null);
    }
  };

  const renderAnnotations = (originalPageIndex: number, displayPageIndex: number) => {
    const pageElement = pageRefs.current[displayPageIndex];
    if (!pageElement) return null;
    
    const displayWidth = pageElement.offsetWidth;
    const displayHeight = pageElement.offsetHeight;
    
    return (
      <>
        {annotations
          .filter(ann => ann.pageIndex === originalPageIndex)
          .map(ann => {
            // Always calculate screen coordinates from PDF coordinates
            const { screenX, screenY } = pdfToScreen(
              ann.pdfX || 0,
              ann.pdfY || 0,
              displayWidth,
              displayHeight,
              ann.pageWidth || 595.28,
              ann.pageHeight || 841.89
            );
            
            return (
              <TextAnnotation
                key={ann.id}
                annotation={{
                  ...ann,
                  x: screenX,
                  y: screenY,
                  fontSize: ann.fontSize * 1.333 * zoomLevel  // Convert points to pixels (1pt = 1.333px at 96 DPI) and scale
                }}
                isSelected={selectedAnnotationId === ann.id}
                onUpdate={onUpdateAnnotation}
                onSelect={onSelectAnnotation}
                onDelete={onDeleteAnnotation}
              />
            );
          })}
        {editingState.isEditing && editingState.pageIndex === displayPageIndex && (
          <InlineTextEditor
            x={editingState.x}
            y={editingState.y}
            fontSize={textSettings.fontSize}
            color={textSettings.color}
            fontFamily={textSettings.fontFamily}
            onSave={handleSaveText}
            onCancel={handleCancelEdit}
          />
        )}
      </>
    );
  };

  if (!file) {
    return null;
  }

  return (
    <div 
      ref={containerRef} 
      className="overflow-y-auto h-full bg-gray-50 pdf-container"
      onClick={handleBackgroundClick}
    >
      <Document
        file={file}
        onLoadSuccess={handleDocumentLoadSuccess}
        loading={<LoadingSpinner />}
        error={
          <div className="text-red-600 p-4">
            Failed to load PDF. Please try another file.
          </div>
        }
      >
        <div className="flex flex-col items-center space-y-4 py-4">
          {(() => {
            // Create page indices based on pageOrder or default order
            const pageIndices = pageOrder && pageOrder.length === numPages 
              ? pageOrder 
              : Array.from({ length: numPages }, (_, i) => i);
            
            return pageIndices.map((originalPageIndex, displayIndex) => (
              <div
                key={`page_${originalPageIndex}_${displayIndex}`}
                className="relative bg-white shadow-lg"
              >
                <div 
                  ref={(el) => { if (el) pageRefs.current[displayIndex] = el; }}
                  className={`relative pdf-page-container ${isAddingText ? 'cursor-crosshair' : ''}`}
                  onClick={(e) => handlePageClick(e, displayIndex)}
                >
                  <Page
                    pageNumber={originalPageIndex + 1}
                    width={pageWidth * zoomLevel}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                  />
                  <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                    <div className="relative w-full h-full pointer-events-auto">
                      {renderAnnotations(originalPageIndex, displayIndex)}
                    </div>
                  </div>
                </div>
                <div className="absolute top-2 right-2 bg-gray-800 text-white px-2 py-1 rounded text-xs">
                  Page {displayIndex + 1} (Original: {originalPageIndex + 1})
                </div>
              </div>
            ));
          })()}
        </div>
      </Document>
    </div>
  );
};