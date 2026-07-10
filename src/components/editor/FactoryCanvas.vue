<template>
  <div class="factory-canvas-wrap">
    <div class="canvas-head">
      <div>
        <strong>工厂画布</strong>
        <span>拖拽铺传送带或框选区域，按住空格或中键移动画布，滚轮缩放。</span>
      </div>
      <div class="canvas-legend">
        <span><i class="ok"></i> 运行</span>
        <span><i class="warn"></i> 等待</span>
        <span><i class="bad"></i> 堵塞</span>
      </div>
    </div>
    <div class="factory-canvas-stage">
      <canvas
        ref="staticCanvasRef"
        class="factory-canvas factory-canvas-static"
        :class="{ panning: isPanning || project.activeTool === 'pan', previewing: Boolean(preview || areaPreview) }"
        data-testid="factory-canvas"
        @click="onClick"
        @dblclick="onDoubleClick"
        @mousedown="onDown"
        @mousemove="onMove"
        @mouseup="onUp"
        @mouseleave="onLeave"
        @auxclick.prevent
        @wheel.prevent="onWheel"
        @contextmenu.prevent="onDelete"
      ></canvas>
      <canvas ref="dynamicCanvasRef" class="factory-canvas-dynamic" aria-hidden="true"></canvas>
      <canvas ref="machineOverlayCanvasRef" class="factory-canvas-dynamic factory-canvas-machine-overlay" aria-hidden="true"></canvas>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, toRaw, watch } from 'vue'
import type { AreaPreview, BeltPreview, Direction, FactoryProject, GridPosition, ViewportState } from '../../models/factory'
import { beltRoute, tunnelRoute } from '../../engine/simulation/editorActions'
import {
  createFactoryRenderScene, entityAtPoint, renderFactoryDynamicCanvas, renderFactoryMachineOverlayCanvas,
  renderFactoryStaticCanvas, screenToGrid, type FactoryRenderScene
} from '../../render/canvasRenderer'

const props = defineProps<{ project: FactoryProject; selectedEntityId?: string }>()

const emit = defineEmits<{
  select: [id: string]
  place: [cell: GridPosition]
  dragBelt: [start: GridPosition, end: GridPosition, direction: Direction]
  areaAction: [start: GridPosition, end: GridPosition]
  deleteCell: [cell: GridPosition]
  viewportChange: [viewport: ViewportState]
  configureAssembler: [id: string]
  configureResearch: [id: string]
}>()

const staticCanvasRef = ref<HTMLCanvasElement>()
const dynamicCanvasRef = ref<HTMLCanvasElement>()
const machineOverlayCanvasRef = ref<HTMLCanvasElement>()
const hoverCell = ref<GridPosition>()
const dragStart = ref<GridPosition>()
const dragEnd = ref<GridPosition>()
const isPanning = ref(false)
const isSpaceDown = ref(false)
const isDragging = ref(false)
const suppressClick = ref(false)
let panStart: { x: number; y: number; viewport: ViewportState } | undefined
const SIMULATION_STEP_MS = 170
const topologySignature = computed(() => props.project.entities.map((entity) => (
  `${entity.id}:${entity.type}:${entity.position.x}:${entity.position.y}:${entity.direction}:${entity.level ?? 1}`
)).join('|'))
let staticPaintFrame = 0
let animationFrame = 0
let scene: FactoryRenderScene | undefined
let lastTick = props.project.tick
let tickStartedAt = performance.now()

const preview = computed<BeltPreview | undefined>(() => {
  if (!isDragging.value || !dragStart.value || !dragEnd.value || !['belt', 'fast-belt', 'tunnel'].includes(props.project.activeTool)) return undefined
  const route = props.project.activeTool === 'tunnel'
    ? tunnelRoute(dragStart.value, dragEnd.value, props.project.activeDirection)
    : beltRoute(dragStart.value, dragEnd.value, props.project.activeDirection)
  return {
    cells: route.map((segment) => segment.position),
    route,
    direction: route[0]?.direction ?? props.project.activeDirection,
    valid: route.length > 0,
    tool: props.project.activeTool === 'tunnel' ? 'tunnel' : 'belt'
  }
})

const areaPreview = computed<AreaPreview | undefined>(() => {
  if (!isDragging.value || !dragStart.value || !dragEnd.value) return undefined
  if (props.project.activeTool === 'copy-area') return { start: dragStart.value, end: dragEnd.value, mode: 'copy' }
  if (props.project.activeTool === 'delete-area') return { start: dragStart.value, end: dragEnd.value, mode: 'delete' }
  if (props.project.activeTool === 'upgrade-area') return { start: dragStart.value, end: dragEnd.value, mode: 'upgrade' }
  return undefined
})

function selectionState() {
  return {
    selectedEntityId: props.selectedEntityId,
    hoverCell: hoverCell.value,
    preview: preview.value,
    areaPreview: areaPreview.value
  }
}

function paintStatic(): void {
  staticPaintFrame = 0
  const canvas = staticCanvasRef.value
  if (!canvas) return
  const project = toRaw(props.project)
  scene = createFactoryRenderScene(canvas, project)
  renderFactoryStaticCanvas(canvas, project, selectionState(), scene)
  const overlayCanvas = machineOverlayCanvasRef.value
  if (overlayCanvas) renderFactoryMachineOverlayCanvas(overlayCanvas, project, scene)
}

function scheduleStaticPaint(): void {
  if (!staticPaintFrame) staticPaintFrame = window.requestAnimationFrame(paintStatic)
}

function animateItems(time: number): void {
  animationFrame = window.requestAnimationFrame(animateItems)
  if (document.visibilityState === 'hidden') return
  const canvas = dynamicCanvasRef.value
  const staticCanvas = staticCanvasRef.value
  if (!canvas || !staticCanvas) return
  if (props.project.tick !== lastTick) {
    lastTick = props.project.tick
    tickStartedAt = time
  }
  const project = toRaw(props.project)
  if (!scene) scene = createFactoryRenderScene(staticCanvas, project)
  const stepMs = SIMULATION_STEP_MS / Math.max(1, props.project.speed)
  const renderAlpha = props.project.running ? Math.min(1, Math.max(0, (time - tickStartedAt) / stepMs)) : 0
  renderFactoryDynamicCanvas(canvas, project, renderAlpha, scene)
}
function point(event: MouseEvent): { x: number; y: number } {
  const rect = (event.target as HTMLCanvasElement).getBoundingClientRect()
  return { x: event.clientX - rect.left, y: event.clientY - rect.top }
}

function cellFromEvent(event: MouseEvent): GridPosition {
  return screenToGrid(point(event), props.project.viewport)
}

function onDoubleClick(event: MouseEvent): void {
  const clicked = entityAtPoint(props.project, point(event))
  if (clicked?.type === 'assembler') emit('configureAssembler', clicked.id)
  if (clicked?.type === 'research-lab') emit('configureResearch', clicked.id)
}

function onClick(event: MouseEvent): void {
  if (isPanning.value || isDragging.value || suppressClick.value) {
    suppressClick.value = false
    return
  }
  const cell = cellFromEvent(event)
  if (props.project.activeTool === 'paste-blueprint') {
    emit('place', cell)
    return
  }
  const clicked = entityAtPoint(props.project, point(event))
  if (clicked) emit('select', clicked.id)
  else emit('place', cell)
}

function onDown(event: MouseEvent): void {
  const currentPoint = point(event)
  if (event.button === 1 || event.button === 2 || isSpaceDown.value || props.project.activeTool === 'pan') {
    isPanning.value = true
    suppressClick.value = true
    panStart = { x: event.clientX, y: event.clientY, viewport: { ...props.project.viewport } }
    return
  }
  if (event.button !== 0 || props.project.activeTool === 'paste-blueprint') return
  dragStart.value = screenToGrid(currentPoint, props.project.viewport)
  dragEnd.value = dragStart.value
  isDragging.value = true
}

function onMove(event: MouseEvent): void {
  if (isPanning.value && panStart) {
    emit('viewportChange', {
      ...panStart.viewport,
      x: panStart.viewport.x + event.clientX - panStart.x,
      y: panStart.viewport.y + event.clientY - panStart.y
    })
    scheduleStaticPaint()
    return
  }
  hoverCell.value = cellFromEvent(event)
  if (isDragging.value) dragEnd.value = hoverCell.value
  scheduleStaticPaint()
}

function onUp(event: MouseEvent): void {
  if (isPanning.value) {
    isPanning.value = false
    panStart = undefined
    return
  }
  if (!isDragging.value || !dragStart.value) return
  const end = cellFromEvent(event)
  const start = dragStart.value
  const moved = start.x !== end.x || start.y !== end.y
  const direction = props.project.activeDirection
  isDragging.value = false
  dragStart.value = undefined
  dragEnd.value = undefined

  let handledDrag = false
  if (['copy-area', 'delete-area', 'upgrade-area'].includes(props.project.activeTool)) {
    emit('areaAction', start, end)
    handledDrag = true
  } else if (moved && ['belt', 'fast-belt', 'tunnel'].includes(props.project.activeTool)) {
    emit('dragBelt', start, end, direction)
    handledDrag = true
  }
  suppressClick.value = handledDrag
  scheduleStaticPaint()
}

function onLeave(): void {
  hoverCell.value = undefined
  isDragging.value = false
  dragStart.value = undefined
  dragEnd.value = undefined
  isPanning.value = false
  panStart = undefined
  scheduleStaticPaint()
}

function onDelete(event: MouseEvent): void {
  if (!isPanning.value && !isSpaceDown.value) emit('deleteCell', cellFromEvent(event))
}

function onWheel(event: WheelEvent): void {
  const canvas = staticCanvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  const mouse = { x: event.clientX - rect.left, y: event.clientY - rect.top }
  const before = screenToGrid(mouse, props.project.viewport)
  const nextZoom = clamp(props.project.viewport.zoom * (event.deltaY > 0 ? 0.9 : 1.1), 0.62, 1.65)
  emit('viewportChange', {
    zoom: nextZoom,
    x: mouse.x - before.x * 46 * nextZoom,
    y: mouse.y - before.y * 46 * nextZoom
  })
  scheduleStaticPaint()
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.code === 'Space') {
    isSpaceDown.value = true
    event.preventDefault()
  }
}

function onKeyUp(event: KeyboardEvent): void {
  if (event.code === 'Space') isSpaceDown.value = false
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

watch(
  () => [
    topologySignature.value, props.selectedEntityId, props.project.activeTool,
    props.project.activeDirection, props.project.viewport.x, props.project.viewport.y,
    props.project.viewport.zoom, props.project.performance.quality
  ],
  scheduleStaticPaint
)
watch(preview, scheduleStaticPaint, { deep: true })
watch(areaPreview, scheduleStaticPaint, { deep: true })

onMounted(() => {
  paintStatic()
  animationFrame = window.requestAnimationFrame(animateItems)
  window.addEventListener('resize', scheduleStaticPaint)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
})

onBeforeUnmount(() => {
  if (staticPaintFrame) window.cancelAnimationFrame(staticPaintFrame)
  if (animationFrame) window.cancelAnimationFrame(animationFrame)
  window.removeEventListener('resize', scheduleStaticPaint)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
})
</script>