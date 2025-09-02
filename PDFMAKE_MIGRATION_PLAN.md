# แผนการเปลี่ยนจาก pdf-lib มาใช้ pdfmake

## 🎯 เป้าหมาย
แก้ปัญหาวรรณยุกต์ภาษาไทยที่แสดงผลไม่ถูกต้องใน PDF

## 📊 การเปรียบเทียบ

### pdf-lib (ปัจจุบัน)
```javascript
// ปัญหา: วรรณยุกต์เลื่อน, ไม่รองรับ complex text shaping
const pdfDoc = await PDFDocument.load(originalPdfBytes);
pdfDoc.registerFontkit(fontkit);
const thaiFont = await pdfDoc.embedFont(fontBytes);
page.drawText('เพิ่ม', { font: thaiFont }); // ❌ วรรณยุกต์เลื่อน
```

### pdfmake (แนวทางใหม่)
```javascript
// ข้อดี: รองรับภาษาไทยดีกว่า, มี Thai fonts พร้อมใช้
import pdfMake from 'pdfmake/build/pdfmake';
import { addThaiFonts } from 'addthaifont-pdfmake';

// เพิ่ม Thai fonts
addThaiFonts(pdfMake);

const docDefinition = {
  content: [
    { text: 'เพิ่ม', fontSize: 16 } // ✅ วรรณยุกต์ถูกต้อง
  ],
  defaultStyle: {
    font: 'Sarabun'
  }
};
```

## 🔧 สิ่งที่ต้องแก้ไข

### 1. Dependencies
```bash
# ลบ
- pdf-lib
- @pdf-lib/fontkit

# เพิ่ม
+ pdfmake
+ addthaifont-pdfmake
```

### 2. Function handleSave()
**เดิม:** ใช้ pdf-lib load original PDF และ drawText
**ใหม่:** สร้าง PDF ใหม่ด้วย pdfmake

### 3. Text Annotation Format
**เดิม:** เก็บ x, y, fontSize แยกกัน
**ใหม่:** เก็บเป็น pdfmake content object

### 4. Page Reordering
**ความท้าทาย:** pdfmake ไม่รองรับการ load existing PDF
**แนวทาง:** 
- Option A: ใช้ pdf-lib สำหรับ reorder, pdfmake สำหรับ text
- Option B: Export pages เป็น images แล้วใส่ใน pdfmake

## 📝 ขั้นตอนการ Migrate

### Phase 1: Setup (15 นาที)
1. ติดตั้ง pdfmake และ addthaifont-pdfmake
2. สร้าง utility function สำหรับ pdfmake

### Phase 2: Test Thai Font (30 นาที)
1. สร้าง POC ทดสอบ Thai text rendering
2. ทดสอบวรรณยุกต์ต่างๆ ('เพิ่ม', 'เริ่ม', 'เรื่อง')
3. เปรียบเทียบผลลัพธ์กับ pdf-lib

### Phase 3: Implement Save Function (45 นาที)
1. แปลง Fabric.js text objects เป็น pdfmake format
2. จัดการ positioning และ styling
3. Export PDF

### Phase 4: Handle Mixed Content (1 ชั่วโมง)
1. จัดการ existing PDF pages
2. Overlay text annotations
3. Maintain page order

## ⚠️ ข้อจำกัดที่อาจเจอ

1. **Existing PDF Loading**
   - pdfmake ไม่รองรับการ load PDF เดิม
   - ต้องใช้ hybrid approach

2. **Coordinate System**
   - pdfmake ใช้ระบบ layout-based
   - ต้องแปลง absolute positions

3. **Page Backgrounds**
   - ต้อง convert PDF pages เป็น images
   - อาจมี overhead ในการ processing

## 🎨 Hybrid Solution (แนะนำ)

```javascript
// 1. ใช้ pdf-lib สำหรับจัดการ PDF structure
const basePdf = await PDFDocument.load(originalPdfBytes);

// 2. ใช้ pdfmake สำหรับ render Thai text เป็น PDF
const textPdf = generateTextLayerWithPdfMake(annotations);

// 3. Merge PDFs together
const finalPdf = await mergePdfs(basePdf, textPdf);
```

## ✅ ผลที่คาดหวัง
- วรรณยุกต์แสดงผลถูกต้อง
- รองรับภาษาไทย 100%
- Performance ใกล้เคียงเดิม
- Code maintainability ดีขึ้น