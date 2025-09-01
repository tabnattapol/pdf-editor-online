import React, { useState, useCallback } from 'react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { FileUpload } from '../UI/FileUpload';
import { PDFViewer } from './PDFViewer';
import { ZoomControls } from '../UI/ZoomControls';
import { Toolbar } from './Toolbar';
import { PageReorderModal } from './PageReorderModal';
import type { TextAnnotation } from '../../types/pdf.types';
import { downloadFile } from '../../utils/downloadHelper';
import { convertScreenToPDFCoordinates } from '../../utils/pdfCoordinates';

export const PDFEditor: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocument | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [annotations, setAnnotations] = useState<TextAnnotation[]>([]);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [isAddingText, setIsAddingText] = useState(false);
  const [textSettings, setTextSettings] = useState({
    fontSize: 16,
    color: '#000000',
    fontFamily: 'NotoSansThai'
  });
  const [showReorderModal, setShowReorderModal] = useState(false);
  const [pageOrder, setPageOrder] = useState<number[]>([]);

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    
    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      setPdfDoc(pdf);
    } catch (error) {
      console.error('Error loading PDF:', error);
    }
  }, []);

  const handleAddAnnotation = useCallback((annotation: TextAnnotation) => {
    console.log('Adding annotation:', annotation);
    setAnnotations([...annotations, annotation]);
    setIsAddingText(false);
  }, [annotations]);

  const handleUpdateAnnotation = useCallback((id: string, updates: Partial<TextAnnotation>) => {
    setAnnotations(prev => 
      prev.map(ann => ann.id === id ? { ...ann, ...updates } : ann)
    );
  }, []);

  const handleSelectAnnotation = useCallback((id: string | null) => {
    setSelectedAnnotationId(id);
    // Auto-disable add text mode when selecting existing text
    if (id) {
      setIsAddingText(false);
    }
  }, []);

  const handleDeleteAnnotation = useCallback((id: string) => {
    setAnnotations(prev => prev.filter(ann => ann.id !== id));
    setSelectedAnnotationId(null);
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(prev + 0.25, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel(prev => Math.max(prev - 0.25, 0.5));
  }, []);

  const handleFitToWidth = useCallback(() => {
    setZoomLevel(1);
  }, []);

  const handleReorderPages = useCallback((newOrder: number[]) => {
    setPageOrder(newOrder);
    // Don't update annotation pageIndex here - keep original page indices
    // The mapping will be handled during display and save
  }, []);

  const handleSave = useCallback(async () => {
    if (!pdfDoc || !file) return;

    try {
      let newPdfDoc = await PDFDocument.load(await file.arrayBuffer());
      
      // Register fontkit for custom font support
      newPdfDoc.registerFontkit(fontkit);
      
      let pages = newPdfDoc.getPages();
      
      // Create a mapping for annotations if pages are reordered
      let pageMapping = null;
      if (pageOrder.length > 0) {
        // Create new document with reordered pages
        const reorderedPdfDoc = await PDFDocument.create();
        pageMapping = {};
        
        for (let newIndex = 0; newIndex < pageOrder.length; newIndex++) {
          const originalIndex = pageOrder[newIndex];
          const [copiedPage] = await reorderedPdfDoc.copyPages(newPdfDoc, [originalIndex]);
          reorderedPdfDoc.addPage(copiedPage);
          // Map: what was on originalIndex is now on newIndex
          pageMapping[originalIndex] = newIndex;
        }
        
        newPdfDoc = reorderedPdfDoc;
        pages = newPdfDoc.getPages();
      }
      
      // Load fonts
      let thaiFont = null;
      let helveticaFont = null;
      
      // Load standard font first (always works)
      try {
        helveticaFont = await newPdfDoc.embedFont(StandardFonts.Helvetica);
      } catch (error) {
        console.error('Could not load Helvetica font:', error);
        throw new Error('Failed to load basic fonts');
      }
      
      // Try to load Thai fonts
      const fontUrls = [
        '/NotoSansThai-Regular.ttf',
        '/Sarabun-Regular.ttf'
      ];
      
      for (const fontUrl of fontUrls) {
        try {
          const fontResponse = await fetch(fontUrl);
          if (!fontResponse.ok) {
            console.warn(`Font not found: ${fontUrl}`);
            continue;
          }
          
          const fontBytes = await fontResponse.arrayBuffer();
          if (fontBytes.byteLength === 0) {
            console.warn(`Empty font file: ${fontUrl}`);
            continue;
          }
          
          try {
            // Embed the custom font with fontkit support
            thaiFont = await newPdfDoc.embedFont(fontBytes);
            console.log(`✓ Thai font loaded successfully from ${fontUrl}`);
            break;
          } catch (embedError) {
            console.error(`Failed to embed font from ${fontUrl}:`, embedError);
          }
        } catch (error) {
          console.error(`Error loading ${fontUrl}:`, error);
        }
      }
      
      if (!thaiFont) {
        console.warn('⚠️ No Thai font could be loaded. Thai text will be skipped.');
      }

      for (const annotation of annotations) {
        // Get the correct page index considering reordering
        let targetPageIndex = annotation.pageIndex;
        
        // If pages were reordered, map to the new position
        if (pageMapping && pageMapping[annotation.pageIndex] !== undefined) {
          targetPageIndex = pageMapping[annotation.pageIndex];
        }
        
        // Skip if page index is out of bounds
        if (targetPageIndex < 0 || targetPageIndex >= pages.length) {
          console.warn(`Skipping annotation on invalid page ${targetPageIndex}`);
          continue;
        }
        
        const page = pages[targetPageIndex];
        const { height } = page.getSize();
        
        // Determine which font to use
        let font = helveticaFont;
        const hasThaiText = /[\u0E00-\u0E7F]/.test(annotation.text);
        
        // Use Thai font for Thai text or NotoSansThai selection
        if (hasThaiText || annotation.fontFamily === 'NotoSansThai') {
          if (thaiFont) {
            font = thaiFont;
          } else {
            // Thai text but no Thai font - try to draw with fallback
            console.warn('Thai text detected but Thai font not available');
            // Skip Thai characters that can't be rendered
            if (hasThaiText) {
              console.warn('Skipping annotation with Thai text:', annotation.text);
              continue; // Skip this annotation
            }
          }
        } else if (annotation.fontFamily === 'Times-Roman') {
          try {
            font = await newPdfDoc.embedFont(StandardFonts.TimesRoman);
          } catch (e) {
            font = helveticaFont;
          }
        } else if (annotation.fontFamily === 'Courier') {
          try {
            font = await newPdfDoc.embedFont(StandardFonts.Courier);
          } catch (e) {
            font = helveticaFont;
          }
        }
        
        // Parse color from hex string
        const hexColor = annotation.color.replace('#', '');
        const r = parseInt(hexColor.substr(0, 2), 16) / 255;
        const g = parseInt(hexColor.substr(2, 2), 16) / 255;
        const b = parseInt(hexColor.substr(4, 2), 16) / 255;
        
        // Handle multiline text
        const lines = annotation.text.split('\n');
        const lineHeight = annotation.fontSize * 1.4;
        
        // Always use PDF coordinates
        let drawX = annotation.pdfX || 0;
        let drawY = annotation.pdfY || 0;
        
        console.log(`Drawing annotation at PDF coords: (${drawX}, ${drawY}) on page ${targetPageIndex}`);
        console.log(`Page size: ${page.getWidth()} x ${height}`);
        
        // PDF coordinates are stored with top-left origin (like screen)
        // but PDF-lib uses bottom-left origin, so we need to convert
        // IMPORTANT: drawY is distance from top, we need distance from bottom
        const pdfLibY = height - drawY;
        console.log(`Converted Y for pdf-lib: ${pdfLibY}`);
        
        try {
          lines.forEach((line, lineIndex) => {
            if (line.trim()) {  // Only draw non-empty lines
              page.drawText(line, {
                x: drawX,
                y: pdfLibY - (lineIndex * lineHeight),
                size: annotation.fontSize,
                font: font,
                color: rgb(r, g, b)
              });
            }
          });
        } catch (drawError) {
          console.error('Error drawing text:', drawError);
          // Continue with next annotation
        }
      }

      const pdfBytes = await newPdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      
      const filename = prompt('Enter filename:', 'edited-document.pdf') || 'edited-document.pdf';
      downloadFile(blob, filename);
    } catch (error) {
      console.error('Error saving PDF:', error);
      
      let errorMessage = 'Failed to save PDF. ';
      if (error instanceof Error) {
        if (error.message.includes('WinAnsi cannot encode')) {
          errorMessage += 'Some characters cannot be saved with the selected font. Please use Noto Sans Thai for Thai text.';
        } else {
          errorMessage += error.message;
        }
      }
      
      alert(errorMessage);
    }
  }, [pdfDoc, file, annotations, pageOrder]);

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-semibold">PDF Editor Online</h1>
          {file && (
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">{file.name}</span>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Save PDF
              </button>
            </div>
          )}
        </div>
      </header>

      {!file ? (
        <FileUpload onFileSelect={handleFileSelect} />
      ) : (
        <div className="flex flex-col h-screen">
          <Toolbar
            isAddingText={isAddingText}
            onToggleAddText={() => {
              setIsAddingText(!isAddingText);
              if (!isAddingText) {
                setSelectedAnnotationId(null);
              }
            }}
            textSettings={textSettings}
            onTextSettingsChange={setTextSettings}
            onReorderPages={() => setShowReorderModal(true)}
            selectedText={selectedAnnotationId ? 
              annotations.find(a => a.id === selectedAnnotationId) || null : 
              null
            }
            onSelectedTextChange={(updates) => {
              if (selectedAnnotationId) {
                handleUpdateAnnotation(selectedAnnotationId, updates);
              }
            }}
          />
          <div className="p-4 bg-white border-b">
            <ZoomControls
              zoomLevel={zoomLevel}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onFitToWidth={handleFitToWidth}
            />
          </div>
          <div className="flex-1 overflow-hidden">
            <PDFViewer
              file={file}
              zoomLevel={zoomLevel}
              annotations={annotations}
              selectedAnnotationId={selectedAnnotationId}
              isAddingText={isAddingText}
              textSettings={textSettings}
              pageOrder={pageOrder}
              onAddAnnotation={handleAddAnnotation}
              onDocumentLoad={setNumPages}
              onUpdateAnnotation={handleUpdateAnnotation}
              onSelectAnnotation={handleSelectAnnotation}
              onDeleteAnnotation={handleDeleteAnnotation}
            />
          </div>
        </div>
      )}
      
      <PageReorderModal
        isOpen={showReorderModal}
        file={file}
        onClose={() => setShowReorderModal(false)}
        onReorder={handleReorderPages}
      />
    </div>
  );
};