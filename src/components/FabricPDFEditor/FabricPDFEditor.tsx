import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Canvas, IText, FabricImage } from 'fabric';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import { FileUpload } from '../UI/FileUpload';
import { FabricToolbar } from './FabricToolbar';
import { FabricZoomControls } from './FabricZoomControls';
import { PageReorderModal } from './PageReorderModal';
import { Modal, useModal } from '../UI/Modal';
import { simpleSavePDF } from '../../utils/simplePdfSave';
import { imageSavePDF } from '../../utils/imagePdfSave';
import { Shuffle } from 'lucide-react';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export const FabricPDFEditor: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fabricCanvasRef = useRef<Canvas | null>(null);
  
  const [file, setFile] = useState<File | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [, setTotalPages] = useState(0);
  const [allPagesData, setAllPagesData] = useState<any[]>([]);
  const [isAddingText, setIsAddingText] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [originalPdfBytes, setOriginalPdfBytes] = useState<Uint8Array | null>(null);
  const [canvasReady, setCanvasReady] = useState(false);
  const [showReorderModal, setShowReorderModal] = useState(false);
  const [, setPageOrder] = useState<number[]>([]);
  
  // Text settings
  const [textSettings, setTextSettings] = useState({
    fontSize: 16,
    color: '#000000',
    fontFamily: 'Helvetica'
  });
  const [selectedTextObject, setSelectedTextObject] = useState<IText | null>(null);
  
  // Debug selected text object changes
  useEffect(() => {
    console.log('selectedTextObject state changed:', selectedTextObject);
    if (selectedTextObject) {
      console.log('Selected text properties:', {
        text: selectedTextObject.text,
        fontSize: selectedTextObject.fontSize,
        color: selectedTextObject.fill,
        fontFamily: selectedTextObject.fontFamily
      });
    }
  }, [selectedTextObject]);
  const [, forceUpdate] = useState({});
  
  // Modal state
  const { modalState, showModal, closeModal } = useModal();
  
  // Debug selected text object changes
  useEffect(() => {
    console.log('selectedTextObject state changed to:', selectedTextObject);
  }, [selectedTextObject]);

  // Initialize Fabric canvas when file is loaded
  useEffect(() => {
    if (!canvasRef.current || !file) return;

    console.log('Initializing Fabric canvas');
    const canvas = new Canvas(canvasRef.current, {
      preserveObjectStacking: true,
      selection: true,
      backgroundColor: '#ffffff'
    });

    fabricCanvasRef.current = canvas;
    console.log('Fabric canvas initialized:', !!fabricCanvasRef.current);
    setCanvasReady(true);

    return () => {
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
      setCanvasReady(false);
    };
  }, [file]);

  // Add text at position
  const addTextAtPosition = useCallback((x: number, y: number) => {
    if (!fabricCanvasRef.current) return;

    const text = new IText('Click to edit text', {
      left: x,
      top: y,
      fontSize: textSettings.fontSize,
      fill: textSettings.color,
      fontFamily: textSettings.fontFamily,
      editable: true,
      selectable: true,  // Ensure it's selectable
      evented: true,      // Ensure it receives events
      hasControls: true,  // Show controls
      hasBorders: true,   // Show borders
      width: 200
    });

    fabricCanvasRef.current.add(text);
    fabricCanvasRef.current.setActiveObject(text);
    text.enterEditing();
    text.selectAll();
    
    // Update selected text object immediately
    setSelectedTextObject(text);
    console.log('Text added and selected:', text);
  }, [textSettings]);

  // Handle mouse events for adding text
  useEffect(() => {
    if (!fabricCanvasRef.current) return;
    
    const canvas = fabricCanvasRef.current;
    
    const handleMouseDown = (options: any) => {
      console.log('Mouse down event:', { isAddingText, target: options.target });
      
      // Check if we clicked on a text object
      if (options.target && options.target.type === 'i-text') {
        const textObj = options.target as IText;
        console.log('Clicked on text object:', textObj);
        console.log('Setting selectedTextObject to:', textObj);
        setSelectedTextObject(textObj);
        // Update text settings to match selected object
        const newSettings = {
          fontSize: textObj.fontSize as number || 16,
          color: textObj.fill as string || '#000000',
          fontFamily: textObj.fontFamily || 'Helvetica'
        };
        console.log('Updating text settings to:', newSettings);
        setTextSettings(newSettings);
        
        // Force canvas to set this as active object
        canvas.setActiveObject(textObj);
        canvas.renderAll();
        
        // Force re-render to update UI
        forceUpdate({});
      } else if (!options.target) {
        // Clicked on empty space - clear selection
        console.log('Clicked on empty space, clearing selection');
        setSelectedTextObject(null);
      }
      
      // Handle adding new text
      if (isAddingText && !options.target) {
        const pointer = canvas.getPointer(options.e);
        console.log('Adding text at:', pointer);
        addTextAtPosition(pointer.x, pointer.y);
        setIsAddingText(false);
      }
    };
    
    canvas.on('mouse:down', handleMouseDown);
    
    return () => {
      canvas.off('mouse:down', handleMouseDown);
    };
  }, [isAddingText, addTextAtPosition, textSettings]);

  // Handle text selection events - simplified approach
  useEffect(() => {
    if (!fabricCanvasRef.current) return;
    
    const canvas = fabricCanvasRef.current;
    console.log('Setting up simplified selection event listeners');
    
    // Single unified handler for selection
    const handleSelection = () => {
      const activeObj = canvas.getActiveObject();
      console.log('Selection changed, active object:', activeObj);
      
      if (activeObj && activeObj.type === 'i-text') {
        const textObj = activeObj as IText;
        console.log('Text object is selected:', {
          text: textObj.text,
          fontSize: textObj.fontSize,
          color: textObj.fill,
          fontFamily: textObj.fontFamily
        });
        
        setSelectedTextObject(textObj);
        // Update text settings to match selected object
        setTextSettings({
          fontSize: textObj.fontSize as number || 16,
          color: textObj.fill as string || '#000000',
          fontFamily: textObj.fontFamily || 'Helvetica'
        });
      } else {
        console.log('No text object selected');
        setSelectedTextObject(null);
      }
    };
    
    // Listen for any selection change
    canvas.on('selection:created', handleSelection);
    canvas.on('selection:updated', handleSelection);
    canvas.on('selection:cleared', () => {
      console.log('Selection cleared');
      setSelectedTextObject(null);
    });
    
    return () => {
      canvas.off('selection:created');
      canvas.off('selection:updated');
      canvas.off('selection:cleared');
    };
  }, []);

  // Delete selected text - moved here before keyboard shortcuts
  const deleteSelectedText = useCallback(() => {
    if (!fabricCanvasRef.current) return;
    
    // Get the currently active object
    const activeObject = fabricCanvasRef.current.getActiveObject();
    console.log('Deleting active object:', activeObject);
    
    if (!activeObject || activeObject.type !== 'i-text') {
      console.log('No text object to delete');
      return;
    }
    
    fabricCanvasRef.current.remove(activeObject);
    fabricCanvasRef.current.discardActiveObject();
    setSelectedTextObject(null);
    fabricCanvasRef.current.renderAll();
    console.log('Text deleted successfully');
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Delete key or Backspace to delete selected text
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedTextObject) {
        // Only delete if we're not editing text
        if (!selectedTextObject.isEditing) {
          deleteSelectedText();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedTextObject, deleteSelectedText]);

  // Update text adding mode cursor
  useEffect(() => {
    if (!fabricCanvasRef.current) return;
    
    if (isAddingText) {
      fabricCanvasRef.current.defaultCursor = 'crosshair';
      fabricCanvasRef.current.selection = false;
    } else {
      fabricCanvasRef.current.defaultCursor = 'default';
      fabricCanvasRef.current.selection = true;
    }
  }, [isAddingText]);

  // Render PDF page - kept for reference but not currently used
  // @ts-ignore - Function preserved for reference but not used
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _renderPage = useCallback(async (_pdf: any, _pageNum: number, _zoom?: number) => {
    console.log('renderPage called', { 
      hasFabricCanvas: !!fabricCanvasRef.current, 
      hasContainer: !!containerRef.current,
      pageNum: _pageNum,
      zoom: _zoom 
    });
    if (!fabricCanvasRef.current || !containerRef.current) {
      console.error('Missing refs:', { 
        fabricCanvas: fabricCanvasRef.current, 
        container: containerRef.current 
      });
      return;
    }

    const currentZoom = _zoom ?? zoomLevel;
    const page = await _pdf.getPage(_pageNum);
    const viewport = page.getViewport({ scale: 1 });
    
    // Calculate scale to fit container width
    const containerWidth = containerRef.current.clientWidth - 40; // padding
    const scale = Math.min(containerWidth / viewport.width, 1.5); // max scale 1.5
    const scaledViewport = page.getViewport({ scale: scale * currentZoom });
    
    // Create temporary canvas for PDF rendering
    const tempCanvas = document.createElement('canvas');
    const context = tempCanvas.getContext('2d');
    tempCanvas.width = scaledViewport.width;
    tempCanvas.height = scaledViewport.height;
    
    // Render PDF page to temporary canvas
    await page.render({
      canvasContext: context!,
      viewport: scaledViewport
    }).promise;
    
    // Clear existing background
    const canvas = fabricCanvasRef.current;
    
    // Store existing text objects
    const textObjects = canvas.getObjects().filter(obj => obj.type === 'i-text');
    
    // Clear canvas
    canvas.clear();
    canvas.backgroundColor = '#ffffff';
    
    // Set canvas dimensions
    canvas.setWidth(scaledViewport.width);
    canvas.setHeight(scaledViewport.height);
    
    // Set PDF page as background
    FabricImage.fromURL(tempCanvas.toDataURL()).then((img) => {
      canvas.backgroundImage = img;
      // Restore text objects with scaled positions
      textObjects.forEach(text => {
        const scaledText = text as IText;
        canvas.add(scaledText);
      });
      canvas.renderAll();
    });
  }, [zoomLevel]);

  // Render all pages for continuous scrolling
  const renderAllPages = useCallback(async (pdf: any) => {
    if (!fabricCanvasRef.current || !containerRef.current) return;

    const canvas = fabricCanvasRef.current;
    const containerWidth = containerRef.current.clientWidth - 40; // padding
    let totalHeight = 0;
    const pageGap = 20; // Gap between pages
    const pagesData = [];

    // Clear canvas
    canvas.clear();
    canvas.backgroundColor = '#f5f5f5';

    // Calculate total height needed
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1 });
      const scale = Math.min(containerWidth / viewport.width, 1.5);
      const scaledViewport = page.getViewport({ scale: scale * zoomLevel });
      
      pagesData.push({
        pageNum: i,
        width: scaledViewport.width,
        height: scaledViewport.height,
        yOffset: totalHeight
      });
      
      totalHeight += scaledViewport.height + pageGap;
    }

    // Set canvas dimensions to fit all pages
    canvas.setWidth(containerWidth);
    canvas.setHeight(totalHeight);

    // Render each page
    for (const pageData of pagesData) {
      const page = await pdf.getPage(pageData.pageNum);
      const viewport = page.getViewport({ scale: 1 });
      const scale = Math.min(containerWidth / viewport.width, 1.5);
      const scaledViewport = page.getViewport({ scale: scale * zoomLevel });

      // Create temporary canvas for this page
      const tempCanvas = document.createElement('canvas');
      const context = tempCanvas.getContext('2d');
      tempCanvas.width = scaledViewport.width;
      tempCanvas.height = scaledViewport.height;

      // Render PDF page to temporary canvas
      await page.render({
        canvasContext: context!,
        viewport: scaledViewport
      }).promise;

      // Add page as image to Fabric canvas
      await new Promise((resolve) => {
        FabricImage.fromURL(tempCanvas.toDataURL()).then((img) => {
          img.set({
            left: 0,
            top: pageData.yOffset,
            selectable: false,
            evented: false
          });
          canvas.add(img);
          canvas.renderAll();
          resolve(true);
        });
      });
    }

    setAllPagesData(pagesData);
  }, [zoomLevel]);

  // Load PDF file
  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    
    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Keep a copy for saving later BEFORE passing to PDF.js
      // PDF.js transfers the ArrayBuffer to a worker, making it unavailable
      const copyForSaving = new Uint8Array(uint8Array.length);
      copyForSaving.set(uint8Array);
      setOriginalPdfBytes(copyForSaving);
      
      // Create another copy for PDF.js to consume
      const pdfJsCopy = new Uint8Array(uint8Array);
      const pdf = await pdfjsLib.getDocument(pdfJsCopy).promise;
      setPdfDoc(pdf);
      setTotalPages(pdf.numPages);
      
      // Initialize page order
      const initialOrder = Array.from({ length: pdf.numPages }, (_, i) => i + 1);
      setPageOrder(initialOrder);
      
      // Render all pages
      await renderAllPages(pdf);
    } catch (error) {
      console.error('Error loading PDF:', error);
    }
  }, [renderAllPages]);

  // Re-render pages when document changes
  useEffect(() => {
    if (pdfDoc && canvasReady) {
      renderAllPages(pdfDoc);
    }
  }, [pdfDoc, canvasReady, renderAllPages]);

  // Re-render when zoom changes
  useEffect(() => {
    if (pdfDoc && canvasReady) {
      renderAllPages(pdfDoc);
    }
  }, [zoomLevel, pdfDoc, canvasReady, renderAllPages]);

  // Handle zoom
  const handleZoomIn = () => {
    const newZoom = Math.min(zoomLevel + 0.25, 3);
    setZoomLevel(newZoom);
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(zoomLevel - 0.25, 0.5);
    setZoomLevel(newZoom);
  };

  const handleFitToWidth = () => {
    setZoomLevel(1);
  };

  // Update selected text properties
  const updateSelectedText = useCallback((updates: Partial<typeof textSettings>) => {
    console.log('updateSelectedText called with:', updates);
    
    if (!fabricCanvasRef.current) {
      console.log('No fabric canvas');
      return;
    }
    
    // Get the currently active object
    const activeObject = fabricCanvasRef.current.getActiveObject();
    console.log('Active object from canvas:', activeObject);
    
    if (!activeObject || activeObject.type !== 'i-text') {
      console.log('No text object selected or wrong type');
      return;
    }
    
    const textObj = activeObject as IText;
    
    if (updates.color !== undefined) {
      textObj.set('fill', updates.color);
      console.log('Updated color to:', updates.color);
    }
    if (updates.fontSize !== undefined) {
      textObj.set('fontSize', updates.fontSize);
      console.log('Updated fontSize to:', updates.fontSize);
    }
    if (updates.fontFamily !== undefined) {
      textObj.set('fontFamily', updates.fontFamily);
      console.log('Updated fontFamily to:', updates.fontFamily);
    }
    
    // Mark the object as dirty and re-render
    textObj.setCoords();
    fabricCanvasRef.current.renderAll();
    
    // Update the text settings state as well
    setTextSettings(prev => ({ ...prev, ...updates }));
    
    // Force update selected text object to trigger re-render
    setSelectedTextObject(textObj);
  }, []);

  // Handle page reordering
  const handlePageReorder = async (newOrder: number[]) => {
    if (!pdfDoc || !originalPdfBytes || !fabricCanvasRef.current) return;
    
    try {
      console.log('Applying new page order:', newOrder);
      
      // Save current text annotations with their page associations
      const canvas = fabricCanvasRef.current;
      const textAnnotations: Array<{
        text: IText;
        originalPageIndex: number;
        relativeY: number;
      }> = [];
      
      // Collect all text annotations and determine which page they belong to
      const objects = canvas.getObjects();
      for (const obj of objects) {
        if (obj.type === 'i-text') {
          const textObj = obj as IText;
          const objTop = textObj.top || 0;
          
          // Find which page this text belongs to
          for (let i = 0; i < allPagesData.length; i++) {
            const pageData = allPagesData[i];
            if (objTop >= pageData.yOffset && 
                objTop < pageData.yOffset + pageData.height) {
              textAnnotations.push({
                text: textObj,
                originalPageIndex: i,
                relativeY: objTop - pageData.yOffset
              });
              break;
            }
          }
        }
      }
      
      console.log(`Preserving ${textAnnotations.length} text annotations`);
      
      // Create a mapping from old page index to new page index
      const pageIndexMap = new Map<number, number>();
      newOrder.forEach((originalPageNum, newIndex) => {
        pageIndexMap.set(originalPageNum - 1, newIndex);
      });
      
      // Create a new PDF with reordered pages
      const srcPdf = await PDFDocument.load(originalPdfBytes);
      const newPdf = await PDFDocument.create();
      
      // Copy pages in new order
      for (const pageNum of newOrder) {
        const [copiedPage] = await newPdf.copyPages(srcPdf, [pageNum - 1]);
        newPdf.addPage(copiedPage);
      }
      
      // Save the reordered PDF
      const reorderedBytes = await newPdf.save();
      setOriginalPdfBytes(new Uint8Array(reorderedBytes));
      
      // Reload the PDF with new order
      const pdfJsCopy = new Uint8Array(reorderedBytes);
      const pdf = await pdfjsLib.getDocument(pdfJsCopy).promise;
      setPdfDoc(pdf);
      setPageOrder(newOrder);
      
      // Clear canvas before re-rendering
      canvas.clear();
      canvas.backgroundColor = '#f5f5f5';
      
      // Re-render all pages
      await renderAllPages(pdf);
      
      // Wait for rendering to complete
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Restore text annotations at their new positions
      for (const annotation of textAnnotations) {
        const newPageIndex = pageIndexMap.get(annotation.originalPageIndex);
        if (newPageIndex !== undefined && allPagesData[newPageIndex]) {
          const newPageData = allPagesData[newPageIndex];
          
          // Create a new text object with the same properties
          const newText = new IText(annotation.text.text || '', {
            left: annotation.text.left,
            top: newPageData.yOffset + annotation.relativeY,
            fontSize: annotation.text.fontSize,
            fill: annotation.text.fill,
            fontFamily: annotation.text.fontFamily,
            editable: true,
            width: annotation.text.width
          });
          
          canvas.add(newText);
        }
      }
      
      canvas.renderAll();
      showModal('Pages reordered successfully! Text annotations have been preserved.', 'success');
    } catch (error) {
      console.error('Error reordering pages:', error);
      showModal('Failed to reorder pages. Please try again.', 'error');
    }
  };

  // Save PDF with annotations
  const handleSave = async () => {
    if (!originalPdfBytes || !fabricCanvasRef.current || !allPagesData.length) return;

    // For now, use a default filename. In future, you could create a filename input modal
    const filename = 'edited-document.pdf';

    try {
      showModal('Saving PDF...', 'info');
      // Check if there's Thai text
      const fabricObjects = fabricCanvasRef.current.getObjects();
      const hasThaiText = fabricObjects.some(obj => {
        if (obj.type === 'i-text') {
          const textObj = obj as IText;
          const text = textObj.text || '';
          return /[\u0E00-\u0E7F]/.test(text);
        }
        return false;
      });
      
      if (hasThaiText) {
        // Use image-based save for proper Thai rendering
        console.log('Thai text detected, using image-based rendering');
        await imageSavePDF({
          originalPdfBytes,
          fabricObjects,
          allPagesData,
          filename
        });
      } else {
        // Use simple save for non-Thai text
        await simpleSavePDF({
          originalPdfBytes,
          fabricObjects,
          allPagesData,
          filename
        });
      }
      
      // Close loading modal and show success
      closeModal();
      setTimeout(() => {
        showModal('PDF saved successfully!', 'success');
      }, 100);
    } catch (error) {
      console.error('Error saving PDF:', error);
      showModal('Error saving PDF: ' + (error as Error).message, 'error');
    }
  };


  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-semibold">PDF Editor (Fabric.js)</h1>
            {file && (
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600">{file.name}</span>
                <button
                  onClick={() => setShowReorderModal(true)}
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 flex items-center space-x-2"
                  title="Reorder Pages"
                >
                  <Shuffle className="w-4 h-4" />
                  <span>Reorder Pages</span>
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Save PDF
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {!file ? (
        <div className="max-w-2xl mx-auto mt-20">
          <FileUpload onFileSelect={handleFileSelect} />
        </div>
      ) : (
        <div className="flex h-[calc(100vh-4rem)]">
          {/* Toolbar */}
          <FabricToolbar
            isAddingText={isAddingText}
            onToggleAddText={() => setIsAddingText(!isAddingText)}
            textSettings={textSettings}
            onTextSettingsChange={setTextSettings}
            selectedTextObject={selectedTextObject}
            onUpdateSelectedText={updateSelectedText}
            onDeleteSelectedText={deleteSelectedText}
          />

          {/* Main Canvas Area */}
          <div className="flex-1 overflow-auto bg-gray-50" ref={containerRef}>
            <div className="p-4">
              {/* Canvas - All pages in continuous scroll */}
              <div className="flex justify-center">
                <div className="bg-white shadow-lg">
                  <canvas ref={canvasRef} />
                </div>
              </div>
            </div>
          </div>

          {/* Zoom Controls */}
          <FabricZoomControls
            zoomLevel={zoomLevel}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onFitToWidth={handleFitToWidth}
          />
        </div>
      )}
      
      {/* Page Reorder Modal */}
      {pdfDoc && (
        <PageReorderModal
          isOpen={showReorderModal}
          onClose={() => setShowReorderModal(false)}
          pdfDoc={pdfDoc}
          onReorder={handlePageReorder}
        />
      )}
      
      {/* Alert Modal */}
      <Modal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        message={modalState.message}
        type={modalState.type}
        title={modalState.title}
        onConfirm={modalState.onConfirm}
        showCancel={modalState.showCancel}
      />
    </div>
  );
};