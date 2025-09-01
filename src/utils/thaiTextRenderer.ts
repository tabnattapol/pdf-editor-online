import * as opentype from 'opentype.js';
import { PDFPage, rgb } from 'pdf-lib';

interface TextRenderOptions {
  x: number;
  y: number;
  size: number;
  color: { r: number; g: number; b: number };
}

export class ThaiTextRenderer {
  private font: opentype.Font | null = null;
  private fontUrl: string;

  constructor(fontUrl: string = '/fonts/IBMPlexSansThai-Regular.ttf') {
    this.fontUrl = fontUrl;
  }

  async loadFont(): Promise<void> {
    try {
      const response = await fetch(this.fontUrl);
      const arrayBuffer = await response.arrayBuffer();
      this.font = opentype.parse(arrayBuffer);
      console.log('Thai font loaded successfully for path rendering');
    } catch (error) {
      console.error('Failed to load font for Thai text rendering:', error);
      throw error;
    }
  }

  /**
   * Renders Thai text as vector paths to avoid font embedding issues
   */
  renderTextAsPath(
    page: PDFPage,
    text: string,
    options: TextRenderOptions
  ): void {
    if (!this.font) {
      throw new Error('Font not loaded. Call loadFont() first.');
    }

    try {
      // Create a path from the text
      const path = this.font.getPath(text, options.x, options.y, options.size);
      
      // Convert OpenType.js path to PDF-lib drawing commands
      const commands = path.commands;
      
      // Start drawing the path
      page.pushOperators(
        ...this.convertToPageOperators(commands, options.color)
      );
      
      console.log(`Rendered Thai text as path: "${text}"`);
    } catch (error) {
      console.error('Failed to render Thai text as path:', error);
      throw error;
    }
  }

  /**
   * Convert OpenType.js path commands to PDF page operators
   */
  private convertToPageOperators(commands: any[], color: { r: number; g: number; b: number }): any[] {
    const operators: any[] = [];
    
    // Set color
    operators.push({
      type: 'SetRGBColor',
      color: rgb(color.r, color.g, color.b)
    });
    
    for (const cmd of commands) {
      switch (cmd.type) {
        case 'M': // Move to
          operators.push({
            type: 'MoveTo',
            x: cmd.x,
            y: cmd.y
          });
          break;
        case 'L': // Line to
          operators.push({
            type: 'LineTo',
            x: cmd.x,
            y: cmd.y
          });
          break;
        case 'C': // Cubic bezier curve
          operators.push({
            type: 'CurveTo',
            x1: cmd.x1,
            y1: cmd.y1,
            x2: cmd.x2,
            y2: cmd.y2,
            x3: cmd.x,
            y3: cmd.y
          });
          break;
        case 'Q': // Quadratic bezier curve
          operators.push({
            type: 'QuadraticCurveTo',
            x1: cmd.x1,
            y1: cmd.y1,
            x2: cmd.x,
            y2: cmd.y
          });
          break;
        case 'Z': // Close path
          operators.push({
            type: 'ClosePath'
          });
          operators.push({
            type: 'Fill'
          });
          break;
      }
    }
    
    return operators;
  }

  /**
   * Check if text contains Thai characters that need special rendering
   */
  static needsSpecialRendering(text: string): boolean {
    // Check for Thai characters with tone marks or complex vowels
    const hasThaiComplex = /[\u0E31-\u0E3A\u0E47-\u0E4E]/.test(text);
    const hasThai = /[\u0E00-\u0E7F]/.test(text);
    
    // Only use special rendering for Thai text with tone marks/vowels
    return hasThai && hasThaiComplex;
  }
}

/**
 * Alternative: Simple substitution for common problematic Thai combinations
 */
export function preprocessThaiText(text: string): string {
  // This is a workaround that replaces problematic combinations with precomposed characters
  // Note: This is not a complete solution but helps with some common cases
  
  const replacements: { [key: string]: string } = {
    // Add common problematic combinations here if they have precomposed forms
    'เ': 'เ', // Ensure proper encoding
    'แ': 'แ',
    'โ': 'โ',
    'ใ': 'ใ',
    'ไ': 'ไ',
  };
  
  let processed = text;
  for (const [search, replace] of Object.entries(replacements)) {
    processed = processed.replace(new RegExp(search, 'g'), replace);
  }
  
  // Normalize to NFC (Composed form)
  processed = processed.normalize('NFC');
  
  // Remove zero-width joiners and non-joiners that might cause issues
  processed = processed.replace(/[\u200C\u200D]/g, '');
  
  return processed;
}