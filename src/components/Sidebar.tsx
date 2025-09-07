import React, { useMemo, useRef } from 'react'
import { Button } from '@/components/ui/button'
import type { Annotation } from '@/types'
import { ChevronLeft, ChevronRight, Download, Highlighter, Image as ImageIcon, LayoutGrid, RotateCcw, RotateCw, Type as TypeIcon, ZoomIn, ZoomOut } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Slider } from '@/components/ui/slider'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ScrollArea } from '@/components/ui/scroll-area'

type Props = {
  tool: 'select' | 'highlight' | 'text'
  setTool: (t: 'select' | 'highlight' | 'text') => void
  zoom: number
  setZoom: (n: number) => void
  pageIndex: number
  totalPages: number
  setPageIndex: (n: number) => void
  onUploadPdf: (file: File) => void
  onAddText: () => void
  onAddHighlight: () => void
  onAddImage: (file: File) => void
  rotateLeft: () => void
  rotateRight: () => void
  openManager: () => void
  onExport: () => void
  exportScale: number
  setExportScale: (n: number) => void
  exportFormat: 'jpeg' | 'png'
  setExportFormat: (f: 'jpeg' | 'png') => void
  quality: number
  setQuality: (q: number) => void
  selected: Annotation | undefined
  updateSelected: (next: Partial<Annotation>) => void
}

export function Sidebar({
  tool,
  setTool,
  zoom,
  setZoom,
  pageIndex,
  totalPages,
  setPageIndex,
  onUploadPdf,
  onAddText,
  onAddHighlight,
  onAddImage,
  rotateLeft,
  rotateRight,
  openManager,
  onExport,
  exportScale,
  setExportScale,
  exportFormat,
  setExportFormat,
  quality,
  setQuality,
  selected,
  updateSelected,
}: Props) {
  const pdfInputRef = useRef<HTMLInputElement | null>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const zoomPct = useMemo(() => Math.round(zoom * 100), [zoom])
  return (
    <aside className="w-72 border-r h-full flex flex-col bg-white">
      <div className="p-3 border-b text-xs tracking-wider uppercase text-gray-500">Tools</div>
      <TooltipProvider>
        <ScrollArea className="flex-1 p-3 space-y-4">
          {/* Document */}
          <section className="space-y-2">
            <div className="text-[11px] tracking-wider uppercase text-gray-500">Document</div>
            <input ref={pdfInputRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => e.target.files && onUploadPdf(e.target.files[0])} />
            <Button variant="outline" className="w-full justify-start" onClick={() => pdfInputRef.current?.click()}>
              <Download className="h-4 w-4 mr-2 rotate-180" /> Upload PDF
            </Button>
          </section>

          <Separator />

          {/* Tools */}
          <section className="space-y-2">
            <div className="text-[11px] tracking-wider uppercase text-gray-500">Tools</div>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <ToggleGroup type="single" value={tool} onValueChange={(v) => setTool((v as any) || 'select')}>
                    <ToggleGroupItem value="select" aria-label="Select">
                      <span className="sr-only">Select</span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l7 17 2-7 7-2z"/></svg>
                    </ToggleGroupItem>
                    <ToggleGroupItem value="highlight" aria-label="Highlight">
                      <Highlighter className="h-4 w-4" />
                    </ToggleGroupItem>
                    <ToggleGroupItem value="text" aria-label="Text">
                      <TypeIcon className="h-4 w-4" />
                    </ToggleGroupItem>
                  </ToggleGroup>
                </TooltipTrigger>
                <TooltipContent>Pointer / Highlight / Text</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" className="flex-1 justify-start" onClick={onAddText}><TypeIcon className="h-4 w-4 mr-2" /> Text</Button>
                </TooltipTrigger>
                <TooltipContent>Drag on canvas to create text</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" className="flex-1 justify-start" onClick={() => imageInputRef.current?.click()}><ImageIcon className="h-4 w-4 mr-2" /> Image</Button>
                </TooltipTrigger>
                <TooltipContent>Add image</TooltipContent>
              </Tooltip>
              <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files && onAddImage(e.target.files[0])} />
            </div>
          </section>

          <Separator />

          {/* Inspector */}
          {selected && (
            <section className="space-y-2">
              <div className="text-[11px] tracking-wider uppercase text-gray-500">Inspector</div>
              {selected.type === 'text' && (
                <div className="space-y-3">
                  <label className="text-sm block">Text
                    <input
                      type="text"
                      className="mt-1 w-full border rounded px-2 py-1"
                      value={selected.text || ''}
                      onChange={(e) => updateSelected({ text: e.target.value })}
                    />
                  </label>
                  <div className="flex items-center justify-between text-sm">
                    <span>Size</span>
                    <span>{selected.fontSize || 16}px</span>
                  </div>
                  <Slider min={8} max={96} step={1} value={[selected.fontSize || 16]} onValueChange={([v]) => updateSelected({ fontSize: v })} />
                  <label className="text-sm block">Color
                    <input type="color" className="mt-1 h-8 w-full" value={selected.color || '#111111'} onChange={(e) => updateSelected({ color: e.target.value })} />
                  </label>
                </div>
              )}
              {selected.type === 'highlight' && (
                <div className="space-y-3">
                  <label className="text-sm block">Color
                    <input type="color" className="mt-1 h-8 w-full" value={selected.color || '#ffee55'} onChange={(e) => updateSelected({ color: e.target.value })} />
                  </label>
                </div>
              )}
            </section>
          )}

          <Separator />

          {/* View */}
          <section className="space-y-2">
            <div className="text-[11px] tracking-wider uppercase text-gray-500">View</div>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={() => setZoom(Math.max(0.25, zoom - 0.25))}><ZoomOut className="h-4 w-4" /></Button>
                </TooltipTrigger>
                <TooltipContent>Zoom out</TooltipContent>
              </Tooltip>
              <div className="text-sm w-14 text-center">{zoomPct}%</div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={() => setZoom(Math.min(4, zoom + 0.25))}><ZoomIn className="h-4 w-4" /></Button>
                </TooltipTrigger>
                <TooltipContent>Zoom in</TooltipContent>
              </Tooltip>
            </div>
            <Slider min={25} max={400} step={5} value={[zoomPct]} onValueChange={([v]) => setZoom(v / 100)} />
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={() => setPageIndex(Math.max(0, pageIndex - 1))}><ChevronLeft className="h-4 w-4" /></Button>
                </TooltipTrigger>
                <TooltipContent>Previous page</TooltipContent>
              </Tooltip>
              <div className="text-sm w-20 text-center">{totalPages ? `${pageIndex + 1}/${totalPages}` : '-'}</div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={() => setPageIndex(Math.min(totalPages - 1, pageIndex + 1))}><ChevronRight className="h-4 w-4" /></Button>
                </TooltipTrigger>
                <TooltipContent>Next page</TooltipContent>
              </Tooltip>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={rotateLeft}><RotateCcw className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" onClick={rotateRight}><RotateCw className="h-4 w-4" /></Button>
              <Button variant="outline" className="flex-1 justify-start" onClick={openManager}><LayoutGrid className="h-4 w-4 mr-2" /> Manage Pages</Button>
            </div>
          </section>

          <Separator />

          {/* Export */}
          <section className="space-y-2">
            <div className="text-[11px] tracking-wider uppercase text-gray-500">Export</div>
            <label className="text-sm block">Scale
              <select className="mt-1 w-full border rounded px-2 py-1" value={exportScale} onChange={(e) => setExportScale(Number(e.target.value))}>
                <option value={1}>1x</option>
                <option value={2}>2x</option>
                <option value={3}>3x</option>
              </select>
            </label>
            <label className="text-sm block">Format
              <select className="mt-1 w-full border rounded px-2 py-1" value={exportFormat} onChange={(e) => setExportFormat(e.target.value as 'jpeg'|'png')}>
                <option value="jpeg">JPEG</option>
                <option value="png">PNG</option>
              </select>
            </label>
            {exportFormat === 'jpeg' && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm"><span>Quality</span><span>{quality.toFixed(1)}</span></div>
                <Slider min={0.1} max={1} step={0.1} value={[quality]} onValueChange={([v]) => setQuality(v)} />
              </div>
            )}
            <Button className="w-full" onClick={onExport}>Export PDF</Button>
          </section>
        </ScrollArea>
      </TooltipProvider>
      <div className="p-2 text-xs text-gray-500 border-t">PDF Editor</div>
    </aside>
  )
}
