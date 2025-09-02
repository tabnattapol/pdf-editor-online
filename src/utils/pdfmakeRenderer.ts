import pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';

// Initialize vfs immediately
if (typeof (pdfFonts as any).pdfMake !== 'undefined') {
  pdfMake.vfs = (pdfFonts as any).pdfMake.vfs;
} else if (typeof (pdfFonts as any).default !== 'undefined') {
  pdfMake.vfs = (pdfFonts as any).default.pdfMake.vfs;
} else {
  // Fallback - create empty vfs
  pdfMake.vfs = pdfMake.vfs || {};
}
import { IText } from 'fabric';
import { initializeThaiFonts } from './thaiFonts';


interface TextAnnotation {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  pageIndex: number;
  pageWidth: number;
  pageHeight: number;
}

/**
 * Initialize pdfmake with Thai fonts
 */
export async function initializePdfMake() {
  try {
    // VFS should already be initialized, but check again
    if (!pdfMake.vfs) {
      console.warn('pdfMake.vfs was not initialized, setting it now');
      if (typeof (pdfFonts as any).pdfMake !== 'undefined') {
        pdfMake.vfs = (pdfFonts as any).pdfMake.vfs;
      } else {
        pdfMake.vfs = {};
      }
    }
    
    // Load Thai fonts
    const fonts = await initializeThaiFonts();
    
    // Add Thai fonts to virtual file system
    pdfMake.vfs['Sarabun-Regular.ttf'] = fonts.normal;
    pdfMake.vfs['Sarabun-Bold.ttf'] = fonts.bold || fonts.normal;
    pdfMake.vfs['Sarabun-Italic.ttf'] = fonts.italics || fonts.normal;
    pdfMake.vfs['Sarabun-BoldItalic.ttf'] = fonts.bolditalics || fonts.normal;
    
    // Configure pdfmake fonts
    pdfMake.fonts = {
      Sarabun: {
        normal: 'Sarabun-Regular.ttf',
        bold: 'Sarabun-Bold.ttf',
        italics: 'Sarabun-Italic.ttf',
        bolditalics: 'Sarabun-BoldItalic.ttf'
      },
      // Use default Roboto font as fallback
      Roboto: {
        normal: 'Roboto-Regular.ttf',
        bold: 'Roboto-Medium.ttf',
        italics: 'Roboto-Italic.ttf',
        bolditalics: 'Roboto-MediumItalic.ttf'
      }
    };
    
    console.log('pdfmake initialized with Thai fonts');
  } catch (error) {
    console.error('Failed to initialize pdfmake:', error);
    throw error;
  }
}

/**
 * Check if text contains Thai characters
 */
function containsThai(text: string): boolean {
  return /[\u0E00-\u0E7F]/.test(text);
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

/**
 * Create a transparent PDF with text annotations using pdfmake
 */
export async function createTextLayerPDF(
  annotations: TextAnnotation[],
  pageCount: number,
  pageWidth: number,
  pageHeight: number
): Promise<Uint8Array> {
  
  // Ensure pdfmake is initialized
  if (!pdfMake.vfs || Object.keys(pdfMake.vfs).length === 0) {
    await initializePdfMake();
  }
  
  // Group annotations by page
  const pageAnnotations: Map<number, TextAnnotation[]> = new Map();
  for (const annotation of annotations) {
    const pageIndex = annotation.pageIndex;
    if (!pageAnnotations.has(pageIndex)) {
      pageAnnotations.set(pageIndex, []);
    }
    pageAnnotations.get(pageIndex)!.push(annotation);
  }
  
  // Create content for each page
  const content: any[] = [];
  
  for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
    const pageTexts = pageAnnotations.get(pageIndex) || [];
    
    // Add page break for pages after the first
    if (pageIndex > 0) {
      content.push({ text: '', pageBreak: 'after' });
    }
    
    // Add text annotations for this page
    for (const annotation of pageTexts) {
      const isThai = containsThai(annotation.text);
      const font = isThai ? 'Sarabun' : 'Roboto';
      
      // Convert color
      hexToRgb(annotation.color); // Validate color format
      const colorHex = annotation.color.startsWith('#') ? annotation.color : `#${annotation.color}`;
      
      // Add text with absolute positioning
      content.push({
        text: annotation.text,
        font: font,
        fontSize: annotation.fontSize,
        color: colorHex,
        absolutePosition: {
          x: annotation.x,
          y: annotation.y
        },
        lineHeight: 1.2
      });
      
      console.log(`Adding text to PDF: "${annotation.text}" at (${annotation.x}, ${annotation.y}) with font ${font}`);
    }
  }
  
  // Create document definition
  const docDefinition: any = {
    pageSize: {
      width: pageWidth,
      height: pageHeight
    },
    pageMargins: [0, 0, 0, 0],
    content: content.length > 0 ? content : [{ text: '' }], // At least one element required
    defaultStyle: {
      font: 'Sarabun'
    }
  };
  
  // Create PDF
  return new Promise((resolve, reject) => {
    try {
      const pdfDocGenerator = pdfMake.createPdf(docDefinition);
      pdfDocGenerator.getBuffer((buffer: any) => {
        resolve(new Uint8Array(buffer));
      });
    } catch (error) {
      console.error('Error creating PDF with pdfmake:', error);
      reject(error);
    }
  });
}

/**
 * Convert Fabric.js text objects to pdfmake annotations
 */
export function convertFabricToAnnotations(
  fabricObjects: any[],
  allPagesData: any[]
): TextAnnotation[] {
  const annotations: TextAnnotation[] = [];
  
  for (const obj of fabricObjects) {
    if (obj.type === 'i-text') {
      const textObj = obj as IText;
      const text = textObj.text || '';
      
      if (!text || text.length === 0) continue;
      
      // Find which page this text belongs to
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
      
      const pageData = allPagesData[targetPageIndex];
      if (!pageData) continue;
      
      annotations.push({
        text: text,
        x: textObj.left || 0,
        y: relativeY,
        fontSize: textObj.fontSize || 16,
        color: (textObj.fill as string) || '#000000',
        pageIndex: targetPageIndex,
        pageWidth: pageData.width,
        pageHeight: pageData.height
      });
    }
  }
  
  return annotations;
}