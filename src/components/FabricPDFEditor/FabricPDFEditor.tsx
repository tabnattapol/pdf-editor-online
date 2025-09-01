import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Canvas, IText, FabricImage } from 'fabric';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, rgb, StandardFonts, PDFFont } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { preprocessThaiText } from '../../utils/thaiTextRenderer';
import { FileUpload } from '../UI/FileUpload';
import { FabricToolbar } from './FabricToolbar';
import { FabricZoomControls } from './FabricZoomControls';
import { PageReorderModal } from './PageReorderModal';
import { downloadFile } from '../../utils/downloadHelper';
import { Shuffle } from 'lucide-react';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export const FabricPDFEditor: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fabricCanvasRef = useRef<Canvas | null>(null);
  
  const [file, setFile] = useState<File | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [allPagesData, setAllPagesData] = useState<any[]>([]);
  const [isAddingText, setIsAddingText] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [originalPdfBytes, setOriginalPdfBytes] = useState<Uint8Array | null>(null);
  const [canvasReady, setCanvasReady] = useState(false);
  const [showReorderModal, setShowReorderModal] = useState(false);
  const [pageOrder, setPageOrder] = useState<number[]>([]);
  
  // Text settings
  const [textSettings, setTextSettings] = useState({
    fontSize: 16,
    color: '#000000',
    fontFamily: 'Helvetica'
  });

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
      width: 200
    });

    fabricCanvasRef.current.add(text);
    fabricCanvasRef.current.setActiveObject(text);
    text.enterEditing();
    text.selectAll();
  }, [textSettings]);

  // Handle mouse events for adding text
  useEffect(() => {
    if (!fabricCanvasRef.current) return;
    
    const canvas = fabricCanvasRef.current;
    
    const handleMouseDown = (options: any) => {
      console.log('Mouse down event:', { isAddingText, target: options.target });
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
  }, [isAddingText, addTextAtPosition]);

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

  // Render PDF page
  const renderPage = useCallback(async (pdf: any, pageNum: number, zoom?: number) => {
    console.log('renderPage called', { 
      hasFabricCanvas: !!fabricCanvasRef.current, 
      hasContainer: !!containerRef.current,
      pageNum,
      zoom 
    });
    if (!fabricCanvasRef.current || !containerRef.current) {
      console.error('Missing refs:', { 
        fabricCanvas: fabricCanvasRef.current, 
        container: containerRef.current 
      });
      return;
    }

    const currentZoom = zoom ?? zoomLevel;
    const page = await pdf.getPage(pageNum);
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
  }, []);

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
      alert('Pages reordered successfully! Text annotations have been preserved.');
    } catch (error) {
      console.error('Error reordering pages:', error);
      alert('Failed to reorder pages. Please try again.');
    }
  };

  // Save PDF with annotations
  const handleSave = async () => {
    if (!originalPdfBytes || !fabricCanvasRef.current || !allPagesData.length) return;

    const filename = prompt('Enter filename:', 'edited-document.pdf');
    if (!filename) return;

    try {
      console.log('Original PDF bytes length:', originalPdfBytes.length);
      
      // Verify we have valid PDF data
      if (originalPdfBytes.length === 0) {
        throw new Error('PDF data is empty. Please reload the file.');
      }
      
      // Check PDF header
      const header = new TextDecoder().decode(originalPdfBytes.slice(0, 5));
      console.log('PDF header:', header);
      
      if (!header.startsWith('%PDF')) {
        throw new Error('Invalid PDF data. Please reload the file.');
      }
      
      // Load original PDF
      const pdfDoc = await PDFDocument.load(originalPdfBytes);
      
      // IMPORTANT: Register fontkit BEFORE embedding custom fonts
      pdfDoc.registerFontkit(fontkit);
      
      // Get all pages
      const pages = pdfDoc.getPages();
      const canvas = fabricCanvasRef.current;
      
      // Embed standard fonts
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const timesFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
      const courierFont = await pdfDoc.embedFont(StandardFonts.Courier);
      
      // Load Thai font for Unicode support - try multiple fonts
      let thaiFont: any = null;
      const fontUrls = [
        '/fonts/IBMPlexSansThai-Regular.ttf',  // Best for complex Thai with tone marks
        '/fonts/Garuda.ttf',                   // Good for Thai tone marks
        '/fonts/Sarabun-Regular.ttf',          // Popular Thai font
        '/fonts/NotoSansThai.ttf',             // Fallback option
      ];
      
      for (const fontUrl of fontUrls) {
        try {
          console.log(`Trying to load font: ${fontUrl}`);
          const fontResponse = await fetch(fontUrl);
          if (!fontResponse.ok) {
            console.warn(`Font not found: ${fontUrl}`);
            continue;
          }
          const fontBytes = await fontResponse.arrayBuffer();
          console.log(`Font bytes loaded from ${fontUrl}, size:`, fontBytes.byteLength);
          
          // Embed the custom font with fontkit support
          thaiFont = await pdfDoc.embedFont(fontBytes);
          console.log(`Thai font embedded successfully from ${fontUrl}`);
          break; // Stop after first successful font
        } catch (error) {
          console.warn(`Failed to load font ${fontUrl}:`, error);
        }
      }
      
      if (!thaiFont) {
        console.error('No Thai fonts could be loaded');
        alert('Warning: Thai font could not be loaded. Thai text may not display correctly.');
      }
      
      // Get all text annotations from Fabric
      const objects = canvas.getObjects();
      console.log(`Found ${objects.length} objects on canvas`);
      
      // Process text annotations for each page
      for (const obj of objects) {
        if (obj.type === 'i-text') {
          const textObj = obj as IText;
          // Get the actual text content from Fabric.js IText object
          // IMPORTANT: Fabric.js might store text with special characters
          const rawText = textObj.text || '';
          
          // Skip completely empty text objects
          if (!rawText || rawText.length === 0) continue;
          
          // Clean up any potential hidden characters but preserve Thai text
          // Remove zero-width spaces and other invisible characters that might cause issues
          const text = rawText.replace(/[\u200B-\u200D\uFEFF]/g, '');
          
          console.log(`Processing text object:`);
          console.log(`  Raw text: "${rawText}"`);
          console.log(`  Cleaned text: "${text}"`);
          console.log(`  Length: raw=${rawText.length}, cleaned=${text.length}`);
          console.log(`  Has newlines: ${text.includes('\n')}`);
          
          // Check for any unusual characters
          const unusualChars = Array.from(rawText).filter(c => {
            const code = c.charCodeAt(0);
            return code < 32 && code !== 10; // Control chars except newline
          });
          if (unusualChars.length > 0) {
            console.warn(`Found unusual characters:`, unusualChars.map(c => c.charCodeAt(0)));
          }
          
          // Find which page this text belongs to based on Y position
          let targetPageIndex = 0;
          let relativeY = textObj.top || 0;
          
          for (let i = 0; i < allPagesData.length; i++) {
            const pageData = allPagesData[i];
            if (relativeY >= pageData.yOffset && 
                relativeY < pageData.yOffset + pageData.height) {
              targetPageIndex = i;
              relativeY = relativeY - pageData.yOffset;
              break;
            }
          }
          
          // Get the target page
          if (targetPageIndex >= pages.length) continue;
          const page = pages[targetPageIndex];
          const { width: pageWidth, height: pageHeight } = page.getSize();
          const pageData = allPagesData[targetPageIndex];
          
          // Calculate scale factors for this specific page
          const scaleX = pageWidth / pageData.width;
          const scaleY = pageHeight / pageData.height;
          
          // Convert coordinates
          const pdfX = (textObj.left || 0) * scaleX;
          const pdfY = pageHeight - (relativeY + (textObj.fontSize || 16)) * scaleY;
          
          // Check if text contains Thai characters or other non-ASCII
          const hasThai = /[\u0E00-\u0E7F]/.test(text);
          const hasNonAscii = /[^\x00-\x7F]/.test(text);
          
          // Check for Thai tone marks and vowels (these need special handling)
          const hasThaiToneMarks = /[\u0E31-\u0E3A\u0E47-\u0E4E]/.test(text);
          if (hasThaiToneMarks) {
            console.log('Text contains Thai tone marks/vowels - using special handling');
          }
          
          // Select appropriate font
          let font = helveticaFont;
          if ((hasThai || hasNonAscii) && thaiFont) {
            // Use Thai font for Thai text or other Unicode
            font = thaiFont;
            console.log(`Using Thai font for text: "${text.substring(0, 20)}..."`);
          } else {
            // Use standard fonts for ASCII text
            if (textObj.fontFamily === 'Times-Roman') font = timesFont;
            if (textObj.fontFamily === 'Courier') font = courierFont;
          }
          
          // Parse color
          const color = textObj.fill as string || '#000000';
          const hexColor = color.replace('#', '');
          const r = parseInt(hexColor.substr(0, 2), 16) / 255;
          const g = parseInt(hexColor.substr(2, 2), 16) / 255;
          const b = parseInt(hexColor.substr(4, 2), 16) / 255;
          
          // Draw text - handle multi-line text properly
          const lines = text.split('\n');
          lines.forEach((line, index) => {
            // For Thai text with tone marks, normalize the Unicode
            let processedLine = line;
            
            if (hasThai) {
              // Preprocess Thai text to handle tone marks better
              processedLine = preprocessThaiText(line);
              console.log(`Original Thai text: "${line}"`);
              console.log(`Preprocessed Thai text: "${processedLine}"`);
              
              // For debugging: show character codes
              const chars = Array.from(processedLine);
              console.log(`Characters: ${chars.join(', ')}`);
              console.log(`Character codes: ${chars.map(c => '0x' + c.charCodeAt(0).toString(16).toUpperCase()).join(', ')}`);
            } else if (!hasNonAscii) {
              // Only trim for pure ASCII text
              processedLine = line.trim();
            }
            
            // Skip completely empty lines only if there are multiple lines
            if (processedLine.length === 0 && lines.length > 1) {
              return; // Skip empty lines in multi-line text
            }
            
            try {
              // Log the text being saved for debugging
              console.log(`Saving text line ${index}: "${processedLine}"`);
              console.log(`Character codes:`, Array.from(processedLine).map(c => c.charCodeAt(0)));
              
              page.drawText(processedLine, {
                x: pdfX,
                y: pdfY - (index * (textObj.fontSize || 16) * 1.2 * scaleY),
                size: (textObj.fontSize || 16) * scaleY,
                font: font,
                color: rgb(r, g, b)
              });
            } catch (encodeError) {
              console.warn(`Could not encode text "${processedLine}", trying fallback:`, encodeError);
              // Try with basic font as fallback
              if (font !== helveticaFont) {
                try {
                  // Replace non-ASCII characters with placeholders
                  const asciiLine = processedLine.replace(/[^\x00-\x7F]/g, '?');
                  page.drawText(asciiLine, {
                    x: pdfX,
                    y: pdfY - (index * (textObj.fontSize || 16) * 1.2 * scaleY),
                    size: (textObj.fontSize || 16) * scaleY,
                    font: helveticaFont,
                    color: rgb(r, g, b)
                  });
                  console.log(`Fallback text saved: "${asciiLine}"`);
                } catch (fallbackError) {
                  console.error('Could not draw text even with fallback:', fallbackError);
                }
              }
            }
          });
        }
      }
      
      // Save PDF
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      downloadFile(blob, filename);
    } catch (error) {
      console.error('Error saving PDF:', error);
      alert('Error saving PDF. Please try again.');
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
    </div>
  );
};