# PDF Editor Online

A browser-based PDF editor with text annotations, page reordering, and Thai language support built with React and Fabric.js.

🔗 **Repository**: [https://github.com/tabnattapol/pdf-editor-online](https://github.com/tabnattapol/pdf-editor-online)

## Features

✨ **Core Features**
- 📄 PDF upload and display with continuous scrolling
- ✏️ Text annotations with customizable font, size, and color
- 🔄 Page reordering with drag-and-drop interface
- 🔍 Zoom controls (zoom in/out, fit to width)
- 💾 Export PDF with all annotations preserved
- 🇹🇭 Thai language support with proper font rendering

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **PDF Rendering**: PDF.js
- **Canvas Editing**: Fabric.js
- **PDF Manipulation**: pdf-lib
- **Styling**: Tailwind CSS
- **Build Tool**: Vite

## Installation

1. Clone the repository:
```bash
git clone https://github.com/tabnattapol/pdf-editor-online.git
cd pdf-editor-online
```

2. Install dependencies:
```bash
npm install
```

3. Run development server:
```bash
npm run dev
```

4. Open browser at `http://localhost:5173`

## Usage

1. **Upload PDF**: Click "Select PDF file" or drag and drop a PDF
2. **Add Text**: 
   - Click the "Add Text" button in the toolbar
   - Click anywhere on the PDF to place text
   - Double-click text to edit
3. **Reorder Pages**: 
   - Click "Reorder Pages" button
   - Drag and drop pages in the modal
   - Click "Apply Changes"
4. **Save PDF**: Click "Save PDF" to download with annotations

## Project Structure

```
src/
├── components/
│   ├── FabricPDFEditor/     # Main editor with Fabric.js
│   │   ├── FabricPDFEditor.tsx
│   │   ├── FabricToolbar.tsx
│   │   ├── FabricZoomControls.tsx
│   │   └── PageReorderModal.tsx
│   └── UI/                  # Reusable UI components
├── utils/                   # Helper functions
├── types/                   # TypeScript definitions
└── App.tsx                  # Root component
```

## Known Issues

- Thai text with tone marks (วรรณยุกต์) may have spacing issues due to pdf-lib limitations
- Large PDF files (>25MB) may cause performance issues

## Contributing

Pull requests are welcome! For major changes, please open an issue first.

## License

MIT

## Author

[@tabnattapol](https://github.com/tabnattapol)