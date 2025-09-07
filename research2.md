## ครบครันรวม Pattern และ Best Practice สำหรับ Konva.js Canvas Editor 

### **1. Stage/Layer Pattern - โครงสร้างพื้นฐานที่เหมาะสม**

สำหรับโครงสร้าง Stage + 3 Layers ที่แนะนำ:

```javascript
// React-Konva Setup
const CanvasEditor = () => {
  const [selectedNodes, setSelectedNodes] = useState([]);
  const stageRef = useRef();
  const backgroundLayerRef = useRef();
  const annotationsLayerRef = useRef();
  const uiLayerRef = useRef();

  return (
    <Stage 
      ref={stageRef}
      width={window.innerWidth} 
      height={window.innerHeight}
      onMouseDown={handleStageClick}
    >
      {/* Background Layer - ปิดการรับ event */}
      <Layer ref={backgroundLayerRef} listening={false}>
        <Rect 
          width={stage.width()} 
          height={stage.height()} 
          fill="white" 
        />
      </Layer>
      
      {/* Annotations Layer - เนื้อหาหลัก */}
      <Layer ref={annotationsLayerRef}>
        {shapes.map(shape => (
          <Rect 
            key={shape.id}
            {...shape}
            onClick={handleNodeClick}
          />
        ))}
      </Layer>
      
      {/* UI Layer - transformer, selection rectangle */}
      <Layer ref={uiLayerRef}>
        <Transformer ref={transformerRef} />
        {selectionRect.visible && <Rect {...selectionRect} />}
      </Layer>
    </Stage>
  );
};

// จุดสำคัญ: ใช้ e.cancelBubble เพื่อป้องกัน stage clear selection
const handleNodeClick = (e) => {
  console.log('Node clicked');
  e.cancelBubble = true; // หยุด event bubbling
  // Select logic here
};
```

**หมายเหตุสำคัญ**: การใช้ `listening: false` บน background layer จะช่วยเพิ่มประสิทธิภาพอย่างมาก เนื่องจาก Konva ไม่ต้องคำนวณ hit detection สำหรับ layer นั้น.[1][2]

### **2. Transformer Config - การจำกัดขนาดและหมุน**

```javascript
const transformer = new Konva.Transformer({
  nodes: selectedNodes,
  // จำกัดขนาดต่ำสุด
  boundBoxFunc: (oldBox, newBox) => {
    // ป้องกันขนาดต่ำสุด highlight ≥ 8x8, text ≥ 200x40
    const minWidth = newBox.width < 8 ? 8 : newBox.width;
    const minHeight = newBox.height < 8 ? 8 : newBox.height;
    
    return {
      ...newBox,
      width: minWidth,
      height: minHeight
    };
  },
  // Rotation snaps ที่ 0, 90, 180, 270 องศา
  rotationSnaps: [0, 90, 180, 270],
  rotationSnapTolerance: 30,
});

// วิธีการ reset scale หลัง transform (วิธีที่ถูกต้อง)
node.on('transformend', () => {
  const scaleX = node.scaleX();
  const scaleY = node.scaleY();
  
  // อัปเดต width/height และ reset scale
  node.width(node.width() * scaleX);
  node.height(node.height() * scaleY);
  node.scaleX(1);
  node.scaleY(1);
});
```

### **3. Selection Rectangle (Marquee) - การเลือกหลาย Node**

```javascript
const SelectionDemo = () => {
  const [selectionRect, setSelectionRect] = useState({
    visible: false, x1: 0, y1: 0, x2: 0, y2: 0
  });
  const [selectedIds, setSelectedIds] = useState([]);
  const isSelecting = useRef(false);

  const handleMouseDown = (e) => {
    // เริ่มเลือกเมื่อคลิกที่ stage เท่านั้น
    if (e.target !== e.target.getStage()) return;
    
    isSelecting.current = true;
    const pos = e.target.getStage().getPointerPosition();
    setSelectionRect({
      visible: true, x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y
    });
  };

  const handleMouseMove = (e) => {
    if (!isSelecting.current) return;
    
    const pos = e.target.getStage().getPointerPosition();
    setSelectionRect(prev => ({ ...prev, x2: pos.x, y2: pos.y }));
  };

  const handleMouseUp = () => {
    if (!isSelecting.current) return;
    
    isSelecting.current = false;
    
    // คำนวณ selection box
    const selBox = {
      x: Math.min(selectionRect.x1, selectionRect.x2),
      y: Math.min(selectionRect.y1, selectionRect.y2),
      width: Math.abs(selectionRect.x2 - selectionRect.x1),
      height: Math.abs(selectionRect.y2 - selectionRect.y1),
    };

    // หา nodes ที่ intersect กับ selection
    const selected = shapes.filter(shape => {
      return Konva.Util.haveIntersection(selBox, shape.getClientRect());
    });
    
    setSelectedIds(selected.map(s => s.id));
    setSelectionRect(prev => ({ ...prev, visible: false }));
  };

  return (
    <Stage onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
      {/* layers และ shapes */}
      {selectionRect.visible && (
        <Rect
          x={Math.min(selectionRect.x1, selectionRect.x2)}
          y={Math.min(selectionRect.y1, selectionRect.y2)}
          width={Math.abs(selectionRect.x2 - selectionRect.x1)}
          height={Math.abs(selectionRect.y2 - selectionRect.y1)}
          fill="rgba(0,0,255,0.5)"
        />
      )}
    </Stage>
  );
};
```

### **4. Text Editing Overlay - การแก้ไขข้อความ**

```javascript
const EditableText = ({ textNode, onSave, onCancel }) => {
  const [isEditing, setIsEditing] = useState(false);

  const handleTextDblClick = () => {
    setIsEditing(true);
    textNode.hide();
    
    // คำนวณตำแหน่ง textarea
    const textPosition = textNode.absolutePosition();
    const stageBox = textNode.getStage().container().getBoundingClientRect();
    
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    
    // sync styles กับ text node
    Object.assign(textarea.style, {
      position: 'absolute',
      top: `${stageBox.top + textPosition.y}px`,
      left: `${stageBox.left + textPosition.x}px`,
      width: `${textNode.width() - textNode.padding() * 2}px`,
      height: `${textNode.height() - textNode.padding() * 2 + 5}px`,
      fontSize: `${textNode.fontSize()}px`,
      fontFamily: textNode.fontFamily(),
      lineHeight: textNode.lineHeight().toString(),
      textAlign: textNode.align(),
      color: textNode.fill().toString(),
      border: 'none',
      padding: '0px',
      margin: '0px',
      background: 'none',
      outline: 'none',
      resize: 'none',
      overflow: 'hidden'
    });
    
    // จัดการ rotation
    const rotation = textNode.rotation();
    if (rotation) {
      textarea.style.transform = `rotateZ(${rotation}deg)`;
    }
    
    textarea.value = textNode.text();
    textarea.focus();
    
    // Event handlers
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        onSave(textarea.value);
        cleanup();
      }
      if (e.key === 'Escape') {
        onCancel();
        cleanup();
      }
    };
    
    const handleOutsideClick = (e) => {
      if (e.target !== textarea) {
        onSave(textarea.value);
        cleanup();
      }
    };
    
    const cleanup = () => {
      document.body.removeChild(textarea);
      window.removeEventListener('click', handleOutsideClick);
      textNode.show();
      setIsEditing(false);
    };
    
    textarea.addEventListener('keydown', handleKeyDown);
    setTimeout(() => {
      window.addEventListener('click', handleOutsideClick);
    });
  };

  return (
    <Text
      onDblClick={handleTextDblClick}
      onDblTap={handleTextDblClick} // สำหรับ mobile
      // ... other props
    />
  );
};
```

**หมายเหตุสำหรับ IME และ Mobile**: สำหรับการรองรับ IME (Input Method Editor) และ composition events บน mobile ควรเพิ่ม:[3][4]

```javascript
// เพิ่มการจัดการ composition events
textarea.addEventListener('compositionstart', (e) => {
  console.log('IME composition started');
});

textarea.addEventListener('compositionupdate', (e) => {
  console.log('IME composing:', e.data);
});

textarea.addEventListener('compositionend', (e) => {
  console.log('IME composition finished:', e.data);
});
```

### **5. Event Model ที่แนะนำ**

```javascript
// รวม mouse/touch events
const handlePointerEvent = (e) => {
  // ใช้ unified pointer events
  console.log('Pointer event:', e.type);
};

// การใช้งานที่แนะนำ
node.on('click tap', handlePointerEvent);          // สำหรับ click
node.on('mousedown touchstart', handlePointerEvent); // สำหรับ start drag
stage.on('mousedown touchstart', handleStagePointer);

// การใช้ cancelBubble อย่างถูกต้อง
const handleNodeClick = (e) => {
  console.log('Node selected');
  e.cancelBubble = true; // หยุด event จากไปถึง stage
};

// การใช้ preventDefault เท่าที่จำเป็น
stage.on('wheel', (e) => {
  e.evt.preventDefault(); // ป้องกัน browser scroll
  // zoom logic
});
```

### **6. Blend Mode สำหรับ Highlight**

```javascript
// การใช้ globalCompositeOperation multiply
const highlightRect = new Konva.Rect({
  x: 100, y: 100,
  width: 200, height: 100,
  fill: 'yellow',
  globalCompositeOperation: 'multiply', // รองรับในเบราว์เซอร์หลัก
  opacity: 0.5
});

// ตรวจสอบการรองรับ blend mode
function checkBlendModeSupport(mode) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.globalCompositeOperation = mode;
  return ctx.globalCompositeOperation === mode;
}

if (checkBlendModeSupport('multiply')) {
  // ใช้ multiply ได้
} else {
  // fallback เป็น opacity
}
```

**การรองรับเบราว์เซอร์**: `multiply` mode รองรับใน Chrome, Firefox, Safari และ Edge ทุกเวอร์ชันสมัยใหม่.[5][6]

### **7. Performance/Hits - การเพิ่มประสิทธิภาพ**

```javascript
// การจัดการ performance
const stage = new Konva.Stage({
  container: 'container',
  width: window.innerWidth,
  height: window.innerHeight,
});

// Background layer - ปิด listening
const backgroundLayer = new Konva.Layer({
  listening: false // ช่วยเพิ่มประสิทธิภาพมาก
});

// Main layer
const mainLayer = new Konva.Layer();

// สำหรับ shapes จำนวนมาก
shapes.forEach(shape => {
  shape.listening(false); // ปิดสำหรับ shapes ที่ไม่ต้องการ interaction
  shape.perfectDrawEnabled(false); // เพิ่ม performance
  shape.cache(); // cache complex shapes
});

// ใช้ batchDraw แทน draw เมื่อมีการเปลี่ยนแปลงหลาย node
const updateShapes = () => {
  // update multiple shapes
  layer.batchDraw(); // มีประสิทธิภาพกว่า layer.draw()
};

// ใช้ requestAnimationFrame สำหรับ animation
const animate = () => {
  // animation logic
  layer.batchDraw();
  requestAnimationFrame(animate);
};
```

### **8. Zoom/Rotation Strategy - การจัดการ Scale และพิกัด**

```javascript
// Pan/Zoom implementation
const handleWheel = (e) => {
  e.evt.preventDefault();
  
  const oldScale = stage.scaleX();
  const pointer = stage.getPointerPosition();
  
  const mousePointTo = {
    x: (pointer.x - stage.x()) / oldScale,
    y: (pointer.y - stage.y()) / oldScale,
  };
  
  const direction = e.evt.deltaY > 0 ? 0.9 : 1.1;
  const newScale = oldScale * direction;
  
  stage.scale({ x: newScale, y: newScale });
  
  const newPos = {
    x: pointer.x - mousePointTo.x * newScale,
    y: pointer.y - mousePointTo.y * newScale,
  };
  
  stage.position(newPos);
  stage.batchDraw();
};

// Pan with spacebar
let isPanning = false;
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    isPanning = true;
    stage.draggable(true);
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') {
    isPanning = false;
    stage.draggable(false);
  }
});

// การแปลงพิกัด
const getRelativePosition = (group) => {
  return group.getRelativePointerPosition();
};

// คำนวณ absolute position สำหรับ nested groups
const getAbsolutePosition = (node) => {
  return node.getAbsolutePosition();
};
```

### **คำแนะนำสำหรับการออกแบบ**

**การสร้างวัตถุ**:
- **Click-drag**: เหมาะสำหรับ editor มืออาชีพ ให้ผู้ใช้ควบคุมขนาดได้ตั้งแต่เริ่มต้น
- **Single-click**: เหมาะสำหรับการใช้งานเร็ว สร้าง default size แล้วให้ปรับขนาดทีหลัง

**หลังสร้างวัตถุ**:
- แนะนำให้ auto-switch กลับเป็น select mode เพื่อให้ผู้ใช้ปรับแต่งได้ทันที

**Multi-select + Group transform**:
- ใช้ Transformer กับหลาย nodes ได้ โดยส่ง array ของ nodes เข้าไป[7][8]

**Pan/Zoom**:
- **Spacebar + drag**: สำหรับ desktop editor
- **Middle-mouse**: alternative สำหรับ power user  
- **Touch**: pinch-to-zoom และ two-finger pan บน mobile[9][10]

**Minimum sizes**:
- **Highlight**: ≥ 8x8 pixels (เพื่อให้มองเห็นได้)
- **Text**: ≥ 200x40 pixels (เพื่อให้อ่านได้)

**การ Snap**:
- **rotationSnaps**:  เพียงพอสำหรับการใช้งานทั่วไป
- **Snap-to-grid**: เพิ่มได้ตามความต้องการ แต่ไม่จำเป็นสำหรับ MVP[11]

### **ข้อควรระวังที่พบบ่อย**

1. **iOS dbltap delay**: ใช้ `dblclick dbltap` events ร่วมกัน[3]
2. **Event bubbling**: ใช้ `e.cancelBubble = true` อย่างถูกต้อง[12][13]
3. **Transform scale reset**: อ่าน scaleX/Y ก่อน set scale(1,1) แล้วคูณกับ width/height[14][15]
4. **Hit detection performance**: ปิด `listening: false` สำหรับ shapes ที่ไม่ต้องการ interaction[2]
5. **Memory management**: ใช้ `node.destroy()` เมื่อลบ node และ `clearCache()` เมื่อจำเป็น[1]

การใช้ pattern เหล่านี้จะช่วยให้การพัฒนา Canvas Editor ด้วย Konva.js มีประสิทธิภาพและใช้งานได้ดี รวมถึงรองรับการใช้งานบนทั้ง desktop และ mobile device ได้อย่างเหมาะสม.

[1](https://konvajs.org/docs/performance/All_Performance_Tips.html)
[2](https://konvajs.org/docs/performance/Listening_False.html)
[3](https://konvajs.org/docs/sandbox/Editable_Text.html)
[4](https://stackoverflow.com/questions/79654401/how-to-customize-the-compositionevent-ui-in-javascript-for-ime-keyboard-logic-on)
[5](https://www.w3schools.com/jsref/canvas_globalcompositeoperation.asp)
[6](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation)
[7](https://konvajs.org/docs/select_and_transform/Basic_demo.html)
[8](https://konvajs.org/docs/sandbox/Zooming_Relative_To_Pointer.html)
[9](https://stackoverflow.com/questions/50379477/konva-stage-centered-on-pinch-zoom)
[10](https://konvajs.org/docs/sandbox/Multi-touch_Scale_Stage.html)
[11](https://konvajs.org/docs/select_and_transform/Rotation_Snaps.html)
[12](https://konvajs.org/docs/events/Cancel_Propagation.html)
[13](https://github.com/konvajs/konva/issues/123)
[14](https://stackoverflow.com/questions/68932900/how-to-reset-a-rectangles-x-y-width-height-after-transform)
[15](https://konvajs.org/docs/select_and_transform/Ignore_Stroke_On_Transform.html)
[16](https://konvajs.org/api/Konva.Stage.html)
[17](https://konvajs.org/api/Konva.Layer.html)
[18](https://konvajs.org/docs/select_and_transform/Resize_Limits.html)
[19](https://konvajs.org/docs/sandbox/Resizing_Stress_Test.html)
[20](https://konvajs.org/docs/groups_and_layers/Layering.html)
[21](https://stackoverflow.com/questions/66165303/konva-haveintersection-js)
[22](https://konvajs.org/docs/data_and_serialization/Best_Practices.html)
[23](https://stackoverflow.com/questions/62574011/using-konva-how-can-i-select-and-transform-images)
[24](https://stackoverflow.com/questions/66477403/not-scaled-interaction-layer-on-konva-canvas)
[25](https://konvajs.org/api/Konva.Transformer.html)
[26](https://konvajs.org/docs/sandbox/Collision_Detection.html)
[27](https://dev.to/eliancodes/using-konvajs-as-canvas-with-react-212e)
[28](https://konvajs.org/docs/react/Transformer.html)
[29](https://konvajs.org/api/Konva.Container.html)
[30](https://konvajs.org/docs/react/index.html)
[31](http://konvajs-doc.bluehymn.com/api/Konva.Transformer.html)
[32](https://stackoverflow.com/questions/49591866/konvajs-positioning-editable-text-inputs)
[33](https://stackoverflow.com/questions/26123588/test-if-browser-supports-multiply-for-globalcompositeoperation-canvas-property)
[34](https://github.com/konvajs/react-konva/issues/155)
[35](https://www.rekim.com/2011/02/11/html5-canvas-globalcompositeoperation-browser-handling/)
[36](https://konvajs.org/api/Konva.Text.html)
[37](https://konvajs.org/docs/styling/Blend_Mode.html)
[38](https://stackoverflow.com/questions/77874802/handling-dblclick-event-in-konva)
[39](https://stackoverflow.com/questions/1164213/how-to-stop-event-bubbling-on-checkbox-click)
[40](https://codesandbox.io/s/react-konva-editable-resizable-text-forked-l0miwz)
[41](https://konvajs.org/docs/events/Pointer_Events.html)
[42](https://javascript.plainenglish.io/creating-an-editable-resizable-text-label-in-konva-with-react-8ab3a6b11dfb)
[43](https://developer.mozilla.org/en-US/docs/Web/API/Event/cancelBubble)
[44](https://konvajs.org/docs/sandbox/Transparent_Group.html)
[45](https://konvajs.org/docs/events/Binding_Events.html)
[46](https://stackoverflow.com/questions/76399229/how-to-detect-onclick-event-using-konva-shape)
[47](https://konvajs.org/docs/sandbox/Relative_Pointer_Position.html)
[48](https://konvajs.org/docs/sandbox/Limited_Drag_And_Resize.html)
[49](https://konvajs.org/api/Konva.FastLayer.html)
[50](https://konvajs.org/docs/performance/Shape_Caching.html)
[51](https://konvajs.org/api/Konva.Group.html)
[52](https://github.com/konvajs/react-konva/issues/341)
[53](https://konvajs.org/api/Konva.Node.html)
[54](https://stackoverflow.com/questions/54389826/konva-scale-down-group)
[55](https://github.com/konvajs/konva/issues/429)
[56](https://stackoverflow.com/questions/55703336/resizing-and-rotating-a-line-with-the-same-anchor-in-konva-js)
[57](https://stackoverflow.com/questions/57581451/custom-hit-detection-on-konva-group)
[58](https://stackoverflow.com/questions/74997653/konva-with-stage-draggable-passing-mouse-events-to-layers)
[59](https://konvajs.org/docs/events/Multi_Event.html)
[60](https://github.com/konvajs/konva/issues/778)
[61](https://www.youtube.com/watch?v=sRzxP-ssB0s)
[62](https://konvajs.org/docs/drag_and_drop/Drag_a_Stage.html)
[63](https://konvajs.org/docs/data_and_serialization/Complex_Load.html)
[64](https://blog.logrocket.com/canvas-manipulation-react-konva/)
[65](https://konvajs.org/docs/react/Drag_And_Drop.html)
[66](https://issues.chromium.org/40487465)