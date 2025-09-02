import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { downloadFile } from './downloadHelper';

interface SaveOptions {
  originalPdfBytes: Uint8Array;
  fabricObjects: any[];
  allPagesData: any[];
  filename: string;
}

/**
 * Simplified save approach - use pdf-lib with fallback for Thai text
 */
export async function simpleSavePDF(options: SaveOptions): Promise<void> {
  const { originalPdfBytes, fabricObjects, allPagesData, filename } = options;
  
  console.log('Starting PDF save...');
  
  // Get text objects
  const textObjects = fabricObjects.filter(obj => obj.type === 'i-text');
  console.log(`Found ${textObjects.length} text annotations`);
  
  // Load original PDF
  const pdfDoc = await PDFDocument.load(originalPdfBytes);
  pdfDoc.registerFontkit(fontkit);
  
  // Get pages
  const pages = pdfDoc.getPages();
  
  // Try to load Thai font FIRST as our main font
  let mainFont: any = null;
  
  // Try multiple Thai fonts to find one that works best
  const fontOptions = [
    '/fonts/NotoSansThai.ttf',      // Noto often has better Unicode support
    '/fonts/Sarabun-Regular.ttf',   // Popular Thai font
    '/fonts/IBMPlexSansThai-Regular.ttf', // IBM Plex has good Thai support
  ];
  
  for (const fontUrl of fontOptions) {
    try {
      console.log(`Trying to load font: ${fontUrl}`);
      const fontResponse = await fetch(fontUrl);
      if (fontResponse.ok) {
        const fontBytes = await fontResponse.arrayBuffer();
        mainFont = await pdfDoc.embedFont(fontBytes);
        console.log(`Successfully loaded font: ${fontUrl}`);
        break;
      }
    } catch (fontError) {
      console.warn(`Could not load font ${fontUrl}:`, fontError);
    }
  }
  
  // Fallback to Helvetica if Thai font fails
  if (!mainFont) {
    console.log('Using Helvetica as fallback font');
    mainFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  }
  
  // Process each text object
  for (const obj of textObjects) {
    let text = obj.text || '';
    if (!text) continue;
    
    // Normalize Unicode to handle Thai combining characters better
    // NFC = Canonical Decomposition, followed by Canonical Composition
    text = text.normalize('NFC');
    
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
    
    // Always use the main font (Thai font if loaded, Helvetica as fallback)
    try {
      console.log(`Adding text with main font: "${text}"`);
      page.drawText(text, {
        x: pdfX,
        y: pdfY,
        size: (obj.fontSize || 16) * scaleY,
        font: mainFont,
        color: rgb(r, g, b)
      });
      console.log(`Text added successfully: "${text}"`);
    } catch (error) {
      console.warn(`Could not add text "${text}":`, error);
      // If even the main font fails, try with placeholders
      if (mainFont !== await pdfDoc.embedFont(StandardFonts.Helvetica)) {
        try {
          const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
          const placeholderText = text.replace(/[\u0E00-\u0E7F]/g, '?');
          page.drawText(placeholderText, {
            x: pdfX,
            y: pdfY,
            size: (obj.fontSize || 16) * scaleY,
            font: helveticaFont,
            color: rgb(r, g, b)
          });
        } catch (fallbackError) {
          console.error('Could not add text even with fallback:', fallbackError);
        }
      }
    }
  }
  
  // Save PDF
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  downloadFile(blob, filename);
  
  console.log('PDF saved successfully!');
}