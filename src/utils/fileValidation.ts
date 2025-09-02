export const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 25MB

export const validatePDFFile = (file: File): { valid: boolean; error?: string } => {
  if (!file) {
    return { valid: false, error: 'No file selected' };
  }

  if (file.type !== 'application/pdf') {
    return { valid: false, error: 'Please select a valid PDF file' };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit` };
  }

  return { valid: true };
};

export const checkBrowserSupport = () => {
  return {
    fileAPI: 'File' in window,
    webWorkers: 'Worker' in window,
    canvas: 'HTMLCanvasElement' in window,
    dragDrop: 'draggable' in document.createElement('div'),
    downloadAPI: 'download' in document.createElement('a')
  };
};