interface MapLine { x1: number; y1: number; x2: number; y2: number; dashed?: boolean }
interface MapPoint { x: number; y: number; size: number; color: string }

interface MapRenderRequest {
  id: number
  width: number
  height: number
  lines: MapLine[]
  points: MapPoint[]
}

self.onmessage = (event: MessageEvent<MapRenderRequest>) => {
  const { id, width, height, lines, points } = event.data
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.fillStyle = '#596474'
  ctx.fillRect(0, 0, width, height)
  ctx.strokeStyle = '#aeb7b8'
  ctx.lineWidth = 2
  ctx.lineJoin = 'round'
  lines.forEach((line) => {
    ctx.setLineDash(line.dashed ? [4, 3] : [])
    ctx.beginPath()
    ctx.moveTo(line.x1, line.y1)
    ctx.lineTo(line.x2, line.y2)
    ctx.stroke()
  })
  ctx.setLineDash([])
  points.forEach((point) => {
    ctx.fillStyle = point.color
    ctx.fillRect(point.x - point.size / 2, point.y - point.size / 2, point.size, point.size)
    ctx.strokeStyle = 'rgba(30,40,47,0.72)'
    ctx.strokeRect(point.x - point.size / 2, point.y - point.size / 2, point.size, point.size)
  })
  const bitmap = canvas.transferToImageBitmap()
  const workerScope = self as unknown as {
    postMessage(message: unknown, transfer: ImageBitmap[]): void
  }
  workerScope.postMessage({ id, bitmap }, [bitmap])
}
