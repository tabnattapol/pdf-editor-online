# Alternative Approaches for PDF Editor

## Current Issues
1. Font size mismatch between UI and exported PDF
2. Coordinate system conversion problems  
3. Text positioning issues when zooming

## Recommended Solution: Fabric.js Overlay

### Implementation Plan

```javascript
// 1. Install dependencies
npm install fabric pdf.js

// 2. Create FabricPDFEditor component
import { fabric } from 'fabric';
import * as pdfjsLib from 'pdfjs-dist';

const FabricPDFEditor = () => {
  const [canvas, setCanvas] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  
  useEffect(() => {
    // Initialize Fabric canvas
    const fabricCanvas = new fabric.Canvas('pdf-editor', {
      preserveObjectStacking: true,
      selection: true
    });
    
    setCanvas(fabricCanvas);
  }, []);
  
  const loadPDF = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    const page = await pdf.getPage(1);
    
    const viewport = page.getViewport({ scale: 1 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;
    
    // Set as Fabric background
    fabric.Image.fromURL(canvas.toDataURL(), (img) => {
      fabricCanvas.setBackgroundImage(img, fabricCanvas.renderAll.bind(fabricCanvas));
      fabricCanvas.setDimensions({
        width: viewport.width,
        height: viewport.height
      });
    });
  };
  
  const addText = (x, y) => {
    const text = new fabric.IText('Click to edit', {
      left: x,
      top: y,
      fontSize: 16,
      fontFamily: 'Helvetica',
      fill: '#000000'
    });
    
    canvas.add(text);
    canvas.setActiveObject(text);
    text.enterEditing();
  };
  
  const exportPDF = async () => {
    // Get all Fabric objects
    const objects = canvas.getObjects();
    
    // Load original PDF
    const newPdf = await PDFDocument.load(originalPdfBytes);
    const pages = newPdf.getPages();
    const page = pages[0];
    
    // Add each text annotation
    for (const obj of objects) {
      if (obj.type === 'i-text') {
        page.drawText(obj.text, {
          x: obj.left,
          y: page.getHeight() - obj.top - obj.fontSize,
          size: obj.fontSize,
          color: rgb(0, 0, 0)
        });
      }
    }
    
    return await newPdf.save();
  };
};
```

## Why This Works Better

### 1. **No Coordinate Conversion Issues**
- Fabric.js handles all coordinates in canvas space
- Direct mapping to PDF coordinates (both use points)
- No pixel-to-point conversion needed

### 2. **Consistent Font Rendering**
- Fabric.js renders text the same way PDF does
- WYSIWYG - What you see is exactly what you get
- Font size in Fabric = Font size in PDF

### 3. **Built-in Features**
- Text editing with cursor
- Drag and drop
- Rotation and scaling
- Undo/redo support
- Copy/paste

### 4. **Better Performance**
- Single canvas layer
- Hardware acceleration
- Efficient redrawing

## Migration Steps

1. **Phase 1: Setup Fabric.js**
   - Install fabric package
   - Create new FabricPDFViewer component
   - Test basic PDF loading

2. **Phase 2: Implement Text Annotations**
   - Add text tool
   - Implement inline editing
   - Handle font properties

3. **Phase 3: Export Functionality**
   - Convert Fabric objects to PDF annotations
   - Maintain original PDF structure
   - Test with various PDFs

4. **Phase 4: Additional Features**
   - Multi-page support
   - Shape annotations
   - Highlighting
   - Form fields

## Alternative: Use PDF.js Annotation Layer Directly

```javascript
// Use PDF.js built-in annotation support
const renderAnnotations = async (page, container) => {
  const annotations = await page.getAnnotations();
  
  // Create annotation layer
  const annotationLayer = document.createElement('div');
  annotationLayer.className = 'annotationLayer';
  container.appendChild(annotationLayer);
  
  // Add custom annotations
  const textAnnotation = {
    type: 'FreeText',
    rect: [100, 100, 200, 150],
    contents: 'Custom text',
    color: [0, 0, 0]
  };
  
  pdfjsLib.AnnotationLayer.render({
    annotations: [...annotations, textAnnotation],
    div: annotationLayer,
    page: page,
    viewport: viewport
  });
};
```

## Comparison Table

| Feature | Current (pdf-lib) | Fabric.js | PDF.js Annotations | PSPDFKit |
|---------|------------------|-----------|-------------------|----------|
| Text positioning | ❌ Issues | ✅ Perfect | ✅ Good | ✅ Perfect |
| Font rendering | ❌ Mismatch | ✅ WYSIWYG | ✅ Good | ✅ Perfect |
| Performance | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Ease of implementation | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Cost | Free | Free | Free | $3000/year |
| Mobile support | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

## Recommendation

For immediate improvement with minimal changes:
1. **Short term**: Fix current coordinate system using proper DPI calculations
2. **Medium term**: Migrate to Fabric.js overlay approach
3. **Long term**: Consider PSPDFKit for enterprise features

## Resources

- [Fabric.js Documentation](http://fabricjs.com/)
- [PDF.js Annotation Examples](https://github.com/mozilla/pdf.js/tree/master/examples)
- [React + Fabric.js Tutorial](https://github.com/fabricjs/fabric.js/tree/master/react)
- [PSPDFKit React Guide](https://pspdfkit.com/guides/web/react/)