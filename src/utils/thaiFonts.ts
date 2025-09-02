// Thai fonts configuration for pdfmake
// Using base64 encoded fonts to avoid file loading issues

export const THSarabunBase64 = {
  normal: '', // Will be loaded from file
  bold: '',
  italics: '',
  bolditalics: ''
};

// Function to load font file and convert to base64
export async function loadFontAsBase64(fontPath: string): Promise<string> {
  try {
    const response = await fetch(fontPath);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        // Remove data URL prefix to get pure base64
        const base64Content = base64.split(',')[1];
        resolve(base64Content);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error loading font:', error);
    throw error;
  }
}

// Initialize Thai fonts for pdfmake
export async function initializeThaiFonts() {
  try {
    // Load Sarabun font (we already have it in public/fonts)
    THSarabunBase64.normal = await loadFontAsBase64('/fonts/Sarabun-Regular.ttf');
    
    // For now, use the same font for all styles
    // In production, you'd load different font weights
    THSarabunBase64.bold = THSarabunBase64.normal;
    THSarabunBase64.italics = THSarabunBase64.normal;
    THSarabunBase64.bolditalics = THSarabunBase64.normal;
    
    console.log('Thai fonts loaded successfully for pdfmake');
    return THSarabunBase64;
  } catch (error) {
    console.error('Failed to load Thai fonts:', error);
    throw error;
  }
}