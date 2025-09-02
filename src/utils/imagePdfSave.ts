import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { downloadFile } from './downloadHelper';
import { textToImageDataUrl, dataUrlToUint8Array } from './textToImage';

interface SaveOptions {
  originalPdfBytes: Uint8Array;
  fabricObjects: any[];
  allPagesData: any[];
  filename: string;
}

/**
 * Save PDF with Thai text rendered as images
 * This approach ensures proper Thai text rendering including tone marks
 */
export async function imageSavePDF(options: SaveOptions): Promise<void> {
  const { originalPdfBytes, fabricObjects, allPagesData, filename } = options;
  
  console.log('Starting PDF save with image rendering for Thai text...');
  
  // Get text objects
  const textObjects = fabricObjects.filter(obj => obj.type === 'i-text');
  console.log(`Found ${textObjects.length} text annotations`);
  
  // Load original PDF
  const pdfDoc = await PDFDocument.load(originalPdfBytes);
  pdfDoc.registerFontkit(fontkit);
  
  // Get pages
  const pages = pdfDoc.getPages();
  
  // Embed standard font for non-Thai text
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  
  // Process each text object
  for (const obj of textObjects) {
    let text = obj.text || '';
    if (!text) continue;
    
    // Find which page this text belongs to
    let targetPageIndex = 0;
    let relativeY = obj.top || 0;
    
    for (let i = 0; i < allPagesData.length; i++) {
      const pageData = allPagesData[i];
      if (relativeY >= pageData.yOffset && 
          relativeY < pageData.yOffset + pageData.height) {
        targetPageIndex = i;
        relativeY = relativeY - pageData.yOffset;
        break;
      }
    }
    
    if (targetPageIndex >= pages.length) continue;
    
    const page = pages[targetPageIndex];
    const { width: pageWidth, height: pageHeight } = page.getSize();
    const pageData = allPagesData[targetPageIndex];
    
    // Calculate scale factors
    const scaleX = pageWidth / pageData.width;
    const scaleY = pageHeight / pageData.height;
    
    // Convert coordinates
    const pdfX = (obj.left || 0) * scaleX;
    const pdfY = pageHeight - (relativeY + (obj.fontSize || 16)) * scaleY;
    
    // Parse color
    const color = obj.fill || '#000000';
    
    // Check if text has Thai characters
    const hasThai = /[\u0E00-\u0E7F]/.test(text);
    
    if (hasThai) {
      // Split text by newlines and render each line separately
      const lines = text.split('\n');
      console.log(`Rendering ${lines.length} lines of Thai text as images`);
      
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        if (!line && lines.length > 1) continue; // Skip empty lines in multi-line text
        
        console.log(`Rendering line ${lineIndex + 1}: "${line}"`);
        
        try {
          // Create image from text line
          const imageDataUrl = await textToImageDataUrl(
            line || ' ', // Use space for empty lines to maintain spacing
            (obj.fontSize || 16) * scaleY * 4, // Higher resolution for clarity
            color,
            obj.fontFamily || 'Sarabun'
          );
          
          // Convert to bytes
          const imageBytes = dataUrlToUint8Array(imageDataUrl);
          
          // Embed image in PDF
          const image = await pdfDoc.embedPng(imageBytes);
          const imageDims = image.scale(0.25); // Scale down since we rendered at 4x
          
          // Calculate Y position for this line
          const lineHeight = (obj.fontSize || 16) * scaleY * 1.2;
          const lineY = pdfY - (lineIndex * lineHeight);
          
          // Draw image at text position
          page.drawImage(image, {
            x: pdfX,
            y: lineY - imageDims.height + (obj.fontSize || 16) * scaleY,
            width: imageDims.width,
            height: imageDims.height,
          });
          
          console.log(`Line ${lineIndex + 1} rendered successfully`);
        } catch (error) {
          console.error(`Failed to render line ${lineIndex + 1}:`, error);
          // Fallback to text with placeholder
          const hexColor = color.replace('#', '');
          const r = parseInt(hexColor.substr(0, 2), 16) / 255;
          const g = parseInt(hexColor.substr(2, 2), 16) / 255;
          const b = parseInt(hexColor.substr(4, 2), 16) / 255;
          
          const lineHeight = (obj.fontSize || 16) * scaleY * 1.2;
          const lineY = pdfY - (lineIndex * lineHeight);
          
          const placeholderText = line.replace(/[\u0E00-\u0E7F]/g, '?') + ' [Thai]';
          page.drawText(placeholderText, {
            x: pdfX,
            y: lineY,
            size: (obj.fontSize || 16) * scaleY,
            font: helveticaFont,
            color: rgb(r, g, b)
          });
        }
      }
    } else {
      // Non-Thai text - use standard font but handle multi-line
      const hexColor = color.replace('#', '');
      const r = parseInt(hexColor.substr(0, 2), 16) / 255;
      const g = parseInt(hexColor.substr(2, 2), 16) / 255;
      const b = parseInt(hexColor.substr(4, 2), 16) / 255;
      
      const lines = text.split('\n');
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        if (!line && lines.length > 1) continue; // Skip empty lines in multi-line text
        
        const lineHeight = (obj.fontSize || 16) * scaleY * 1.2;
        const lineY = pdfY - (lineIndex * lineHeight);
        
        try {
          page.drawText(line, {
            x: pdfX,
            y: lineY,
            size: (obj.fontSize || 16) * scaleY,
            font: helveticaFont,
            color: rgb(r, g, b)
          });
        } catch (error) {
          console.warn(`Could not add text "${line}":`, error);
        }
      }
    }
  }
  
  // Save PDF
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  downloadFile(blob, filename);
  
  console.log('PDF saved successfully with Thai text as images!');
}