export type PdfPageInfo = {
  index: number
  width: number // in PDF points
  height: number
  rotation: number // degrees: 0, 90, 180, 270
}

export type AnnotationType = 'text' | 'highlight' | 'image'

export type Annotation = {
  id: string
  pageIndex: number
  type: AnnotationType
  x: number // PDF points (origin bottom-left)
  y: number // PDF points
  width: number
  height: number
  rotation?: number // per-annotation rotation in degrees
  text?: string
  color?: string
  fontSize?: number
  imageDataUrl?: string
  z?: number
}
