export interface PDFEditorState {
  document: any | null;
  pages: any[];
  annotations: TextAnnotation[];
  currentPage: number;
  zoomLevel: number;
  isLoading: boolean;
  error: string | null;
}

export interface TextAnnotation {
  id: string;
  pageIndex: number;
  x: number;
  y: number;
  text: string;
  fontSize: number;
  color: string;
  fontFamily: string;
  // Store PDF coordinates for accurate positioning
  pdfX?: number;
  pdfY?: number;
  pageWidth?: number;
  pageHeight?: number;
}

export interface TextOptions {
  fontSize: number;
  color: string;
  fontFamily: string;
}

export interface BrowserSupport {
  fileAPI: boolean;
  webWorkers: boolean;
  canvas: boolean;
  dragDrop: boolean;
  downloadAPI: boolean;
}