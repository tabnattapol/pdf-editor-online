# แผนงาน (plan.md)

## ภาพรวม
เว็บแก้ไข PDF แบบฝั่งหน้าเว็บ (Vite + React + TS + Tailwind + shadcn) ใช้ pdf.js แสดงผล และ export แบบ raster ด้วย pdf-lib ให้ผลลัพธ์เหมือนหน้าจอ

## สิ่งที่ทำแล้ว
- โครงสร้างโปรเจกต์: Vite + React + TypeScript + Tailwind ตั้งค่าเสร็จ
- ตั้งค่า pdf.js worker ให้ทำงานกับ Vite ได้
- อัปโหลดและแสดงผล PDF ด้วย pdf.js, รองรับซูม
- Overlay annotations (พิกัดหน่วย PDF): เพิ่ม Text (ไทย/อังกฤษ), Highlight, Image
- การลากย้าย annotation: รองรับการลาก (drag) ตาม zoom/rotation
- Resize annotation: รองรับมุมล่างขวาเมื่อหน้าไม่ถูกหมุน (rotation = 0)
- หมุนหน้า PDF ครั้งละ 90° และเรนเดอร์/overlay ตรงตาม rotation
- จัดการหน้า (Modal ด้วย shadcn Dialog): แสดง thumbnail, Drag & Drop สลับหน้า, ลบหน้า
- Export PDF แบบ raster (WYSIWYG) รวมหน้า PDF ที่เรนเดอร์ + annotations + คง rotation
- ปุ่ม UI หลักใช้ shadcn-style Button

## สิ่งที่ยังไม่ได้ทำ
- Resize annotations เมื่อหน้าอยู่ที่ rotation 90/180/270° และการหมุนวัตถุ (per-annotation rotation)
- แก้ไขข้อความ inline (double‑click เพื่อแก้), ตัวเลือกฟอนต์/ขนาด/สี และจัดแนว
- เครื่องมือจัดการวัตถุ: duplicate, delete, layer order, multi-select
- คุณภาพ export: ปรับ DPI/คุณภาพ/ไฟล์ภาพ (JPEG/PNG), แสดง progress
- ประสิทธิภาพ: cache thumbnails, virtualization รายการหน้าใหญ่, limit canvas scale
- Undo/Redo, คีย์ลัด (⌘Z/⌘Y/⌫), mobile gestures (pinch/drag)
- การทดสอบ: unit (แปลงพิกัด/การจัดหน้า), e2e (เพิ่ม/ย้าย/หมุน/ลบ/ส่งออก)
- ข้อผิดพลาด/ความปลอดภัย: ตรวจขนาดไฟล์, แจ้งเตือนไฟล์เสีย, ป้องกัน freeze
- CI/CD และคำแนะนำ deploy (Netlify/Vercel), ตัวอย่าง `.env.example` หากต้องใช้

## ลำดับถัดไปที่แนะนำ
1) เปิดใช้งาน resize สำหรับทุก rotation และ inline text editing
2) เพิ่ม Undo/Redo และปรับคุณภาพ export (DPI toggle)
3) Optimize thumbnails + virtualization และเพิ่มชุดทดสอบพื้นฐาน
