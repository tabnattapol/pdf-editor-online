# PDF Editor Online - Technical Specification

## Project Overview

Build a React-based web application for editing PDF documents with text annotation, page reordering, and save functionality. The application runs entirely in the browser without server-side dependencies.

## Core Features & Requirements

### 1. PDF Upload & Display
- **File Input**: Drag-and-drop interface + file browser button
- **File Validation**: Accept only PDF files, maximum 25MB
- **PDF Rendering**: Display PDF pages with zoom controls
- **Error Handling**: Graceful fallback for corrupted/unsupported files

### 2. Text Annotation
- **Click-to-Add**: Click anywhere on PDF to add text
- **Text Properties**: Font size, color, family selection
- **Text Editing**: Double-click to edit existing annotations
- **Position Accuracy**: Precise coordinate mapping (screen ↔ PDF)

### 3. Page Reordering
- **Thumbnail View**: Sidebar with draggable page thumbnails
- **Drag & Drop**: Visual feedback during reordering
- **Real-time Update**: Immediate reflection in main viewer
- **Page Numbers**: Dynamic page numbering after reorder

### 4. Save & Export
- **Download PDF**: Modified PDF with all changes applied
- **Filename Control**: User-specified output filename
- **Progress Indicator**: Loading state during save process
- **File Integrity**: Ensure output PDF opens correctly

## Technical Architecture

### Core Technology Stack
```
Frontend Framework: React 18+ with TypeScript
PDF Manipulation: pdf-lib (MIT license)
PDF Rendering: react-pdf + pdf.js
Styling: Tailwind CSS
State Management: React Context + useReducer
File Handling: HTML5 File API
```

### Project Structure
```
src/
├── components/
│   ├── PDFEditor/
│   │   ├── PDFEditor.tsx          # Main editor container
│   │   ├── PDFViewer.tsx          # PDF display component
│   │   ├── PageThumbnails.tsx     # Sidebar thumbnails
│   │   ├── TextAnnotator.tsx      # Text annotation tools
│   │   └── Toolbar.tsx            # Action buttons & controls
│   ├── UI/
│   │   ├── FileUpload.tsx         # Drag-drop file input
│   │   ├── ZoomControls.tsx       # Zoom in/out/fit
│   │   └── LoadingSpinner.tsx     # Loading states
│   └── shared/
│       ├── ErrorBoundary.tsx      # Error handling
│       └── ToastNotification.tsx  # User feedback
├── hooks/
│   ├── usePDFDocument.ts          # PDF loading & manipulation
│   ├── useTextAnnotations.ts      # Text annotation state
│   ├── usePageReorder.ts          # Page reordering logic
│   └── useUndoRedo.ts             # History management
├── utils/
│   ├── pdfCoordinates.ts          # Coordinate conversions
│   ├── fileValidation.ts          # File type/size checks
│   └── downloadHelper.ts          # File download utilities
├── types/
│   └── pdf.types.ts               # TypeScript definitions
└── App.tsx                        # Root component
```

## Implementation Plan

### Phase 1: Foundation Setup (Week 1)
**Goal**: Basic PDF upload and display functionality

**Tasks**:
1. Initialize React + TypeScript project with Vite
2. Install dependencies: pdf-lib, react-pdf, tailwindcss
3. Configure PDF.js worker path and CORS settings
4. Create basic file upload component with validation
5. Implement PDF viewer with single page display
6. Add zoom controls (fit-to-width, zoom in/out)

**Deliverable**: Working PDF viewer that can load and display files

### Phase 2: Text Annotation System (Week 2)
**Goal**: Add text annotation functionality

**Tasks**:
1. Implement coordinate system conversion (screen ↔ PDF)
2. Create click-to-add text interface
3. Build text properties panel (font, size, color)
4. Add text editing (double-click to modify)
5. Implement text annotation state management
6. Add visual indicators for annotation positions

**Deliverable**: Functional text annotation with property controls

### Phase 3: Page Management (Week 3)
**Goal**: Page reordering and thumbnail navigation

**Tasks**:
1. Create thumbnail sidebar with page previews
2. Implement drag-and-drop page reordering
3. Add page manipulation functions (copy, remove, duplicate)
4. Build page number management system
5. Create responsive layout for mobile/desktop
6. Add keyboard shortcuts for common actions

**Deliverable**: Complete page management interface

### Phase 4: Save & Performance (Week 4)
**Goal**: PDF export and optimization

**Tasks**:
1. Implement PDF save functionality with pdf-lib
2. Add file download with custom naming
3. Optimize performance for large documents
4. Implement page virtualization for 50+ page documents
5. Add progress indicators and loading states
6. Performance testing and memory optimization

**Deliverable**: Full-featured editor with save capability

### Phase 5: Polish & Testing (Week 5)
**Goal**: Production-ready application

**Tasks**:
1. Implement undo/redo functionality
2. Add comprehensive error handling
3. Create user onboarding and help tooltips
4. Cross-browser testing (Chrome, Firefox, Safari, Edge)
5. Mobile responsiveness optimization
6. Accessibility improvements (ARIA labels, keyboard navigation)

**Deliverable**: Production-ready PDF editor

## Technical Implementation Details

### State Management Structure
```typescript
interface PDFEditorState {
  document: PDFDocument | null;
  pages: PDFPage[];
  annotations: TextAnnotation[];
  currentPage: number;
  zoomLevel: number;
  isLoading: boolean;
  error: string | null;
}

interface TextAnnotation {
  id: string;
  pageIndex: number;
  x: number;
  y: number;
  text: string;
  fontSize: number;
  color: string;
  fontFamily: string;
}
```

### Core Functions Implementation
```typescript
// PDF Loading
const loadPDFDocument = async (file: File): Promise<PDFDocument> => {
  const arrayBuffer = await file.arrayBuffer();
  return await PDFDocument.load(arrayBuffer);
};

// Text Annotation
const addTextAnnotation = async (
  pdfDoc: PDFDocument,
  pageIndex: number,
  x: number,
  y: number,
  text: string,
  options: TextOptions
) => {
  const pages = pdfDoc.getPages();
  const page = pages[pageIndex];
  const font = await pdfDoc.embedFont(StandardFonts[options.fontFamily]);
  
  const { height } = page.getSize();
  page.drawText(text, {
    x,
    y: height - y, // Convert coordinates
    size: options.fontSize,
    font,
    color: rgb(...options.color)
  });
};

// Page Reordering
const reorderPages = async (
  pdfDoc: PDFDocument,
  fromIndex: number,
  toIndex: number
): Promise<PDFDocument> => {
  const newPdf = await PDFDocument.create();
  const pageIndices = Array.from({ length: pdfDoc.getPageCount() }, (_, i) => i);
  
  // Reorder indices
  const [movedPage] = pageIndices.splice(fromIndex, 1);
  pageIndices.splice(toIndex, 0, movedPage);
  
  // Copy pages in new order
  for (const index of pageIndices) {
    const [copiedPage] = await newPdf.copyPages(pdfDoc, [index]);
    newPdf.addPage(copiedPage);
  }
  
  return newPdf;
};

// PDF Export
const exportPDF = async (
  pdfDoc: PDFDocument,
  filename: string = 'edited-document.pdf'
) => {
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  
  URL.revokeObjectURL(url);
};
```

## Performance Optimization Strategy

### Memory Management
- **Page Virtualization**: Render only visible pages (5-10 at once)
- **Image Optimization**: Compress canvas rendering for thumbnails
- **Garbage Collection**: Properly dispose of canvas contexts and blob URLs
- **Memory Monitoring**: Track usage and warn before limits

### Loading Optimization
- **Progressive Loading**: Load first page immediately, others on demand
- **Worker Threads**: Offload PDF parsing to Web Workers
- **Caching Strategy**: Cache rendered pages for quick navigation
- **Lazy Components**: Split-load editing tools on first use

### Browser Compatibility
```typescript
// Feature Detection
const checkBrowserSupport = (): BrowserSupport => {
  return {
    fileAPI: 'File' in window,
    webWorkers: 'Worker' in window,
    canvas: 'HTMLCanvasElement' in window,
    dragDrop: 'draggable' in document.createElement('div'),
    downloadAPI: 'download' in document.createElement('a')
  };
};
```

## User Experience Specifications

### Interface Layout
- **Header**: Logo, file name, save button, undo/redo
- **Toolbar**: Text tool, select tool, zoom controls
- **Main Area**: PDF canvas with scroll/pan support
- **Sidebar**: Page thumbnails with drag handles
- **Properties Panel**: Text formatting options (collapsible)

### Interaction Flow
1. **File Upload**: Drag PDF → automatic load → first page display
2. **Text Addition**: Select text tool → click position → type text → auto-save to state
3. **Page Reorder**: Drag thumbnail → visual preview → drop to reorder
4. **Save**: Click save → processing indicator → download trigger

### Error Handling
- **File Errors**: "Invalid PDF file" with retry option
- **Size Limits**: "File too large (max 25MB)" with compression suggestion
- **Memory Issues**: "Document too complex" with page range suggestion
- **Browser Issues**: "Browser not supported" with alternative suggestions

## Dependencies & Installation

### Required Packages
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "pdf-lib": "^1.17.1",
    "react-pdf": "^7.7.1",
    "tailwindcss": "^3.4.0",
    "lucide-react": "^0.263.1"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "typescript": "^5.0.0",
    "vite": "^5.0.0"
  }
}
```

### Build Configuration
- **Vite Config**: Optimize for PDF.js worker files
- **TypeScript**: Strict mode enabled
- **Tailwind**: JIT compilation for smaller bundles
- **PDF.js Setup**: Configure worker path and CORS

## Testing Strategy

### Unit Testing
- PDF loading and parsing functions
- Coordinate conversion utilities
- Text annotation placement accuracy
- Page reordering logic

### Integration Testing
- Complete user workflows (upload → edit → save)
- Cross-browser compatibility
- Performance under different file sizes
- Error scenarios and recovery

### Performance Testing
- Memory usage with large files (10-25MB)
- Rendering speed for multi-page documents
- Mobile device performance
- Page virtualization effectiveness

## Security Considerations

### Client-Side Security
- **File Validation**: Strict PDF MIME type checking
- **Size Limits**: Hard 25MB browser limit
- **Memory Protection**: Monitoring to prevent crashes
- **XSS Prevention**: Sanitize user text input

### Privacy Compliance
- **Local Processing**: All PDF editing happens client-side
- **No Data Upload**: Files never leave user's browser
- **Memory Cleanup**: Clear PDF data when page unloads
- **Download Only**: No cloud storage or temporary files

## Deployment Requirements

### Build Output
- **Static Files**: HTML, CSS, JS bundles
- **PDF.js Workers**: Properly configured worker files
- **Asset Optimization**: Compressed images and fonts
- **Service Worker**: Optional for offline functionality

### Hosting Requirements
- **Static Hosting**: Netlify, Vercel, GitHub Pages compatible
- **HTTPS Required**: For File API and modern browser features
- **CORS Headers**: If serving PDF.js workers from CDN
- **Compression**: Gzip/Brotli for bundle size optimization

## Success Metrics & Acceptance Criteria

### Functional Requirements ✅
- [ ] Load PDF files up to 25MB successfully
- [ ] Add text annotations with accurate positioning
- [ ] Reorder pages through drag-and-drop interface
- [ ] Save modified PDF with all changes applied
- [ ] Support undo/redo for all operations

### Performance Requirements ✅
- [ ] Initial page load under 3 seconds
- [ ] PDF processing under 5 seconds for 10MB files
- [ ] Smooth scrolling with 60fps on desktop
- [ ] Memory usage under 500MB for 25MB PDFs
- [ ] Works on mobile devices (iOS Safari, Chrome Android)

### User Experience Requirements ✅
- [ ] Intuitive interface requiring no training
- [ ] Clear visual feedback for all operations
- [ ] Responsive design for mobile and desktop
- [ ] Accessible keyboard navigation
- [ ] Comprehensive error messages with recovery options

## Implementation Notes for Claude Code

### Setup Commands
```bash
# Initialize project
npm create vite@latest pdf-editor-online -- --template react-ts
cd pdf-editor-online

# Install dependencies
npm install pdf-lib react-pdf tailwindcss lucide-react
npm install -D @types/node autoprefixer postcss

# Configure Tailwind
npx tailwindcss init -p
```

### Key Implementation Priorities
1. **Start with PDF-lib integration** - Core functionality foundation
2. **Implement coordinate conversion early** - Critical for accurate text placement
3. **Build page virtualization from start** - Prevents performance issues later
4. **Add error boundaries everywhere** - PDF processing can fail unexpectedly
5. **Test with various PDF types** - Different creators produce different structures

### Performance Monitoring
```typescript
// Track memory usage
const monitorMemory = () => {
  if ('memory' in performance) {
    console.log('Used:', performance.memory.usedJSHeapSize / 1024 / 1024, 'MB');
    console.log('Total:', performance.memory.totalJSHeapSize / 1024 / 1024, 'MB');
  }
};

// Track rendering performance
const trackPageRender = (pageNum: number, startTime: number) => {
  const renderTime = performance.now() - startTime;
  console.log(`Page ${pageNum} rendered in ${renderTime.toFixed(2)}ms`);
};
```

### Development Workflow
1. **Implement core PDF loading first** - Foundation for all features
2. **Add text annotation next** - Most complex coordinate handling
3. **Build page reordering** - Simpler with established PDF handling
4. **Integrate save functionality** - Brings everything together
5. **Optimize and polish** - Performance and UX improvements

This specification provides Claude Code with clear direction for building a production-ready PDF editor while leveraging the researched technical insights and avoiding common implementation pitfalls.


ผมได้สร้าง Technical Specification ที่ครอบคลุมสำหรับ Claude Code แล้ว! 

**สรุปแผนการทำงาน 5 สัปดาห์:**

**สัปดาห์ที่ 1** - Foundation Setup: ตั้งค่าโปรเจกต์ React + TypeScript และ PDF viewer พื้นฐาน

**สัปดาห์ที่ 2** - Text Annotation: ระบบเพิ่มข้อความลงใน PDF พร้อมจัดการ coordinates

**สัปดาห์ที่ 3** - Page Management: สร้าง thumbnail sidebar และ drag-drop page reordering  

**สัปดาห์ที่ 4** - Save & Performance: ฟีเจอร์บันทึก PDF และ optimization สำหรับไฟล์ใหญ่

**สัปดาห์ที่ 5** - Polish & Testing: undo/redo, error handling, และ cross-browser testing

**จุดเด่นของ spec นี้:**
- ใช้ **PDF-lib** เป็นหลักสำหรับ manipulation (เดียวที่ทำได้ใน browser)
- **Performance-first approach** ด้วย page virtualization  
- **TypeScript** สำหรับ type safety
- **วิเคราะห์ limitation** ชัดเจน (25MB, coordinate conversion)
- **Security & Privacy** - ทุกอย่างทำ client-side

พร้อมเริ่มโปรเจกต์กับ Claude Code เลย! คุณต้องการให้ผมปรับแก้อะไรใน spec ไหม?