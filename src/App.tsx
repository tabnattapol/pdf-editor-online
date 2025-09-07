import { Sidebar } from '@/components/Sidebar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import * as pdfjs from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url'
import { useEffect, useMemo, useRef, useState } from 'react'
import { annotationRectToView, getViewSize, viewPointToPdf, viewRectToPdf } from './lib/pdf'
import { cn } from './lib/utils'
import type { Annotation, PdfPageInfo } from './types'

// Configure pdf.js worker
// Provide URL string to worker script for bundlers
pdfjs.GlobalWorkerOptions.workerSrc = workerSrc as unknown as string

type LoadedPdf = {
  doc: any
  pages: PdfPageInfo[]
}

export default function App() {
  const [loaded, setLoaded] = useState<LoadedPdf | null>(null)
  const [pageIndex, setPageIndex] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const [showManager, setShowManager] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [tool, setTool] = useState<'select' | 'highlight' | 'text'>('select')
  const [drawingHL, setDrawingHL] = useState<{ id: string; startPdfX: number; startPdfY: number } | null>(null)
  const [drawingText, setDrawingText] = useState<{ id: string; startPdfX: number; startPdfY: number } | null>(null)
  const [exportScale, setExportScale] = useState(2)
  const [exportFormat, setExportFormat] = useState<'jpeg' | 'png'>('jpeg')
  const [quality, setQuality] = useState(1)
  const historyRef = useRef<{ past: StateSnap[]; future: StateSnap[] }>({ past: [], future: [] })
  const { commit, undo, redo } = useHistory(loaded, annotations, pageIndex, historyRef)

  const currentPage = useMemo(() => loaded?.pages[pageIndex], [loaded, pageIndex])

  useEffect(() => {
    if (!loaded || !currentPage) return
    void renderPage()
  }, [loaded, currentPage, zoom])

  // Keyboard shortcuts: delete/backspace, undo/redo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const inEditable = !!target && (target.isContentEditable || /^(input|textarea|select)$/i.test(target.tagName))
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && !editingId && !inEditable) {
        setAnnotations((prev) => prev.filter((x) => x.id !== selectedId))
      }
      const isMac = navigator.platform.toUpperCase().includes('MAC')
      const mod = isMac ? e.metaKey : e.ctrlKey
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        const snap = undo()
        if (snap) {
          setLoaded((prev) => (prev ? { ...prev, pages: snap.pages } : prev))
          setAnnotations(snap.annotations)
          setPageIndex(snap.pageIndex)
        }
      } else if ((mod && e.key.toLowerCase() === 'y') || (mod && e.shiftKey && e.key.toLowerCase() === 'z')) {
        e.preventDefault()
        const snap = redo()
        if (snap) {
          setLoaded((prev) => (prev ? { ...prev, pages: snap.pages } : prev))
          setAnnotations(snap.annotations)
          setPageIndex(snap.pageIndex)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId])

  async function renderPage() {
    if (!loaded || !currentPage || !canvasRef.current) return
    const page = await loaded.doc.getPage(currentPage.index + 1)
    const viewport = page.getViewport({ scale: zoom, rotation: currentPage.rotation || 0 })
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')!
    canvas.width = viewport.width
    canvas.height = viewport.height
    await page.render({ canvasContext: ctx, viewport }).promise
  }

  async function onUpload(file: File) {
    const arrayBuffer = await file.arrayBuffer()
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer })
    const doc = await loadingTask.promise
    const pages: PdfPageInfo[] = []
    for (let i = 1; i <= doc.numPages; i++) {
      const p = await doc.getPage(i)
      const vp = p.getViewport({ scale: 1 })
      pages.push({ index: i - 1, width: vp.width, height: vp.height, rotation: 0 })
    }
    setLoaded({ doc, pages })
    setPageIndex(0)
    setZoom(1)
    setAnnotations([])
    historyRef.current = { past: [], future: [] }
  }

  function addText() {
    // Changed behavior: switch to text placement mode
    setTool('text')
  }

  function addHighlight() {
    if (!currentPage) return
    const id = crypto.randomUUID()
    setAnnotations((prev) => [
      ...prev,
      { id, pageIndex, type: 'highlight', x: 40, y: currentPage.height - 160, width: 240, height: 24, color: 'rgba(255,235,59,0.5)', rotation: 0 },
    ])
  }

  function onImageSelected(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      if (!currentPage) return
      const id = crypto.randomUUID()
      setAnnotations((prev) => [
        ...prev,
        { id, pageIndex, type: 'image', x: 40, y: currentPage.height - 300, width: 200, height: 150, imageDataUrl: reader.result as string, rotation: 0 },
      ])
    }
    reader.readAsDataURL(file)
  }

  // kept for backward compatibility; replaced with rotatePageLeft/Right in sidebar
  function rotatePage() {
    rotatePageRight()
  }

  function rotatePageRight() {
    commit()
    setLoaded((prev) => {
      if (!prev) return prev
      const pages = prev.pages.map((p, i) => (
        i === pageIndex ? { ...p, rotation: ((p.rotation + 90) % 360) } : p
      ))
      return { ...prev, pages }
    })
  }

  function rotatePageLeft() {
    commit()
    setLoaded((prev) => {
      if (!prev) return prev
      const pages = prev.pages.map((p, i) => (
        i === pageIndex ? { ...p, rotation: ((p.rotation + 270) % 360) } : p
      ))
      return { ...prev, pages }
    })
  }

  async function exportRasterPdf() {
    if (!loaded) return
    const { PDFDocument } = await import('pdf-lib')
    const out = await PDFDocument.create()
    for (const p of loaded.pages) {
      const page = await loaded.doc.getPage(p.index + 1)
      const scale = exportScale // raster DPI factor
      const viewport = page.getViewport({ scale, rotation: p.rotation || 0 })
      const c = document.createElement('canvas')
      c.width = viewport.width
      c.height = viewport.height
      const ctx = c.getContext('2d')!
      await page.render({ canvasContext: ctx, viewport }).promise

      // Draw annotations onto the canvas
      const pageAnnos = annotations.filter(a => a.pageIndex === p.index)
      for (const a of pageAnnos) {
        if (a.type === 'highlight') {
          // Draw using rotation-aware rect mapping and blend to preserve underlying text contrast
          const r = annotationRectToView(a, p, scale)
          ctx.save()
          ctx.globalCompositeOperation = 'multiply'
          ctx.fillStyle = a.color || 'rgba(255,235,59,0.5)'
          ctx.fillRect(r.left, r.top, r.width, r.height)
          ctx.restore()
        } else if (a.type === 'text') {
          // Draw text with annotation rotation around its box center
          const r = annotationRectToView(a, p, scale)
          ctx.save()
          ctx.translate(r.left + r.width / 2, r.top + r.height / 2)
          const rad = ((a.rotation || 0) * Math.PI) / 180
          ctx.rotate(rad)
          ctx.fillStyle = a.color || '#111'
          ctx.font = `${(a.fontSize || 16) * scale}px sans-serif`
          ctx.textBaseline = 'middle'
          ctx.textAlign = 'center'
          ctx.fillText(a.text || '', 0, 0)
          ctx.restore()
        } else if (a.type === 'image' && a.imageDataUrl) {
          const r = annotationRectToView(a, p, scale)
          const img = await loadImage(a.imageDataUrl)
          ctx.save()
          ctx.translate(r.left + r.width / 2, r.top + r.height / 2)
          const rad = ((a.rotation || 0) * Math.PI) / 180
          ctx.rotate(rad)
          ctx.drawImage(img, -r.width / 2, -r.height / 2, r.width, r.height)
          ctx.restore()
        }
      }

      const dataUrl = exportFormat === 'jpeg' ? c.toDataURL('image/jpeg', quality) : c.toDataURL('image/png')
      const bytes = await fetch(dataUrl).then(r => r.arrayBuffer())
      const img = exportFormat === 'jpeg' ? await out.embedJpg(bytes) : await out.embedPng(bytes)
      // Use viewport-derived sizes to guarantee exact aspect ratio
      const pageWidth = viewport.width / scale
      const pageHeight = viewport.height / scale
      const pg = out.addPage([pageWidth, pageHeight])
      pg.drawImage(img, { x: 0, y: 0, width: pageWidth, height: pageHeight })
    }
    const pdfBytes = await out.save()
    const blob = new Blob([pdfBytes], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'edited.pdf'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="h-full flex">
      <Sidebar
        tool={tool}
        setTool={setTool}
        zoom={zoom}
        setZoom={(n) => setZoom(n)}
        pageIndex={pageIndex}
        totalPages={loaded?.pages.length ?? 0}
        setPageIndex={(n) => setPageIndex(n)}
        onUploadPdf={(file) => onUpload(file)}
        onAddText={addText}
        onAddHighlight={addHighlight}
        onAddImage={(file) => onImageSelected(file)}
        rotateLeft={rotatePageLeft}
        rotateRight={rotatePageRight}
        openManager={() => setShowManager(true)}
        onExport={exportRasterPdf}
        exportScale={exportScale}
        setExportScale={setExportScale}
        exportFormat={exportFormat}
        setExportFormat={setExportFormat}
        quality={quality}
        setQuality={setQuality}
        selected={selectedId ? annotations.find(x => x.id === selectedId) : undefined}
        updateSelected={(next) => setAnnotations((prev) => prev.map(x => x.id === selectedId ? { ...x, ...next } : x))}
      />
      <main className="flex-1 overflow-auto p-4">
        <div className="relative" style={currentPage ? getViewSize(currentPage, zoom) : undefined}>
          <canvas ref={canvasRef} className="block shadow" />
          {/* overlay */}
          {currentPage && (
            <div
              ref={overlayRef}
              className="absolute top-0 left-0"
              style={getViewSize(currentPage, zoom)}
              onMouseDown={(e) => {
                if (!currentPage) return
                const el = overlayRef.current!
                const rect = el.getBoundingClientRect()
                const vx = e.clientX - rect.left
                const vy = e.clientY - rect.top
                const isBackground = e.currentTarget === e.target
                if (tool === 'highlight' && isBackground) {
                  e.stopPropagation()
                  const start = viewPointToPdf(vx, vy, currentPage, zoom)
                  const id = crypto.randomUUID()
                  setDrawingHL({ id, startPdfX: start.x, startPdfY: start.y })
                  setAnnotations((prev) => ([...prev, { id, pageIndex, type: 'highlight', x: start.x, y: start.y, width: 0, height: 0, color: 'rgba(255,235,59,0.5)', rotation: 0 }]))
                  setSelectedId(id)
                  setEditingId(null)
                } else if (tool === 'text' && isBackground) {
                  e.stopPropagation()
                  const start = viewPointToPdf(vx, vy, currentPage, zoom)
                  const id = crypto.randomUUID()
                  setDrawingText({ id, startPdfX: start.x, startPdfY: start.y })
                  setAnnotations((prev) => ([...prev, { id, pageIndex, type: 'text', x: start.x, y: start.y, width: 0, height: 0, text: '', fontSize: 18, color: '#111', rotation: 0 }]))
                  setSelectedId(id)
                  setEditingId(null)
                } else if (isBackground) {
                  // move/type: clicking pure background deselects
                  setSelectedId(null)
                  setEditingId(null)
                }
              }}
              onMouseMove={(e) => {
                const el = overlayRef.current!
                const rect = el.getBoundingClientRect()
                const vx = e.clientX - rect.left
                const vy = e.clientY - rect.top
                if (drawingHL && currentPage && tool === 'highlight') {
                  const cur = viewPointToPdf(vx, vy, currentPage, zoom)
                  const x = Math.min(drawingHL.startPdfX, cur.x)
                  const y = Math.min(drawingHL.startPdfY, cur.y)
                  const w = Math.abs(cur.x - drawingHL.startPdfX)
                  const h = Math.abs(cur.y - drawingHL.startPdfY)
                  setAnnotations((prev) => prev.map(a => a.id === drawingHL.id ? { ...a, x, y, width: w, height: h } : a))
                }
                if (drawingText && currentPage && tool === 'text') {
                  const cur = viewPointToPdf(vx, vy, currentPage, zoom)
                  const x = Math.min(drawingText.startPdfX, cur.x)
                  const y = Math.min(drawingText.startPdfY, cur.y)
                  const w = Math.abs(cur.x - drawingText.startPdfX)
                  const h = Math.abs(cur.y - drawingText.startPdfY)
                  setAnnotations((prev) => prev.map(a => a.id === drawingText.id ? { ...a, x, y, width: w, height: h } : a))
                }
              }}
              onMouseUp={() => {
                if (tool === 'highlight' && drawingHL) {
                  // ensure minimal size
                  setAnnotations((prev) => prev.map(a => {
                    if (a.id !== drawingHL.id) return a
                    const w = Math.max(8, a.width)
                    const h = Math.max(8, a.height)
                    return { ...a, width: w, height: h }
                  }))
                  setDrawingHL(null)
                }
                if (tool === 'text' && drawingText) {
                  setAnnotations((prev) => prev.map(a => {
                    if (a.id !== drawingText.id) return a
                    let { x, y, width: w, height: h } = a
                    const minW = 200
                    const minH = 40
                    if (w < minW) {
                      // expand to the right
                      w = minW
                    }
                    if (h < minH) {
                      h = minH
                    }
                    return { ...a, x, y, width: w, height: h }
                  }))
                  setDrawingText(null)
                }
              }}
            >
              {annotations.filter(a => a.pageIndex === pageIndex).map((a) => (
                <AnnotationItem
                  key={a.id}
                  a={a}
                  page={currentPage}
                  zoom={zoom}
                  selected={selectedId === a.id}
                  editing={false}
                  onSelect={() => {
                    setSelectedId(a.id)
                    setEditingId(null)
                  }}
                  onEdit={() => {}}
                  onEndEdit={() => {}}
                  onChange={(next) => { commit(); setAnnotations((prev) => prev.map(x => x.id === a.id ? { ...x, ...next } : x)) }}
                  onDuplicate={() => setAnnotations((prev) => {
                    commit()
                    const copy = { ...a, id: crypto.randomUUID(), x: a.x + 10, y: a.y + 10 }
                    const idx = prev.findIndex(x => x.id === a.id)
                    const arr = [...prev]
                    arr.splice(idx + 1, 0, copy)
                    return arr
                  })}
                  onDelete={() => { commit(); setAnnotations((prev) => prev.filter(x => x.id !== a.id)) }}
                  onZ={(dir) => setAnnotations((prev) => {
                    commit()
                    const idx = prev.findIndex(x => x.id === a.id)
                    if (idx === -1) return prev
                    const arr = [...prev]
                    const [item] = arr.splice(idx, 1)
                    const ni = dir === 'front' ? arr.length : 0
                    arr.splice(ni, 0, item)
                    return arr
                  })}
                />
              ))}
            </div>
          )}
        </div>
      </main>
      {loaded && (
        <Dialog open={showManager} onOpenChange={setShowManager}>
          <DialogContent className="max-w-5xl">
            <DialogHeader>
              <DialogTitle>Manage Pages</DialogTitle>
              <div />
            </DialogHeader>
            <ManagePagesModal
              loaded={loaded}
              currentIndex={pageIndex}
              onClose={() => setShowManager(false)}
              onApply={(nextPages, ops) => {
                if (!nextPages) { setShowManager(false); return }
                commit()
                setLoaded((prev) => {
                  if (!prev) return prev
                  const applied = applyReorderAndDeletes(prev, annotations, setAnnotations, nextPages)
                  setPageIndex((pi) => Math.max(0, Math.min(applied.pages.length - 1, pi)))
                  return { ...prev, pages: applied.pages }
                })
                setShowManager(false)
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

type StateSnap = { pages: PdfPageInfo[]; annotations: Annotation[]; pageIndex: number }

function cloneSnap(loaded: LoadedPdf | null, annotations: Annotation[], pageIndex: number): StateSnap | null {
  if (!loaded) return null
  return {
    pages: loaded.pages.map((p) => ({ ...p })),
    annotations: annotations.map((a) => ({ ...a })),
    pageIndex,
  }
}

function ExportControls({ onExport, exportScale, setExportScale, exportFormat, setExportFormat, quality, setQuality }:
  { onExport: () => void; exportScale: number; setExportScale: (n: number) => void; exportFormat: 'jpeg'|'png'; setExportFormat: (f: 'jpeg'|'png') => void; quality: number; setQuality: (q: number) => void }) {
  return (
    <div className="ml-auto flex items-center gap-2">
      <label className="text-sm">Scale
        <select className="ml-1 border rounded px-1 py-0.5" value={exportScale} onChange={(e) => setExportScale(Number(e.target.value))}>
          <option value={1}>1x</option>
          <option value={2}>2x</option>
          <option value={3}>3x</option>
        </select>
      </label>
      <label className="text-sm">Format
        <select className="ml-1 border rounded px-1 py-0.5" value={exportFormat} onChange={(e) => setExportFormat(e.target.value as any)}>
          <option value="jpeg">JPEG</option>
          <option value="png">PNG</option>
        </select>
      </label>
      {exportFormat === 'jpeg' && (
        <label className="text-sm">Quality
          <input type="number" min={0.1} max={1} step={0.1} className="ml-1 w-16 border rounded px-1 py-0.5" value={quality} onChange={(e) => setQuality(Number(e.target.value))} />
        </label>
      )}
      <Button onClick={onExport}>Export PDF</Button>
    </div>
  )
}

function useHistory(loaded: LoadedPdf | null, annotations: Annotation[], pageIndex: number, historyRef: React.MutableRefObject<{ past: StateSnap[]; future: StateSnap[] }>) {
  const commit = () => {
    const snap = cloneSnap(loaded, annotations, pageIndex)
    if (!snap) return
    historyRef.current.past.push(snap)
    historyRef.current.future = []
  }
  const undo = () => {
    const prev = historyRef.current.past.pop()
    if (!prev) return null
    historyRef.current.future.push({ pages: loaded?.pages ?? [], annotations, pageIndex })
    return prev
  }
  const redo = () => {
    const next = historyRef.current.future.pop()
    if (!next) return null
    historyRef.current.past.push({ pages: loaded?.pages ?? [], annotations, pageIndex })
    return next
  }
  return { commit, undo, redo }
}

function reorderPages(
  prev: LoadedPdf,
  annotations: Annotation[],
  setAnnotations: React.Dispatch<React.SetStateAction<Annotation[]>>,
  from: number,
  to: number,
): LoadedPdf {
  const pages = [...prev.pages]
  const [moved] = pages.splice(from, 1)
  pages.splice(to, 0, moved)
  const map = new Map(pages.map((p, idx) => [p.index, idx]))
  setAnnotations((as) => as.map((a) => ({
    ...a,
    pageIndex: map.get(prev.pages[a.pageIndex].index)!,
  })))
  return { ...prev, pages }
}

function deletePage(
  prev: LoadedPdf,
  annotations: Annotation[],
  setAnnotations: React.Dispatch<React.SetStateAction<Annotation[]>>,
  idx: number,
  setPageIndex: React.Dispatch<React.SetStateAction<number>>,
): LoadedPdf {
  const pages = prev.pages.filter((_, i) => i !== idx)
  const map = new Map(pages.map((p, i) => [p.index, i]))
  setAnnotations((as) => as
    .filter((a) => a.pageIndex !== idx)
    .map((a) => ({ ...a, pageIndex: map.get(prev.pages[a.pageIndex].index)! })))
  setPageIndex((pi) => Math.max(0, Math.min(pages.length - 1, pi > idx ? pi - 1 : pi)))
  return { ...prev, pages }
}

// Apply staged order and deletions to loaded pages and annotations
function applyReorderAndDeletes(
  prev: LoadedPdf,
  annotations: Annotation[],
  setAnnotations: React.Dispatch<React.SetStateAction<Annotation[]>>,
  stagedPages: PdfPageInfo[],
): { pages: PdfPageInfo[] } {
  const pages = stagedPages
  // map original immutable page index -> new position
  const map = new Map(pages.map((p, i) => [p.index, i]))
  setAnnotations((as) => as
    .map((a) => {
      const origIdx = prev.pages[a.pageIndex]?.index
      if (origIdx === undefined) return a
      const ni = map.get(origIdx)
      if (ni === undefined) return { ...a, pageIndex: -1 } as Annotation // mark for filter
      return { ...a, pageIndex: ni }
    })
    .filter((a) => a.pageIndex !== -1))
  return { pages }
}

function ManagePagesModal(props: {
  loaded: LoadedPdf
  currentIndex: number
  onClose: () => void
  onApply: (nextPages: PdfPageInfo[] | null, ops: string[]) => void
}) {
  const { loaded, currentIndex, onClose, onApply } = props
  const [order, setOrder] = useState<PdfPageInfo[]>(() => loaded.pages.map((p) => ({ ...p })))
  const [ops, setOps] = useState<string[]>([])
  const [dragFrom, setDragFrom] = useState<number | null>(null)

  const changed = useMemo(() => {
    if (order.length !== loaded.pages.length) return true
    for (let i = 0; i < order.length; i++) {
      if (order[i].index !== loaded.pages[i].index) return true
      if ((order[i].rotation || 0) !== (loaded.pages[i].rotation || 0)) return true
    }
    return false
  }, [order, loaded.pages])

  const move = (from: number, to: number) => {
    setOrder((arr) => {
      const next = [...arr]
      const [m] = next.splice(from, 1)
      next.splice(to, 0, m)
      return next
    })
    setOps((o) => [
      `Move ${from + 1} → ${to + 1}`,
      ...o,
    ])
  }

  const removeAt = (idx: number) => {
    const removed = order[idx]
    setOrder((arr) => arr.filter((_, i) => i !== idx))
    setOps((o) => [
      `Delete ${idx + 1} (orig #${removed.index + 1})`,
      ...o,
    ])
  }

  const reset = () => {
    setOrder(loaded.pages.map((p) => ({ ...p })))
    setOps([])
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {changed ? (
          <div className="px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-800 border border-yellow-200">Unsaved changes</div>
        ) : (
          <div className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-600 border">No changes</div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" onClick={reset} disabled={!changed}>Reset</Button>
          <Button variant="outline" onClick={() => onApply(null, ops)}>Cancel</Button>
          <Button onClick={() => onApply(order, ops)} disabled={!changed}>Apply changes</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-[60vh] overflow-auto p-1">
        {order.map((p, i) => (
          <div
            key={`${p.index}-${i}`}
            className={`relative border rounded p-2 bg-gray-50 ${i === currentIndex ? 'ring-2 ring-blue-500' : ''}`}
            draggable
            onDragStart={(e) => { setDragFrom(i); e.dataTransfer.effectAllowed = 'move' }}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
            onDrop={(e) => { e.preventDefault(); if (dragFrom !== null && dragFrom !== i) move(dragFrom, i); setDragFrom(null) }}
          >
            <div className="absolute top-1 left-1 px-1.5 py-0.5 text-[11px] rounded bg-white/90 border">{i + 1}</div>
            <div className="absolute top-1 right-1">
              <button
                className="px-1.5 py-0.5 text-xs border rounded bg-white hover:bg-gray-50"
                onClick={(e) => { e.stopPropagation(); removeAt(i) }}
              >Delete</button>
            </div>
            <PageThumb doc={loaded.doc} pageNumber={p.index + 1} rotation={p.rotation || 0} onClick={() => { /* preview jump on click is omitted in staging */ }} />
            <div className="mt-2 flex items-center justify-between text-xs text-gray-600">
              <span>Orig #{p.index + 1}</span>
              <span className="px-2 py-0.5 border rounded bg-white">Drag to reorder</span>
            </div>
          </div>
        ))}
      </div>

      <div className="border rounded p-2 bg-gray-50 max-h-32 overflow-auto">
        <div className="text-xs font-medium mb-1">History</div>
        {ops.length === 0 ? (
          <div className="text-xs text-gray-500">No operations</div>
        ) : (
          <ul className="text-xs space-y-0.5">
            {ops.map((t, i) => (<li key={i}>• {t}</li>))}
          </ul>
        )}
      </div>
    </div>
  )
}

function PageManager(props: {
  loaded: LoadedPdf
  currentIndex: number
  setCurrentIndex: (n: number) => void
  onClose: () => void
  onReorder: (from: number, to: number) => void
  onDelete: (idx: number) => void
}) {
  const { loaded, currentIndex, setCurrentIndex, onClose, onReorder, onDelete } = props
  const dragFrom = useRef<number | null>(null)
  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center p-4">
      <div className="bg-white rounded shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
        <div className="p-3 border-b flex items-center justify-between">
          <div className="font-medium">Manage Pages</div>
          <button className="px-2 py-1 border rounded" onClick={onClose}>Close</button>
        </div>
        <div className="p-4 overflow-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {loaded.pages.map((p, i) => (
            <div
              key={p.index}
              className={`border rounded p-2 bg-gray-50 ${i === currentIndex ? 'ring-2 ring-blue-500' : ''}`}
              draggable
              onDragStart={(e) => { dragFrom.current = i; e.dataTransfer.effectAllowed = 'move' }}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
              onDrop={(e) => { e.preventDefault(); if (dragFrom.current !== null && dragFrom.current !== i) onReorder(dragFrom.current, i); dragFrom.current = null }}
            >
              <PageThumb doc={loaded.doc} pageNumber={p.index + 1} rotation={p.rotation || 0} onClick={() => setCurrentIndex(i)} />
              <div className="mt-2 flex items-center justify-between text-sm">
                <span>Page {i + 1}</span>
                <button className="px-2 py-0.5 border rounded" onClick={() => onDelete(i)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function PageThumb({ doc, pageNumber, rotation, onClick }: { doc: any; pageNumber: number; rotation: number; onClick: () => void }) {
  const ref = useRef<HTMLCanvasElement | null>(null)
  const key = `${pageNumber}-${rotation}`
  useEffect(() => {
    let mounted = true
    ;(async () => {
      const page = await doc.getPage(pageNumber)
      const viewport = page.getViewport({ scale: 0.2, rotation })
      if (!mounted) return
      const c = ref.current
      if (!c) return
      c.width = viewport.width
      c.height = viewport.height
      const ctx = c.getContext('2d')!
      const cached = thumbCache.get(key)
      if (cached) {
        const img = await loadImage(cached)
        ctx.drawImage(img, 0, 0)
      } else {
        await page.render({ canvasContext: ctx, viewport }).promise
        const url = c.toDataURL('image/jpeg', 0.7)
        thumbCache.set(key, url)
      }
    })()
    return () => { mounted = false }
  }, [doc, pageNumber, rotation])
  return <canvas ref={ref} className="cursor-pointer bg-white" onClick={onClick} />
}

const thumbCache = new Map<string, string>()

function AnnotationItem({ a, page, zoom, selected, editing, onSelect, onEdit, onEndEdit, onChange, onDuplicate, onDelete, onZ }: {
  a: Annotation
  page: PdfPageInfo
  zoom: number
  selected: boolean
  editing: boolean
  onSelect: () => void
  onEdit: () => void
  onEndEdit: () => void
  onChange: (next: Partial<Annotation>) => void
  onDuplicate: () => void
  onDelete: () => void
  onZ: (dir: 'front' | 'back') => void
}) {
  const box = annotationRectToView(a, page, zoom)
  const ref = useRef<HTMLDivElement | null>(null)
  const [localText, setLocalText] = useState(a.text || '')
  useEffect(() => { if (!editing) setLocalText(a.text || '') }, [editing, a.text])

  // drag/move/resize unified (corners/edges => resize, otherwise move)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement
      const isHandle = !!target.closest('.resize-br,.resize-tr,.resize-tl,.resize-bl,.resize-r,.resize-l,.resize-t,.resize-b')
      const inEditable = !!target.closest('[contenteditable="true"], .select-text')

      // Decide interaction by proximity if not explicit handle
      const box = annotationRectToView(a, page, zoom)
      const rect = (el as HTMLElement).getBoundingClientRect()
      const vx = e.clientX - rect.left
      const vy = e.clientY - rect.top
      const pad = 10 // px threshold
      const nearL = vx <= pad
      const nearR = vx >= box.width - pad
      const nearT = vy <= pad
      const nearB = vy >= box.height - pad
      let kind: 'r'|'l'|'t'|'b'|'tr'|'tl'|'br'|'bl' | null = null
      if (isHandle || (nearL || nearR || nearT || nearB)) {
        if ((nearR && nearB) || target.classList.contains('resize-br')) kind = 'br'
        else if ((nearR && nearT) || target.classList.contains('resize-tr')) kind = 'tr'
        else if ((nearL && nearT) || target.classList.contains('resize-tl')) kind = 'tl'
        else if ((nearL && nearB) || target.classList.contains('resize-bl')) kind = 'bl'
        else if (nearR || target.classList.contains('resize-r')) kind = 'r'
        else if (nearL || target.classList.contains('resize-l')) kind = 'l'
        else if (nearT || target.classList.contains('resize-t')) kind = 't'
        else if (nearB || target.classList.contains('resize-b')) kind = 'b'
      }

      // While editing text, do not start move from inside text area (still allow resize if kind)
      if (editing && !kind) return

      // For text annotations, only allow drag when using explicit drag handles or edges/corners.
      if (a.type === 'text' && !isHandle && !kind) return

      // Only prevent default when we actually start a drag/resize interaction.
      el.setPointerCapture(e.pointerId)

      if (kind) {
        // Start resize in view space
        const start = { x: e.clientX, y: e.clientY }
        const startBox = annotationRectToView(a, page, zoom)
        const pageView = getViewSize(page, zoom)
        const min = 8 * zoom
        const onMove = (ev: PointerEvent) => {
          let dx = ev.clientX - start.x
          let dy = ev.clientY - start.y
          if (kind === 'r' || kind === 'l') dy = 0
          if (kind === 't' || kind === 'b') dx = 0
          let left = startBox.left
          let top = startBox.top
          let width = startBox.width
          let height = startBox.height
          if (kind.includes('r')) width = Math.max(min, Math.min(pageView.width - left, startBox.width + dx))
          if (kind.includes('l')) { const nl = Math.min(startBox.left + startBox.width - min, Math.max(0, startBox.left + dx)); width = Math.max(min, startBox.width - (nl - startBox.left)); left = nl }
          if (kind.includes('b')) height = Math.max(min, Math.min(pageView.height - top, startBox.height + dy))
          if (kind.includes('t')) { const nt = Math.min(startBox.top + startBox.height - min, Math.max(0, startBox.top + dy)); height = Math.max(min, startBox.height - (nt - startBox.top)); top = nt }
          const rect = viewRectToPdf(left, top, width, height, page, zoom)
          onChange({ x: rect.x, y: rect.y, width: rect.w, height: rect.h })
        }
        const onUp = (ev: PointerEvent) => {
          el.releasePointerCapture(ev.pointerId)
          window.removeEventListener('pointermove', onMove)
          window.removeEventListener('pointerup', onUp)
        }
        e.preventDefault()
        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', onUp)
        return
      }

      // Otherwise start move
      const start = { x: e.clientX, y: e.clientY }
      const startA = { x: a.x, y: a.y }
      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - start.x
        const dy = ev.clientY - start.y
        const { dxPdf, dyPdf } = viewDeltaToPdfDelta(dx, dy, page, zoom)
        onChange({ x: clamp(0, page.width - a.width, startA.x + dxPdf), y: clamp(0, page.height - a.height, startA.y + dyPdf) })
      }
      const onUp = (ev: PointerEvent) => {
        el.releasePointerCapture(ev.pointerId)
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      e.preventDefault()
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    }
    el.addEventListener('pointerdown', onDown)
    return () => { el.removeEventListener('pointerdown', onDown) }
  }, [a.x, a.y, a.width, a.height, page, zoom, onChange, editing])

  // resize (all sides & corners) in view space, then convert back to PDF rect
  useEffect(() => {
    const el = ref.current
    if (!el) return

    type Kind = 'r'|'l'|'t'|'b'|'tr'|'tl'|'br'|'bl'
    const selectors: Record<Kind, string> = {
      r: '.resize-r', l: '.resize-l', t: '.resize-t', b: '.resize-b',
      tr: '.resize-tr', tl: '.resize-tl', br: '.resize-br', bl: '.resize-bl',
    }

    const cleanups: Array<() => void> = []

    const addHandle = (kind: Kind) => {
      const handle = el.querySelector(selectors[kind]) as HTMLElement | null
      if (!handle) return
      const onDown = (e: PointerEvent) => {
        e.preventDefault()
        handle.setPointerCapture(e.pointerId)
        const start = { x: e.clientX, y: e.clientY }
        const startBox = annotationRectToView(a, page, zoom)
        const pageView = getViewSize(page, zoom)
        const min = 8 * zoom
        const onMove = (ev: PointerEvent) => {
          let dx = ev.clientX - start.x
          let dy = ev.clientY - start.y
          if (kind === 'r' || kind === 'l') dy = 0
          if (kind === 't' || kind === 'b') dx = 0

          let left = startBox.left
          let top = startBox.top
          let width = startBox.width
          let height = startBox.height

          if (kind.includes('r')) {
            width = Math.max(min, Math.min(pageView.width - left, startBox.width + dx))
          }
          if (kind.includes('l')) {
            const newLeft = Math.min(startBox.left + startBox.width - min, Math.max(0, startBox.left + dx))
            width = Math.max(min, startBox.width - (newLeft - startBox.left))
            left = newLeft
          }
          if (kind.includes('b')) {
            height = Math.max(min, Math.min(pageView.height - top, startBox.height + dy))
          }
          if (kind.includes('t')) {
            const newTop = Math.min(startBox.top + startBox.height - min, Math.max(0, startBox.top + dy))
            height = Math.max(min, startBox.height - (newTop - startBox.top))
            top = newTop
          }

          const rect = viewRectToPdf(left, top, width, height, page, zoom)
          onChange({ x: rect.x, y: rect.y, width: rect.w, height: rect.h })
        }
        const onUp = (ev: PointerEvent) => {
          handle.releasePointerCapture(ev.pointerId)
          window.removeEventListener('pointermove', onMove)
          window.removeEventListener('pointerup', onUp)
        }
        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', onUp)
      }
      handle.addEventListener('pointerdown', onDown)
      cleanups.push(() => handle.removeEventListener('pointerdown', onDown))
    }

    ;(['r','l','t','b','tr','tl','br','bl'] as Kind[]).forEach(addHandle)

    return () => { cleanups.forEach((fn) => fn()) }
  }, [a.x, a.y, a.width, a.height, page, zoom, onChange, selected, editing])

  // cursor hint: show resize cursors near edges/corners, move otherwise; text when editing text
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onMove = (e: MouseEvent) => {
      if (editing && a.type === 'text') {
        el.style.cursor = 'text'
        return
      }
      const rect = el.getBoundingClientRect()
      const vx = e.clientX - rect.left
      const vy = e.clientY - rect.top
      const w = rect.width
      const h = rect.height
      const pad = 10
      const nearL = vx <= pad
      const nearR = vx >= w - pad
      const nearT = vy <= pad
      const nearB = vy >= h - pad
      if ((nearL && nearT) || (nearR && nearB)) { el.style.cursor = 'nwse-resize'; return }
      if ((nearR && nearT) || (nearL && nearB)) { el.style.cursor = 'nesw-resize'; return }
      if (nearL || nearR) { el.style.cursor = 'ew-resize'; return }
      if (nearT || nearB) { el.style.cursor = 'ns-resize'; return }
      el.style.cursor = 'move'
    }
    const onLeave = () => { el.style.cursor = editing && a.type === 'text' ? 'text' : 'move' }
    el.addEventListener('mousemove', onMove)
    el.addEventListener('mouseleave', onLeave)
    return () => {
      el.removeEventListener('mousemove', onMove)
      el.removeEventListener('mouseleave', onLeave)
    }
  }, [editing, a.type])

  return (
    <div
      ref={ref}
      className={cn('absolute group border border-transparent hover:border-blue-300', (selected || editing) && 'border-blue-500')}
      style={{ left: box.left, top: box.top, width: box.width, height: box.height, zIndex: a.type === 'highlight' ? 0 : 1 }}
      onMouseDownCapture={(e) => {
        const tgt = e.target as HTMLElement
        const inEditable = !!tgt.closest('[contenteditable="true"], .select-text')
        if (!inEditable) { e.stopPropagation(); onSelect() }
      }}
      onMouseDown={(e) => { e.stopPropagation() }}
    >
      {/* content */}
      <div className={cn('w-full h-full', a.type === 'highlight' ? '' : '')} style={{ pointerEvents: 'auto', transform: `rotate(${a.rotation || 0}deg)`, transformOrigin: 'center center' }}>
        {a.type === 'highlight' && (
          <div className="w-full h-full drag-handle" style={{ background: a.color || 'rgba(255,235,59,0.5)', mixBlendMode: 'multiply' as any }} />
        )}
        {a.type === 'text' && (
          <div className="w-full h-full flex items-center justify-center select-text" style={{ color: a.color || '#111', fontSize: (a.fontSize || 16) * zoom, whiteSpace: 'pre-wrap', textAlign: 'center' }}>
            {a.text || ''}
          </div>
        )}
        {a.type === 'image' && (
          <img src={a.imageDataUrl} className="w-full h-full object-contain drag-handle" />
        )}
      </div>
      {/* resize handle */}
      {selected && (
        <>
          <div className="absolute -top-3 left-1 h-5 px-2 text-xs rounded bg-white border shadow-sm flex items-center drag-handle select-none">Move</div>
          {/* corners */}
          <div className="absolute -right-1 -bottom-1 h-4 w-4 bg-blue-600 rounded-sm cursor-nwse-resize resize-br" />
          <div className="absolute -right-1 -top-1 h-4 w-4 bg-blue-600 rounded-sm cursor-nesw-resize resize-tr" />
          <div className="absolute -left-1 -top-1 h-4 w-4 bg-blue-600 rounded-sm cursor-nwse-resize resize-tl" />
          <div className="absolute -left-1 -bottom-1 h-4 w-4 bg-blue-600 rounded-sm cursor-nesw-resize resize-bl" />
          {/* edges */}
          <div className="absolute -right-1 top-1/2 -mt-2 h-4 w-4 bg-blue-600 rounded-sm cursor-ew-resize resize-r" />
          <div className="absolute -left-1 top-1/2 -mt-2 h-4 w-4 bg-blue-600 rounded-sm cursor-ew-resize resize-l" />
          <div className="absolute left-1/2 -ml-2 -top-1 h-4 w-4 bg-blue-600 rounded-sm cursor-ns-resize resize-t" />
          <div className="absolute left-1/2 -ml-2 -bottom-1 h-4 w-4 bg-blue-600 rounded-sm cursor-ns-resize resize-b" />
        </>
      )}
    </div>
  )
}

function clamp(min: number, max: number, v: number): number { return Math.max(min, Math.min(max, v)) }

function viewDeltaToPdfDelta(dx: number, dy: number, page: PdfPageInfo, zoom: number) {
  const r = ((page.rotation % 360) + 360) % 360
  if (r === 0) return { dxPdf: dx / zoom, dyPdf: -dy / zoom }
  if (r === 90) return { dxPdf: -dy / zoom, dyPdf: -dx / zoom }
  if (r === 180) return { dxPdf: -dx / zoom, dyPdf: dy / zoom }
  return { dxPdf: dy / zoom, dyPdf: dx / zoom }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => res(img)
    img.onerror = (e) => rej(e)
    img.src = src
  })
}

function TextEditable({ a, zoom, editing, localText, setLocalText, onEdit, onEndEdit }: {
  a: Annotation
  zoom: number
  editing: boolean
  localText: string
  setLocalText: (s: string) => void
  onEdit: () => void
  onEndEdit: () => void
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [composing, setComposing] = useState(false)

  useEffect(() => {
    if (editing) {
      // seed content without triggering re-render loops
      if (ref.current) {
        ref.current.innerText = localText || a.text || ''
        // place caret at end
        const sel = window.getSelection?.()
        const range = document.createRange()
        range.selectNodeContents(ref.current)
        range.collapse(false)
        sel?.removeAllRanges()
        sel?.addRange(range)
      }
    }
  }, [editing])

  return (
    <div className="w-full h-full flex items-center justify-center" style={{ color: a.color || '#111', fontSize: (a.fontSize || 16) * zoom }}>
      <div
        ref={ref}
        className="px-1 select-text"
        contentEditable
        suppressContentEditableWarning
        onMouseDown={(e) => { if (editing) e.stopPropagation() }}
        onDoubleClick={(e) => { e.stopPropagation(); onEdit() }}
        onInput={(e) => { if (!composing) setLocalText((e.currentTarget as HTMLDivElement).innerText) }}
        onCompositionStart={() => setComposing(true)}
        onCompositionEnd={(e) => { setComposing(false); setLocalText((e.currentTarget as HTMLDivElement).innerText) }}
        onBlur={() => onEndEdit()}
      >
        {a.text}
      </div>
    </div>
  )
}
