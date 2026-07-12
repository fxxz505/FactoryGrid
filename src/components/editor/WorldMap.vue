<template>
  <div class="world-map-overlay" role="dialog" aria-modal="true" aria-label="工厂地图">
    <header class="world-map-toolbar">
      <div>
        <strong>工厂地图</strong>
        <span>{{ project.entities.length }} 个建筑 · 拖动浏览 · 滚轮缩放 · 双击定位</span>
      </div>
      <div class="world-map-actions">
        <button type="button" title="缩小地图" aria-label="缩小地图" @click="zoomAtCenter(0.82)"><ZoomOut :size="18" /></button>
        <button type="button" title="适应工厂范围" aria-label="适应工厂范围" @click="fitFactory"><Scan :size="18" /></button>
        <button type="button" title="放大地图" aria-label="放大地图" @click="zoomAtCenter(1.22)"><ZoomIn :size="18" /></button>
        <button type="button" title="关闭地图 (M)" aria-label="关闭地图" @click="emit('close')"><X :size="19" /></button>
      </div>
    </header>
    <div ref="stageRef" class="world-map-stage">
      <canvas
        ref="canvasRef"
        data-testid="world-map-canvas"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @wheel.prevent="onWheel"
        @dblclick="onDoubleClick"
      ></canvas>
      <aside class="world-map-bookmarks">
        <div><strong>区域书签</strong><button type="button" title="添加当前地图中心" @click="addBookmark"><Plus :size="15" /></button></div>
        <button
          v-for="bookmark in bookmarks"
          :key="bookmark.id"
          class="world-map-bookmark"
          type="button"
          @click="focusBookmark(bookmark.position)"
        >
          <MapPin :size="14" /><span>{{ bookmark.name }}</span>
          <X :size="13" @click.stop="emit('removeBookmark', bookmark.id)" />
        </button>
      </aside>
      <div class="world-map-hint"><kbd>M</kbd><span>返回工厂</span></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { MapPin, Plus, Scan, X, ZoomIn, ZoomOut } from '@lucide/vue'
import { shapeById } from '../../data/resources'
import type { Direction, FactoryEntity, FactoryProject, GridPosition, MapBookmark, ViewportState } from '../../models/factory'
import { CELL } from '../../render/canvasRenderer'
import { findTunnelExit, machinePortRoles, planBeltSprite } from '../../render/factoryAssets'

const props = defineProps<{
  project: FactoryProject
  viewportSize: { width: number; height: number }
  bookmarks: MapBookmark[]
}>()

const emit = defineEmits<{
  close: []
  viewportChange: [viewport: ViewportState]
  addBookmark: [position: GridPosition]
  removeBookmark: [id: string]
}>()

interface WorldBounds { minX: number; maxX: number; minY: number; maxY: number }

const canvasRef = ref<HTMLCanvasElement>()
const stageRef = ref<HTMLDivElement>()
let baseCanvas: HTMLCanvasElement | ImageBitmap | undefined
let baseTopology = ''
let bounds: WorldBounds = { minX: -8, maxX: 8, minY: -6, maxY: 6 }
let camera = { x: 0, y: 0, scale: 8 }
let paintFrame = 0
let resizeObserver: ResizeObserver | undefined
let mapWorker: Worker | undefined
let mapWorkerRequest = 0
let drag: { pointerId: number; x: number; y: number; cameraX: number; cameraY: number; moved: boolean } | undefined

const topologySignature = computed(() => props.project.entities.map((entity) => (
    `${entity.id}:${entity.type}:${entity.position.x}:${entity.position.y}:${entity.direction}`
  )).join('|'))

function factoryBounds(): WorldBounds {
  if (!props.project.entities.length) return { minX: -8, maxX: 8, minY: -6, maxY: 6 }
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  props.project.entities.forEach((entity) => {
    minX = Math.min(minX, entity.position.x)
    maxX = Math.max(maxX, entity.position.x + 1)
    minY = Math.min(minY, entity.position.y)
    maxY = Math.max(maxY, entity.position.y + 1)
  })
  const padding = 5
  return { minX: minX - padding, maxX: maxX + padding, minY: minY - padding, maxY: maxY + padding }
}

function ensureBase(): HTMLCanvasElement | ImageBitmap {
  const topology = topologySignature.value
  if (baseCanvas && baseTopology === topology) return baseCanvas
  baseTopology = topology
  bounds = factoryBounds()
  const worldWidth = Math.max(1, bounds.maxX - bounds.minX)
  const worldHeight = Math.max(1, bounds.maxY - bounds.minY)
  const pixelsPerCell = Math.min(8, 2048 / worldWidth, 2048 / worldHeight)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.ceil(worldWidth * pixelsPerCell))
  canvas.height = Math.max(1, Math.ceil(worldHeight * pixelsPerCell))
  const ctx = canvas.getContext('2d')
  if (props.project.entities.length >= 1800 && typeof OffscreenCanvas !== 'undefined' && typeof Worker !== 'undefined') {
    requestWorkerBase(topology, canvas.width, canvas.height, pixelsPerCell)
    if (ctx) {
      ctx.fillStyle = '#596474'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
    baseCanvas = canvas
    return canvas
  }
  if (ctx) {
    ctx.fillStyle = '#596474'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    const entityIndex = new Map(props.project.entities.map((entity) => [positionKey(entity.position), entity]))
    drawBelts(ctx, props.project.entities.filter((entity) => entity.kind === 'belt'), pixelsPerCell, entityIndex)
    drawTunnelLinks(ctx, pixelsPerCell, entityIndex)
    props.project.entities
      .filter((entity) => entity.kind !== 'belt')
      .forEach((entity) => drawMachine(ctx, entity, pixelsPerCell, entityIndex))
  }
  baseCanvas = canvas
  return canvas
}

function requestWorkerBase(topology: string, width: number, height: number, pixelsPerCell: number): void {
  mapWorker ??= new Worker(new URL('../../render/worldMap.worker.ts', import.meta.url), { type: 'module' })
  const id = ++mapWorkerRequest
  const entityIndex = new Map(props.project.entities.map((entity) => [positionKey(entity.position), entity]))
  const lines: Array<{ x1: number; y1: number; x2: number; y2: number; dashed?: boolean }> = []
  props.project.entities.filter((entity) => entity.kind === 'belt').forEach((entity) => {
    const point = localPoint(entity, pixelsPerCell)
    planBeltSprite(props.project, entity, entityIndex).connections.forEach((direction) => {
      const end = connectionEnd(point, direction, pixelsPerCell * 0.52)
      lines.push({ x1: point.x, y1: point.y, x2: end.x, y2: end.y })
    })
  })
  props.project.entities.filter((entity) => entity.kind !== 'belt').forEach((entity) => {
    const point = localPoint(entity, pixelsPerCell)
    machinePortRoles(entity, props.project, entityIndex).filter((port) => portConnectsToNeighbor(entity, port.direction, entityIndex)).forEach((port) => {
      const end = connectionEnd(point, port.direction, pixelsPerCell * 0.52)
      lines.push({ x1: point.x, y1: point.y, x2: end.x, y2: end.y })
    })
  })
  const handled = new Set<string>()
  props.project.entities.filter((entity) => entity.type === 'tunnel').forEach((entrance) => {
    if (handled.has(entrance.id)) return
    const exit = findTunnelExit(props.project, entrance, entityIndex)
    if (!exit) return
    handled.add(entrance.id)
    handled.add(exit.id)
    const from = localPoint(entrance, pixelsPerCell)
    const to = localPoint(exit, pixelsPerCell)
    lines.push({ x1: from.x, y1: from.y, x2: to.x, y2: to.y, dashed: true })
  })
  const points = props.project.entities.filter((entity) => entity.kind !== 'belt').map((entity) => {
    const point = localPoint(entity, pixelsPerCell)
    const sourceColor = entity.sourceShape ? shapeById[entity.sourceShape]?.color : undefined
    return {
      x: point.x,
      y: point.y,
      size: Math.max(3, pixelsPerCell * 0.72),
      color: sourceColor ?? (entity.type === 'hub' ? '#f2d36d' : entity.type === 'research-lab' ? '#a987c3' : '#67b8a8')
    }
  })
  mapWorker.onmessage = (event: MessageEvent<{ id: number; bitmap: ImageBitmap }>) => {
    if (event.data.id !== id || baseTopology !== topology) {
      event.data.bitmap.close()
      return
    }
    if (baseCanvas instanceof ImageBitmap) baseCanvas.close()
    baseCanvas = event.data.bitmap
    schedulePaint()
  }
  mapWorker.postMessage({ id, width, height, lines, points })
}

function connectionEnd(point: { x: number; y: number }, direction: Direction, length: number): { x: number; y: number } {
  if (direction === 'north') return { x: point.x, y: point.y - length }
  if (direction === 'south') return { x: point.x, y: point.y + length }
  if (direction === 'west') return { x: point.x - length, y: point.y }
  return { x: point.x + length, y: point.y }
}

function localPoint(entity: FactoryEntity, pixelsPerCell: number): { x: number; y: number } {
  return {
    x: (entity.position.x + 0.5 - bounds.minX) * pixelsPerCell,
    y: (entity.position.y + 0.5 - bounds.minY) * pixelsPerCell
  }
}

function drawBelts(
  ctx: CanvasRenderingContext2D,
  belts: FactoryEntity[],
  pixelsPerCell: number,
  entityIndex: Map<string, FactoryEntity>
): void {
  ctx.strokeStyle = '#aeb7b8'
  ctx.lineWidth = Math.max(1, pixelsPerCell * 0.28)
  ctx.lineCap = 'butt'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  belts.forEach((entity) => {
    const point = localPoint(entity, pixelsPerCell)
    const connections = planBeltSprite(props.project, entity, entityIndex).connections
    connections.forEach((direction) => drawConnectionArm(ctx, point, direction, pixelsPerCell * 0.52))
  })
  ctx.stroke()
}

function drawMachine(
  ctx: CanvasRenderingContext2D,
  entity: FactoryEntity,
  pixelsPerCell: number,
  entityIndex: Map<string, FactoryEntity>
): void {
  const point = localPoint(entity, pixelsPerCell)
  const size = Math.max(3, pixelsPerCell * 0.72)
  const connectedPorts = machinePortRoles(entity, props.project, entityIndex).filter((port) => (
    portConnectsToNeighbor(entity, port.direction, entityIndex)
  ))
  if (connectedPorts.length) {
    ctx.strokeStyle = '#aeb7b8'
    ctx.lineWidth = Math.max(1, pixelsPerCell * 0.28)
    ctx.lineCap = 'butt'
    ctx.beginPath()
    connectedPorts.forEach((port) => drawConnectionArm(ctx, point, port.direction, pixelsPerCell * 0.52))
    ctx.stroke()
  }
  const sourceColor = entity.sourceShape ? shapeById[entity.sourceShape]?.color : undefined
  ctx.fillStyle = sourceColor ?? (entity.type === 'hub' ? '#f2d36d' : entity.type === 'research-lab' ? '#a987c3' : '#67b8a8')
  ctx.fillRect(point.x - size / 2, point.y - size / 2, size, size)
  ctx.strokeStyle = 'rgba(30, 40, 47, 0.72)'
  ctx.lineWidth = Math.max(1, pixelsPerCell * 0.12)
  ctx.strokeRect(point.x - size / 2, point.y - size / 2, size, size)
}

function drawConnectionArm(
  ctx: CanvasRenderingContext2D,
  point: { x: number; y: number },
  direction: Direction,
  length: number
): void {
  ctx.moveTo(point.x, point.y)
  if (direction === 'north') ctx.lineTo(point.x, point.y - length)
  else if (direction === 'south') ctx.lineTo(point.x, point.y + length)
  else if (direction === 'west') ctx.lineTo(point.x - length, point.y)
  else ctx.lineTo(point.x + length, point.y)
}

function portConnectsToNeighbor(
  entity: FactoryEntity,
  direction: Direction,
  entityIndex: Map<string, FactoryEntity>
): boolean {
  const neighbor = entityIndex.get(positionKey(offsetPosition(entity.position, direction)))
  if (!neighbor) return false
  if (neighbor.kind === 'belt') {
    return planBeltSprite(props.project, neighbor, entityIndex).connections.includes(oppositeDirection(direction))
  }
  return machinePortRoles(neighbor, props.project, entityIndex).some((port) => port.direction === oppositeDirection(direction))
}

function drawTunnelLinks(
  ctx: CanvasRenderingContext2D,
  pixelsPerCell: number,
  entityIndex: Map<string, FactoryEntity>
): void {
  const handled = new Set<string>()
  ctx.save()
  ctx.strokeStyle = 'rgba(190, 203, 204, 0.62)'
  ctx.lineWidth = Math.max(1, pixelsPerCell * 0.16)
  ctx.setLineDash([pixelsPerCell * 0.45, pixelsPerCell * 0.35])
  props.project.entities.filter((entity) => entity.type === 'tunnel').forEach((entrance) => {
    if (handled.has(entrance.id)) return
    const exit = findTunnelExit(props.project, entrance, entityIndex)
    if (!exit) return
    handled.add(entrance.id)
    handled.add(exit.id)
    const from = localPoint(entrance, pixelsPerCell)
    const to = localPoint(exit, pixelsPerCell)
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
  })
  ctx.restore()
}

function offsetPosition(
  position: { x: number; y: number },
  direction: Direction,
  distance = 1
): { x: number; y: number } {
  if (direction === 'north') return { x: position.x, y: position.y - distance }
  if (direction === 'south') return { x: position.x, y: position.y + distance }
  if (direction === 'west') return { x: position.x - distance, y: position.y }
  return { x: position.x + distance, y: position.y }
}

function oppositeDirection(direction: Direction): Direction {
  if (direction === 'north') return 'south'
  if (direction === 'south') return 'north'
  if (direction === 'west') return 'east'
  return 'west'
}

function positionKey(position: { x: number; y: number }): string {
  return `${position.x},${position.y}`
}

function mapPoint(worldX: number, worldY: number, width: number, height: number): { x: number; y: number } {
  return {
    x: width / 2 + (worldX - camera.x) * camera.scale,
    y: height / 2 + (worldY - camera.y) * camera.scale
  }
}

function paint(): void {
  paintFrame = 0
  const canvas = canvasRef.value
  if (!canvas) return
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  const ratio = Math.min(window.devicePixelRatio || 1, 1.5)
  const pixelWidth = Math.round(width * ratio)
  const pixelHeight = Math.round(height * ratio)
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth
    canvas.height = pixelHeight
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  ctx.fillStyle = '#424b5b'
  ctx.fillRect(0, 0, width, height)

  const base = ensureBase()
  const topLeft = mapPoint(bounds.minX, bounds.minY, width, height)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(
    base,
    topLeft.x,
    topLeft.y,
    (bounds.maxX - bounds.minX) * camera.scale,
    (bounds.maxY - bounds.minY) * camera.scale
  )

  drawViewport(ctx, width, height)
  drawOrigin(ctx, width, height)
}

function drawViewport(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const viewport = props.project.viewport
  const minX = -viewport.x / (CELL * viewport.zoom)
  const minY = -viewport.y / (CELL * viewport.zoom)
  const topLeft = mapPoint(minX, minY, width, height)
  ctx.strokeStyle = '#f7d45c'
  ctx.lineWidth = 2
  ctx.strokeRect(
    topLeft.x,
    topLeft.y,
    props.viewportSize.width / (CELL * viewport.zoom) * camera.scale,
    props.viewportSize.height / (CELL * viewport.zoom) * camera.scale
  )
}

function drawOrigin(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const origin = mapPoint(0, 0, width, height)
  ctx.strokeStyle = 'rgba(255,255,255,0.72)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(origin.x - 5, origin.y)
  ctx.lineTo(origin.x + 5, origin.y)
  ctx.moveTo(origin.x, origin.y - 5)
  ctx.lineTo(origin.x, origin.y + 5)
  ctx.stroke()
}

function schedulePaint(): void {
  if (!paintFrame) paintFrame = window.requestAnimationFrame(paint)
}

function fitFactory(): void {
  const canvas = canvasRef.value
  if (!canvas) return
  ensureBase()
  camera.x = (bounds.minX + bounds.maxX) / 2
  camera.y = (bounds.minY + bounds.maxY) / 2
  camera.scale = Math.max(0.35, Math.min(
    (canvas.clientWidth - 56) / Math.max(1, bounds.maxX - bounds.minX),
    (canvas.clientHeight - 56) / Math.max(1, bounds.maxY - bounds.minY)
  ))
  schedulePaint()
}

function zoomAt(screenX: number, screenY: number, factor: number): void {
  const canvas = canvasRef.value
  if (!canvas) return
  const worldX = camera.x + (screenX - canvas.clientWidth / 2) / camera.scale
  const worldY = camera.y + (screenY - canvas.clientHeight / 2) / camera.scale
  camera.scale = Math.min(64, Math.max(0.2, camera.scale * factor))
  camera.x = worldX - (screenX - canvas.clientWidth / 2) / camera.scale
  camera.y = worldY - (screenY - canvas.clientHeight / 2) / camera.scale
  schedulePaint()
}

function zoomAtCenter(factor: number): void {
  const canvas = canvasRef.value
  if (canvas) zoomAt(canvas.clientWidth / 2, canvas.clientHeight / 2, factor)
}

function onWheel(event: WheelEvent): void {
  const rect = (event.currentTarget as HTMLCanvasElement).getBoundingClientRect()
  zoomAt(event.clientX - rect.left, event.clientY - rect.top, event.deltaY < 0 ? 1.14 : 0.88)
}

function onPointerDown(event: PointerEvent): void {
  const canvas = event.currentTarget as HTMLCanvasElement
  canvas.setPointerCapture(event.pointerId)
  drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, cameraX: camera.x, cameraY: camera.y, moved: false }
}

function onPointerMove(event: PointerEvent): void {
  if (!drag || drag.pointerId !== event.pointerId) return
  const dx = event.clientX - drag.x
  const dy = event.clientY - drag.y
  drag.moved ||= Math.abs(dx) + Math.abs(dy) > 3
  camera.x = drag.cameraX - dx / camera.scale
  camera.y = drag.cameraY - dy / camera.scale
  schedulePaint()
}

function onPointerUp(event: PointerEvent): void {
  if (!drag || drag.pointerId !== event.pointerId) return
  drag = undefined
}

function onDoubleClick(event: MouseEvent): void {
  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  const worldX = camera.x + (event.clientX - rect.left - canvas.clientWidth / 2) / camera.scale
  const worldY = camera.y + (event.clientY - rect.top - canvas.clientHeight / 2) / camera.scale
  const zoom = props.project.viewport.zoom
  emit('viewportChange', {
    x: props.viewportSize.width / 2 - worldX * CELL * zoom,
    y: props.viewportSize.height / 2 - worldY * CELL * zoom,
    zoom
  })
  emit('close')
}

function addBookmark(): void {
  emit('addBookmark', { x: Math.round(camera.x), y: Math.round(camera.y) })
}

function focusBookmark(position: GridPosition): void {
  camera.x = position.x
  camera.y = position.y
  schedulePaint()
}

watch(() => props.project.viewport, schedulePaint, { deep: true })
watch(topologySignature, () => {
  if (baseCanvas instanceof ImageBitmap) baseCanvas.close()
  baseCanvas = undefined
  fitFactory()
})

onMounted(() => {
  resizeObserver = new ResizeObserver(() => {
    if (!baseCanvas) fitFactory()
    else schedulePaint()
  })
  if (stageRef.value) resizeObserver.observe(stageRef.value)
  window.requestAnimationFrame(fitFactory)
})

onBeforeUnmount(() => {
  if (paintFrame) window.cancelAnimationFrame(paintFrame)
  if (baseCanvas instanceof ImageBitmap) baseCanvas.close()
  mapWorker?.terminate()
  resizeObserver?.disconnect()
})
</script>
