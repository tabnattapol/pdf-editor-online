# Repository Guidelines

This guide aligns contributors on structure, tooling, and review expectations for this project. If something differs in your setup, propose updates in your PR.

## Project Structure & Module Organization
- `src/`: application code (e.g., `components/`, `lib/`, `routes/` or `pages/`, `styles/`).
- `public/`: static assets (icons, sample PDFs) served as-is.
- `server/` or `functions/`: backend/API handlers if applicable.
- `tests/`: unit/integration tests; `e2e/`: end-to-end tests.
- `scripts/`: dev/build utilities. `docs/`: additional documentation.

## Build, Test, and Development Commands
- `npm install`: install dependencies.
- `npm run dev`: start local dev server (hot reload).
- `npm run build`: create production build in `dist/` or `build/`.
- `npm run preview`: serve the built app locally.
- `npm test`: run unit tests; add `--watch` for local TDD.
- `npm run lint` / `npm run format`: lint and auto-format the codebase.

## Coding Style & Naming Conventions
- Indentation: 2 spaces; UTF-8 files; Unix line endings.
- Language: TypeScript preferred where available.
- Filenames: kebab-case (`pdf-viewer.ts`); React components: PascalCase (`PdfViewer.tsx`).
- Variables/functions: camelCase; constants: UPPER_SNAKE_CASE.
- Linting/formatting: ESLint + Prettier (respect repo configs if present).

## Testing Guidelines
- Framework: Jest/Vitest for unit tests; Playwright/Cypress for e2e.
- Location: `tests/` or `__tests__/`; name as `*.test.ts` or `*.spec.tsx`.
- Coverage: target ≥80% lines for touched areas; include edge cases (large PDFs, corrupted files).
- Run: `npm test` locally and ensure passing in CI before opening a PR.

## Commit & Pull Request Guidelines
- Commits: Conventional Commits (e.g., `feat: add text annotation tool`, `fix: handle corrupted PDF error`).
- PRs: clear description, linked issues, screenshots/GIFs for UI changes, and notes on performance/accessibility.
- Checklist: tests added/updated, `npm run lint` clean, no secrets in diff, docs updated if behavior changes.

## Security & Configuration Tips
- Secrets go in `.env` (never commit); provide `.env.example` with placeholders.
- Validate and size-limit uploaded files; sanitize filenames/paths.
- Serve with appropriate headers (CSP, `X-Content-Type-Options`); avoid eval and unsafe inline scripts.

---

# รายละเอียดการทำงานของ PDF Editor Online

เอกสารนี้สรุปสถาปัตยกรรม โฟลว์การทำงาน และโมดูลหลักของแอป PDF Editor Online ตามโค้ดในโฟลเดอร์ `src/` เพื่อช่วยให้ผู้พัฒนาทุกคนเข้าใจภาพรวมและต่อยอดได้อย่างถูกต้อง

## ภาพรวมสถาปัตยกรรม
- เฟรมเวิร์ก: React + TypeScript + Vite + Tailwind
- เรนเดอร์ PDF: `pdfjs-dist` (PDF.js) ใช้ worker สำหรับเรนเดอร์เพจสู่ `<canvas>`
- ส่งออก PDF: `pdf-lib` ใช้ฝังภาพ (JPEG/PNG) ต่อหน้า สร้าง PDF ใหม่แบบราสเตอร์ที่ “เผา” (burn-in) อนโนเทชันทับภาพเพจ
- UI Components: Radix UI primitives (Dialog, Slider, Tooltip, ToggleGroup) + ปุ่ม/สไตล์ใน `src/components/ui/*`
- การประมวลผลพิกัด: ยูทิลิตี้ใน `src/lib/pdf.ts` จัดการการแปลงพิกัด PDF-space ↔ view-space พร้อมรองรับการหมุนหน้าและซูม

## โครงสร้างสถานะหลัก (App.tsx)
- `loaded`: PDF ที่โหลดแล้ว `{ doc, pages }` โดย `pages: PdfPageInfo[]` เก็บขนาดหน้าและมุมหมุน (0/90/180/270)
- `pageIndex`, `zoom`: เพจปัจจุบันและอัตราขยาย
- `annotations: Annotation[]`: อนโนเทชัน 3 ประเภท `text | highlight | image` (ตำแหน่งวัดเป็นหน่วย PDF points, origin ที่มุมล่างซ้าย)
- เครื่องมือและตัวแปร UI: `tool` (select/highlight), `selectedId`, `editingId`, การลาก highlight (`drawingHL`), ตัวเลือกส่งออก (`exportScale`, `exportFormat`, `quality`)
- ประวัติ undo/redo: `useHistory` เก็บ snapshot ของ `{ pages, annotations, pageIndex }` รองรับ Cmd/Ctrl+Z และ Shift+Cmd/Ctrl+Z/Y

## โฟลว์หลักของผู้ใช้
1) อัปโหลด PDF
   - `onUpload(file)` ใช้ `pdfjs.getDocument({ data })` โหลดเอกสาร ดึงขนาดแต่ละหน้า สร้าง `pages: PdfPageInfo[]` แล้วเรนเดอร์หน้าแรก
2) เรนเดอร์เพจ
   - `renderPage()` เรียก `doc.getPage(n)` + `page.getViewport({ scale: zoom, rotation })` แล้ว `page.render({ canvasContext, viewport }).promise`
3) วางอนโนเทชัน
   - ตัวหนังสือ: `addText()` เพิ่ม annotation type `text` และเข้าสู่โหมดแก้ไขด้วย `contentEditable`
   - ไฮไลต์: โหมดเครื่องมือ `highlight` สร้างกรอบโดยลากบน overlay เก็บค่าพิกัดใน PDF-space แล้ววาดแบบ multiply blend
   - รูปภาพ: `onImageSelected(file)` แปลงเป็น DataURL เก็บใน `imageDataUrl`
   - ย้าย/ย่อ-ขยาย/หมุน ต่อ annotation ทำใน `AnnotationItem` ด้วย pointer events และแปลงเดลตาพิกัดผ่านยูทิลิตี้
4) จัดการเพจ
   - หมุนซ้าย/ขวา: อัปเดต `pages[i].rotation`
   - จัดเรียง/ลบ: `PageManager` ลากสลับตำแหน่งและ map `annotation.pageIndex` ให้ตรงกับลำดับใหม่ หรือกรอง/เลื่อน index เมื่อมีการลบเพจ
5) ส่งออก PDF (ราสเตอร์)
   - ต่อหน้า: เรนเดอร์เพจไปยัง `<canvas>` ด้วยสเกล `exportScale`
   - วาดอนโนเทชันทับ `<canvas>` (คำนวณพิกัดด้วย `annotationRectToView` และจัดการการหมุนเฉพาะอนโนเทชัน)
   - แปลง `<canvas>` เป็น JPEG/PNG ตามตัวเลือก/คุณภาพ แล้วฝังเป็นภาพลงหน้าใหม่ของ `pdf-lib`
   - บันทึก `edited.pdf` โดยสร้าง Blob และดาวน์โหลดผ่าน URL object

หมายเหตุ: โหมดส่งออกปัจจุบันเป็น “แบน” (flatten) ทำให้ข้อความใน PDF ที่ส่งออกเลือกคัดลอกไม่ได้ เหมาะกับงานแชร์/พิมพ์ หากต้องการคงข้อความเลือกได้ ต้องพัฒนาโหมด vector export เพิ่มเติม

## ยูทิลิตี้พิกัดและการหมุน (src/lib/pdf.ts)
- `getViewSize(page, zoom)`: คืนขนาด view คำนึงถึงการหมุน 90/270 ที่สลับแกนกว้าง-สูง
- `rectToView(x,y,w,h,page,zoom)`: แปลงกรอบจาก PDF-space (origin ล่างซ้าย) เป็น view-space (origin บนซ้าย) รองรับ rotation 0/90/180/270
- `annotationRectToView(a,page,zoom)`: shorthand แปลงกรอบของอนโนเทชัน
- `viewPointToPdf(vx,vy,page,zoom)`: พิกัดชี้/ลากจาก view-space → PDF-space
- `viewRectToPdf(...)`: แปลงกรอบจาก view-space → PDF-space สำหรับ use case อื่น
- `resizeDeltaForRotation(dx,dy,rotation,zoom)`: คำนวณเดลตาความกว้าง/สูงตามการหมุน เพื่อให้การ resize รู้ทิศทางที่ถูกต้อง

## ส่วนติดต่อผู้ใช้ (Sidebar.tsx)
- Document: อัปโหลด PDF
- Tools: สลับ Pointer/Highlight, เพิ่ม Text, เพิ่ม Image
- Inspector: ปรับคุณสมบัติอนโนเทชันที่เลือก (เช่นขนาดตัวอักษร/สี หรือสีของ highlight)
- View: ซูม, เปลี่ยนหน้า, หมุนหน้า, เปิดตัวจัดการหน้า (Page Manager)
- Export: เลือก Scale, Format (JPEG/PNG), Quality (เฉพาะ JPEG) แล้ว Export PDF

## องค์ประกอบสำคัญอื่น ๆ
- `AnnotationItem`: จัดการเลือก ย้าย ย่อ-ขยาย หมุน และโหมดแก้ไขข้อความ พร้อมแสดง handles และใช้ `mix-blend-mode: multiply` สำหรับ highlight
- `TextEditable`: ใช้ `contentEditable` รองรับ IME composition วางแคเร็ต และ commit เมื่อ blur
- `PageThumb` + `thumbCache`: แคชภาพย่อของแต่ละหน้า/มุมหมุนเพื่อประสิทธิภาพ
- คีย์ลัด: Delete/Backspace เพื่อลบ, Cmd/Ctrl+Z undo, Shift+Cmd/Ctrl+Z หรือ Ctrl+Y redo

## ข้อสังเกตด้านประสิทธิภาพ/คุณภาพ
- การเรนเดอร์และ export อ้างอิงสเกล: ค่าที่สูงขึ้นให้ความคมชัดดีขึ้น แต่ใช้หน่วยความจำ/เวลาเพิ่มขึ้น
- ไฮไลต์ใช้ blend แบบ multiply ช่วยคงคอนทราสต์ตัวอักษรด้านล่าง
- การส่งออกแบบราสเตอร์เหมาะกับการรวมเลเยอร์เร็วและรองรับอนโนเทชันภาพ/ข้อความ/สีอย่างสม่ำเสมอ

## แนวทางทดสอบการใช้งาน
1) `npm install` และ `npm run dev`
2) เปิดเบราว์เซอร์ → อัปโหลดไฟล์ทดสอบ (`testing.pdf`)
3) ลองเพิ่ม Text/Highlight/Image ย้าย/ย่อ-ขยาย/หมุน ตรวจสอบคีย์ลัด undo/redo
4) หมุนหน้า จัดเรียง/ลบหน้าใน Page Manager
5) Export ด้วยค่าต่าง ๆ (Scale 1x/2x, JPEG คุณภาพ 0.7/1.0, PNG) แล้วเปิดดูผลลัพธ์

## แนวคิดการต่อยอด (ถ้าต้องการ)
- Vector export: สร้างวัตถุ vector/text ใน `pdf-lib` แทน raster เพื่อคงข้อความ selectable
- Persist/Load: บันทึก/โหลดสถานะอนโนเทชันเป็น JSON แยกจาก PDF
- เครื่องมือเพิ่ม: เส้น/ลูกศร/สี่เหลี่ยม, eyedropper, multiple select
- Accessibility: ฟังก์ชันคีย์บอร์ดครบถ้วน, ARIA, โฟกัสจัดการดีกว่านี้
