import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Stage, Layer, Rect, Transformer, Group, Text } from 'react-konva'
import Konva from 'konva'
import type { Annotation, PdfPageInfo } from '@/types'
import { annotationRectToView, getViewSize, viewRectToPdf } from '@/lib/pdf'

type Props = {
  page: PdfPageInfo
  zoom: number
  annotations: Annotation[]
  setAnnotations: React.Dispatch<React.SetStateAction<Annotation[]>>
  selectedId: string | null
  setSelectedId: (id: string | null) => void
  tool: 'select' | 'highlight' | 'text'
  commit: () => void
  setTool: (t: 'select' | 'highlight' | 'text') => void
}

export default function KonvaHighlights({ page, zoom, annotations, setAnnotations, selectedId, setSelectedId, tool, commit, setTool }: Props) {
  const stageRef = useRef<Konva.Stage | null>(null)
  const layerRef = useRef<Konva.Layer | null>(null)
  const trRef = useRef<Konva.Transformer | null>(null)
  const [placing, setPlacing] = useState<{ id: string; x1: number; y1: number } | null>(null)
  const annRef = useRef<Annotation[]>(annotations)
  useEffect(() => { annRef.current = annotations }, [annotations])

  const viewSize = useMemo(() => getViewSize(page, zoom), [page, zoom])
  const highlights = useMemo(() => annotations.filter(a => a.pageIndex === page.index && a.type === 'highlight'), [annotations, page.index])
  const texts = useMemo(() => annotations.filter(a => a.pageIndex === page.index && a.type === 'text'), [annotations, page.index])

  // Attach transformer to selected node
  useEffect(() => {
    const tr = trRef.current
    const layer = layerRef.current
    if (!tr || !layer) return
    if (!selectedId) {
      tr.nodes([])
      layer.batchDraw()
      return
    }
    let node = layer.findOne(`#hl-${selectedId}`) as Konva.Rect | null
    if (!node) node = layer.findOne(`#tx-${selectedId}`) as any
    if (node) {
      tr.nodes([node])
      layer.batchDraw()
    } else {
      tr.nodes([])
      layer.batchDraw()
    }
  }, [selectedId, highlights.length, texts.length])

  const beginPlace = (x: number, y: number) => {
    if (tool !== 'highlight' && tool !== 'text') return
    const id = crypto.randomUUID()
    setPlacing({ id, x1: x, y1: y })
    commit()
    const rect0 = viewRectToPdf(x, y, 0, 0, page, zoom)
    if (tool === 'highlight') {
      setAnnotations(prev => ([...prev, { id, pageIndex: page.index, type: 'highlight', x: rect0.x, y: rect0.y, width: 0, height: 0, color: 'rgba(255,235,59,0.5)', rotation: 0 }]))
    } else {
      setAnnotations(prev => ([...prev, { id, pageIndex: page.index, type: 'text', x: rect0.x, y: rect0.y, width: 0, height: 0, text: '', fontSize: 18, color: '#111', rotation: 0 }]))
    }
    setSelectedId(id)
  }

  const updatePlace = (x: number, y: number) => {
    if (!placing) return
    const left = Math.min(placing.x1, x)
    const top = Math.min(placing.y1, y)
    const width = Math.abs(x - placing.x1)
    const height = Math.abs(y - placing.y1)
    const rect = viewRectToPdf(left, top, width, height, page, zoom)
    setAnnotations(prev => prev.map(a => a.id === placing.id ? { ...a, x: rect.x, y: rect.y, width: rect.w, height: rect.h } : a))
  }

  const endPlace = () => {
    if (!placing) return
    // enforce minimum
    setAnnotations(prev => prev.map(a => {
      if (a.id !== placing.id) return a
      if (a.type === 'highlight') {
        return { ...a, width: Math.max(a.width, 8 / zoom), height: Math.max(a.height, 8 / zoom) }
      }
      // text minimum in PDF units: 200x40
      return { ...a, width: Math.max(a.width, 200), height: Math.max(a.height, 40) }
    }))
    // auto-open editor for text after placement
    const placedId = placing.id
    setPlacing(null)
    if (tool === 'text') {
      setTimeout(() => {
        const a = annRef.current.find(x => x.id === placedId)
        if (a) openTextEditor(a)
      }, 0)
    }
    // auto switch back to select mode after placement
    setTool('select')
  }

  const onStageMouseDown = (e: any) => {
    const stage = e.target.getStage()
    if (!stage) return
    const clickedEmpty = e.target === stage
    if (!clickedEmpty) return
    // Clicked on empty area of stage
    if (tool === 'select') {
      setSelectedId(null)
      const tr = trRef.current
      if (tr) { tr.nodes([]); layerRef.current?.batchDraw() }
      return
    }
    if (tool === 'highlight' || tool === 'text') {
      const pos = stage.getPointerPosition()
      if (!pos) return
      beginPlace(pos.x, pos.y)
    }
  }

  const onStageMouseMove = (e: any) => {
    if (!placing) return
    const stage = e.target.getStage()
    if (!stage) return
    const pos = stage.getPointerPosition()
    if (!pos) return
    updatePlace(pos.x, pos.y)
  }

  const onStageMouseUp = () => { if (placing) endPlace() }

  const onRectDragMove = (node: Konva.Rect, a: Annotation) => {
    const left = node.x()
    const top = node.y()
    const rect = viewRectToPdf(left, top, node.width(), node.height(), page, zoom)
    setAnnotations(prev => prev.map(x => x.id === a.id ? { ...x, x: rect.x, y: rect.y } : x))
  }

  const onRectTransformEnd = (node: Konva.Rect, a: Annotation) => {
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    // reset scale into size
    node.scaleX(1)
    node.scaleY(1)
    const left = node.x()
    const top = node.y()
    const width = Math.max(8, node.width() * scaleX)
    const height = Math.max(8, node.height() * scaleY)
    const rect = viewRectToPdf(left, top, width, height, page, zoom)
    setAnnotations(prev => prev.map(x => x.id === a.id ? { ...x, x: rect.x, y: rect.y, width: rect.w, height: rect.h } : x))
  }

  const openTextEditor = (a: Annotation) => {
    const stage = stageRef.current
    const layer = layerRef.current
    if (!stage || !layer) return
    const node = layer.findOne(`#tx-${a.id}`) as Konva.Group | null
    if (!node) return
    const containerRect = stage.container().getBoundingClientRect()
    const abs = node.getAbsolutePosition()
    const box = annotationRectToView(a, page, zoom)
    const textarea = document.createElement('textarea')
    textarea.value = a.text || ''
    Object.assign(textarea.style, {
      position: 'absolute',
      top: `${containerRect.top + abs.y}px`,
      left: `${containerRect.left + abs.x}px`,
      width: `${box.width}px`,
      height: `${box.height}px`,
      fontSize: `${(a.fontSize || 16) * zoom}px`,
      fontFamily: 'sans-serif',
      lineHeight: '1.35',
      textAlign: 'center',
      border: '1px solid #3b82f6',
      outline: 'none',
      margin: '0',
      padding: '0',
      background: 'rgba(255,255,255,0.9)',
      zIndex: '1000',
      resize: 'none',
      overflow: 'hidden',
    } as CSSStyleDeclaration)
    document.body.appendChild(textarea)
    // iOS focus zoom guard
    const baseFont = (a.fontSize || 16) * zoom
    if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
      textarea.style.fontSize = `${Math.max(16, baseFont)}px`
    }
    // Hide node while editing
    node.visible(false)
    textarea.focus()
    const cleanup = () => {
      try { document.body.removeChild(textarea) } catch {}
      node.visible(true)
    }
    const commitText = () => {
      const val = textarea.value
      setAnnotations(prev => prev.map(x => x.id === a.id ? { ...x, text: val } : x))
      cleanup()
    }
    let composing = false
    const onKey = (e: KeyboardEvent) => {
      if (composing) return
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitText() }
      if (e.key === 'Escape') { e.preventDefault(); cleanup() }
    }
    const onBlur = () => commitText()
    const onCompStart = () => { composing = true }
    const onCompEnd = () => { composing = false }
    textarea.addEventListener('keydown', onKey)
    textarea.addEventListener('blur', onBlur, { once: true })
    textarea.addEventListener('compositionstart', onCompStart)
    textarea.addEventListener('compositionend', onCompEnd)
  }

  return (
    <Stage
      ref={stageRef as any}
      width={viewSize.width}
      height={viewSize.height}
      onMouseDown={onStageMouseDown}
      onMouseMove={onStageMouseMove}
      onMouseUp={onStageMouseUp}
      onTouchStart={onStageMouseDown}
      onTouchMove={onStageMouseMove}
      onTouchEnd={onStageMouseUp}
      listening
    >
      <Layer ref={layerRef as any}>
        {/* Render highlight rects */}
        {highlights.map((a) => {
          const box = annotationRectToView(a, page, zoom)
          return (
            <Rect
              key={a.id}
              id={`hl-${a.id}`}
              x={box.left}
              y={box.top}
              width={Math.max(1, box.width)}
              height={Math.max(1, box.height)}
              fill={(a.color as any) || 'rgba(255,235,59,0.5)'}
              opacity={0.9}
              globalCompositeOperation="multiply"
              draggable
              onMouseDown={(e) => { e.cancelBubble = true; setSelectedId(a.id) }}
              onTap={(e) => { e.cancelBubble = true; setSelectedId(a.id) }}
              onDragStart={() => commit()}
              onDragMove={(e) => onRectDragMove(e.target as Konva.Rect, a)}
              onDragEnd={(e) => onRectDragMove(e.target as Konva.Rect, a)}
              onTransformEnd={(e) => onRectTransformEnd(e.target as Konva.Rect, a)}
            />
          )
        })}
        {/* Render text nodes */}
        {texts.map((a) => {
          const box = annotationRectToView(a, page, zoom)
          const fontSize = (a.fontSize || 16) * zoom
          return (
            <Group
              key={a.id}
              id={`tx-${a.id}`}
              x={box.left}
              y={box.top}
              width={Math.max(1, box.width)}
              height={Math.max(1, box.height)}
              draggable
              onMouseDown={(e: any) => { e.cancelBubble = true; setSelectedId(a.id) }}
              onTap={(e: any) => { e.cancelBubble = true; setSelectedId(a.id) }}
              onDblClick={() => openTextEditor(a)}
              onDblTap={() => openTextEditor(a)}
              onDragStart={() => commit()}
              onDragMove={(e: any) => {
                const node = e.target as Konva.Group
                const rect = viewRectToPdf(node.x(), node.y(), node.width(), node.height(), page, zoom)
                setAnnotations(prev => prev.map(x => x.id === a.id ? { ...x, x: rect.x, y: rect.y } : x))
              }}
              onDragEnd={(e: any) => {
                const node = e.target as Konva.Group
                const rect = viewRectToPdf(node.x(), node.y(), node.width(), node.height(), page, zoom)
                setAnnotations(prev => prev.map(x => x.id === a.id ? { ...x, x: rect.x, y: rect.y } : x))
              }}
              onTransformEnd={(e: any) => {
                const node = e.target as Konva.Group
                const scaleX = node.scaleX(); const scaleY = node.scaleY();
                node.scaleX(1); node.scaleY(1)
                const w = Math.max(200, node.width() * scaleX)
                const h = Math.max(40, node.height() * scaleY)
                const rect = viewRectToPdf(node.x(), node.y(), w, h, page, zoom)
                setAnnotations(prev => prev.map(x => x.id === a.id ? { ...x, x: rect.x, y: rect.y, width: rect.w, height: rect.h } : x))
              }}
            >
              {/* hit area for pointer/drag (nearly invisible but pickable) */}
              <Rect
                x={0}
                y={0}
                width={Math.max(1, box.width)}
                height={Math.max(1, box.height)}
                fill="rgba(0,0,0,0.001)"
                strokeEnabled={false}
              />
              <Text
                x={0}
                y={0}
                width={Math.max(1, box.width)}
                text={a.text || ''}
                fontSize={fontSize}
                fill={a.color || '#111'}
                align="center"
                lineHeight={1.35}
                listening={false}
                wrap="word"
              />
            </Group>
          )
        })}
        <Transformer
          ref={trRef as any}
          rotationSnaps={[0, 90, 180, 270]}
          rotationSnapTolerance={20}
          boundBoxFunc={(oldBox, newBox) => {
            const min = 8
            if (Math.abs(newBox.width) < min || Math.abs(newBox.height) < min) return oldBox
            return newBox
          }}
        />
      </Layer>
    </Stage>
  )
}
