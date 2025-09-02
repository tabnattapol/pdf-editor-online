/**
 * Convert text to image for proper Thai rendering
 * This is a workaround for pdf-lib's lack of Complex Text Layout support
 */
export async function textToImageDataUrl(
  text: string,
  fontSize: number = 16,
  color: string = '#000000',
  fontFamily: string = 'Sarabun, sans-serif'
): Promise<string> {
  // Create a canvas element
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  // Set font for measuring
  ctx.font = `${fontSize}px ${fontFamily}`;
  
  // Measure text dimensions
  const metrics = ctx.measureText(text);
  const width = Math.ceil(metrics.width) + 4; // Add some padding
  const height = Math.ceil(fontSize * 1.4); // Line height
  
  // Set canvas size
  canvas.width = width;
  canvas.height = height;
  
  // Clear canvas with transparent background
  ctx.clearRect(0, 0, width, height);
  
  // Set text properties
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  
  // Draw text
  ctx.fillText(text, 2, height / 2);
  
  // Convert to data URL
  return canvas.toDataURL('image/png');
}

/**
 * Convert data URL to Uint8Array for embedding in PDF
 */
export function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  // Remove the data:image/png;base64, prefix
  const base64 = dataUrl.split(',')[1];
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  return bytes;
}