import { useCallback } from 'react';

interface PDFPageInfo {
  width: number;
  height: number;
  scale: number;
}

export const usePDFCoordinates = () => {
  // Convert screen coordinates to PDF coordinates
  const screenToPDF = useCallback((
    screenX: number,
    screenY: number,
    displayWidth: number,
    displayHeight: number,
    pdfPageWidth: number = 595.28, // A4 width in points
    pdfPageHeight: number = 841.89  // A4 height in points
  ) => {
    // Calculate the scale factor between display and PDF
    const scaleX = pdfPageWidth / displayWidth;
    const scaleY = pdfPageHeight / displayHeight;
    
    // Convert to PDF coordinates
    // Screen coordinates have origin at top-left
    // PDF coordinates also store with top-left origin for consistency
    const pdfX = screenX * scaleX;
    const pdfY = screenY * scaleY;
    
    return { pdfX, pdfY, scaleX, scaleY };
  }, []);

  // Convert PDF coordinates to screen coordinates
  const pdfToScreen = useCallback((
    pdfX: number,
    pdfY: number,
    displayWidth: number,
    displayHeight: number,
    pdfPageWidth: number = 595.28,
    pdfPageHeight: number = 841.89
  ) => {
    // Calculate the scale factor between PDF and display
    const scaleX = displayWidth / pdfPageWidth;
    const scaleY = displayHeight / pdfPageHeight;
    
    // Convert to screen coordinates
    const screenX = pdfX * scaleX;
    const screenY = pdfY * scaleY;
    
    return { screenX, screenY, scaleX, scaleY };
  }, []);

  // Calculate actual font size for PDF
  const calculatePDFFontSize = useCallback((
    displayFontSize: number,
    zoomLevel: number = 1
  ) => {
    // The font size should be independent of zoom level
    // PDF uses points (1/72 inch) as units
    // We need to ensure consistency regardless of screen size
    return displayFontSize / zoomLevel;
  }, []);

  // Get PDF page dimensions from Page object
  const getPageDimensions = useCallback((page: any) => {
    if (!page) return { width: 595.28, height: 841.89 }; // A4 default
    
    const viewport = page.getViewport({ scale: 1 });
    return {
      width: viewport.width,
      height: viewport.height
    };
  }, []);

  return {
    screenToPDF,
    pdfToScreen,
    calculatePDFFontSize,
    getPageDimensions
  };
};