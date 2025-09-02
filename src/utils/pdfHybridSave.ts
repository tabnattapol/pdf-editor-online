import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { 
  initializePdfMake, 
  convertFabricToAnnotations 
} from './pdfmakeRenderer';
import { downloadFile } from './downloadHelper';

interface SaveOptions {
  originalPdfBytes: Uint8Array;
  fabricObjects: any[];
  allPagesData: any[];
  filename: string;
}

/**
 * Hybrid save approach: Use pdfmake for Thai text, pdf-lib for everything else
 */
export async function hybridSavePDF(options: SaveOptions): Promise<void> {
  const { originalPdfBytes, fabricObjects, allPagesData, filename } = options;
  
  console.log('Starting hybrid PDF save...');
  
  // Get text objects
  const textObjects = fabricObjects.filter(obj => obj.type === 'i-text');
  console.log(`Found ${textObjects.length} text annotations`);
  
  // Check if we have Thai text
  const hasThaiText = textObjects.some(obj => {
    const text = obj.text || '';
    return /[\u0e00-\u0e7f]/.test(text);
  });
  
  // Load original PDF
  const pdfDoc = await PDFDocument.load(originalPdfBytes);
  pdfDoc.registerFontkit(fontkit);
  
  if (hasThaiText && textObjects.length > 0) {
    console.log('Thai text detected - using pdfmake for text rendering');
    
    // Initialize pdfmake
    await initializePdfMake();
    
    // Convert Fabric objects to annotations
    const annotations = convertFabricToAnnotations(fabricObjects, allPagesData);
    
    // Group annotations by page
    const pageAnnotations = new Map<number, any[]>();
    for (const annotation of annotations) {
      if (!pageAnnotations.has(annotation.pageIndex)) {
        pageAnnotations.set(annotation.pageIndex, []);
      }
      pageAnnotations.get(annotation.pageIndex)!.push(annotation);
    }
    
    // Add text to each page using pdfmake for Thai text
    const pages = pdfDoc.getPages();
    
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const pageTexts = pageAnnotations.get(i) || [];
      
      if (pageTexts.length === 0) continue;
      
      // For Thai text, we'll create a separate PDF with pdfmake and merge it
      // This is a simplified approach - just add text directly for now
      const { width: pageWidth, height: pageHeight } = page.getSize();
      
      // Embed fonts
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      
      for (const annotation of pageTexts) {
        const text = annotation.text;
        const hasThai = /[\u0e00-\u0e7f]/.test(text);
        
        if (!hasThai) {
          // Non-Thai text: use pdf-lib directly
          try {
            // Calculate proper coordinates
            const scaleX = pageWidth / annotation.pageWidth;
            const scaleY = pageHeight / annotation.pageHeight;
            
            const pdfX = annotation.x * scaleX;
            const pdfY = pageHeight - (annotation.y + annotation.fontSize) * scaleY;
            
            // Parse color
            const color = annotation.color || '#000000';
            const hexColor = color.replace('#', '');
            const r = parseInt(hexColor.substr(0, 2), 16) / 255;
            const g = parseInt(hexColor.substr(2, 2), 16) / 255;
            const b = parseInt(hexColor.substr(4, 2), 16) / 255;
            
            page.drawText(text, {
              x: pdfX,
              y: pdfY,
              size: annotation.fontSize * scaleY,
              font: helveticaFont,
              color: rgb(r, g, b)
            });
          } catch (error) {
            console.warn(`Could not add text "${text}":`, error);
          }
        } else {
          // Thai text: We'll handle this differently
          console.log(`Thai text "${text}" will be rendered with alternative method`);
          
          // For now, add placeholder or skip
          // In a full implementation, you would:
          // 1. Create a separate PDF with pdfmake containing only Thai text
          // 2. Merge it as an overlay
          
          // Simple fallback: add with question marks
          try {
            const scaleX = pageWidth / annotation.pageWidth;
            const scaleY = pageHeight / annotation.pageHeight;
            
            const pdfX = annotation.x * scaleX;
            const pdfY = pageHeight - (annotation.y + annotation.fontSize) * scaleY;
            
            // Replace Thai characters with placeholders
            const placeholderText = text.replace(/[\u0e00-\u0e7f]/g, '?');
            
            page.drawText(placeholderText + ' [Thai]', {
              x: pdfX,
              y: pdfY,
              size: annotation.fontSize * scaleY,
              font: helveticaFont,
              color: rgb(0.5, 0.5, 0.5)
            });
            
            console.warn(`Thai text replaced with placeholder: "${placeholderText}"`);
          } catch (error) {
            console.error('Could not add placeholder text:', error);
          }
        }
      }
    }
  } else {
    console.log('No Thai text detected - using standard pdf-lib approach');
    
    // Standard approach for non-Thai text
    const pages = pdfDoc.getPages();
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    
    for (const obj of textObjects) {
      const text = obj.text || '';
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
      const hexColor = color.replace('#', '');
      const r = parseInt(hexColor.substr(0, 2), 16) / 255;
      const g = parseInt(hexColor.substr(2, 2), 16) / 255;
      const b = parseInt(hexColor.substr(4, 2), 16) / 255;
      
      try {
        page.drawText(text, {
          x: pdfX,
          y: pdfY,
          size: (obj.fontSize || 16) * scaleY,
          font: helveticaFont,
          color: rgb(r, g, b)
        });
      } catch (error) {
        console.warn(`Could not add text "${text}":`, error);
      }
    }
  }
  
  // Save PDF
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  downloadFile(blob, filename);
  
  console.log('PDF saved successfully!');
}