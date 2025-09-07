import type { Annotation, PdfPageInfo } from '@/types'

export function getViewSize(page: PdfPageInfo, zoom: number): { width: number; height: number } {
  const r = ((page.rotation % 360) + 360) % 360
  if (r === 90 || r === 270) {
    return { width: page.height * zoom, height: page.width * zoom }
  }
  return { width: page.width * zoom, height: page.height * zoom }
}

// Convert a PDF-space rectangle (bottom-left x,y with width/height in PDF points)
// into view-space top-left box considering rotation and zoom.
export function rectToView(
  x: number,
  y: number,
  w: number,
  h: number,
  page: PdfPageInfo,
  zoom: number,
): { left: number; top: number; width: number; height: number } {
  const W = page.width
  const H = page.height
  const z = zoom
  const r = ((page.rotation % 360) + 360) % 360
  if (r === 0) {
    return { left: x * z, top: (H - (y + h)) * z, width: w * z, height: h * z }
  }
  if (r === 90) {
    return {
      left: (H - y - h) * z,
      top: (W - x - w) * z,
      width: h * z,
      height: w * z,
    }
  }
  if (r === 180) {
    return {
      left: (W - x - w) * z,
      top: y * z,
      width: w * z,
      height: h * z,
    }
  }
  // 270
  return {
    left: y * z,
    top: x * z,
    width: h * z,
    height: w * z,
  }
}

export function annotationRectToView(a: Annotation, page: PdfPageInfo, zoom: number) {
  return rectToView(a.x, a.y, a.width, a.height, page, zoom)
}

export function resizeDeltaForRotation(dx: number, dy: number, rotation: number, zoom: number) {
  const r = ((rotation % 360) + 360) % 360
  if (r === 0) return { dw: dx / zoom, dh: -dy / zoom }
  if (r === 90) return { dw: -dy / zoom, dh: -dx / zoom }
  if (r === 180) return { dw: -dx / zoom, dh: dy / zoom }
  // 270
  return { dw: dy / zoom, dh: dx / zoom }
}

export function viewPointToPdf(vx: number, vy: number, page: PdfPageInfo, zoom: number): { x: number; y: number } {
  const W = page.width
  const H = page.height
  const z = zoom
  const r = ((page.rotation % 360) + 360) % 360
  if (r === 0) {
    return { x: vx / z, y: H - vy / z }
  }
  if (r === 90) {
    return { x: W - (vy / z), y: H - (vx / z) }
  }
  if (r === 180) {
    return { x: W - (vx / z), y: vy / z }
  }
  // 270
  return { x: vy / z, y: vx / z }
}

export function viewRectToPdf(
  left: number,
  top: number,
  width: number,
  height: number,
  page: PdfPageInfo,
  zoom: number,
): { x: number; y: number; w: number; h: number } {
  const W = page.width
  const H = page.height
  const z = zoom
  const r = ((page.rotation % 360) + 360) % 360
  if (r === 0) {
    const w = width / z
    const h = height / z
    const x = left / z
    const y = H - top / z - h
    return { x, y, w, h }
  }
  if (r === 90) {
    const h = width / z
    const w = height / z
    const y = H - left / z - h
    const x = W - top / z - w
    return { x, y, w, h }
  }
  if (r === 180) {
    const w = width / z
    const h = height / z
    const x = W - left / z - w
    const y = top / z
    return { x, y, w, h }
  }
  // 270
  const h = width / z
  const w = height / z
  const y = left / z
  const x = top / z
  return { x, y, w, h }
}
