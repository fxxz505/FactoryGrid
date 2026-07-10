<template>
  <div class="factory-canvas-wrap">
    <div class="canvas-head">
      <div>
        <strong>&#24037;&#21378;&#30011;&#24067;</strong>
        <span>&#25302;&#25341;&#38138;&#20256;&#36865;&#24102;&#65292;&#25353;&#20303;&#31354;&#26684;&#25110;&#20013;&#38190;&#31227;&#21160;&#30011;&#24067;&#65292;&#28378;&#36718;&#32553;&#25918;&#12290;</span>
      </div>
      <div class="canvas-legend">
        <span><i class="ok"></i> &#36816;&#34892;</span>
        <span><i class="warn"></i> &#31561;&#24453;</span>
        <span><i class="bad"></i> &#22581;&#22622;</span>
      </div>
    </div>
    <canvas
      ref="canvasRef"
      class="factory-canvas"
      :class="{ panning: isPanning || project.activeTool === 'pan', previewing: Boolean(preview) }"
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
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { BeltPreview, Direction, FactoryProject, GridPosition, ViewportState } from '../../models/factory'
import { beltRoute, tunnelRoute } from '../../engine/simulation/editorActions'
import { entityAtPoint, renderFactoryCanvas, screenToGrid } from '../../render/canvasRenderer'

const props = defineProps<{
  project: FactoryProject
  selectedEntityId?: string
}>()

const emit = defineEmits<{
  select: [id: string]
  place: [cell: GridPosition]
  dragBelt: [start: GridPosition, end: GridPosition, direction: Direction]
  deleteCell: [cell: GridPosition]
  viewportChange: [viewport: ViewportState]
  configureAssembler: [id: string]
}>()

const canvasRef = ref<HTMLCanvasElement>()
const hoverCell = ref<GridPosition>()
const dragStart = ref<GridPosition>()
const dragEnd = ref<GridPosition>()
const isPanning = ref(false)
const isSpaceDown = ref(false)
const isDragging = ref(false)
const suppressClick = ref(false)
let panStart: { x: number; y: number; viewport: ViewportState } | undefined
let paintFrame = 0

const preview = computed<BeltPreview | undefined>(() => {
  if (!isDragging.value || !dragStart.value || !dragEnd.value || !['belt', 'tunnel'].includes(props.project.activeTool)) return undefined
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

function paint(): void {
  paintFrame = 0
  if (!canvasRef.value) return
  renderFactoryCanvas(canvasRef.value, props.project, {
    selectedEntityId: props.selectedEntityId,
    hoverCell: hoverCell.value,
    preview: preview.value
  })
}

function schedulePaint(): void {
  if (paintFrame) return
  paintFrame = window.requestAnimationFrame(paint)
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
}

function onClick(event: MouseEvent): void {
  if (isPanning.value || isDragging.value || suppressClick.value) {
    suppressClick.value = false
    return
  }
  const clicked = entityAtPoint(props.project, point(event))
  if (clicked) emit('select', clicked.id)
  else emit('place', cellFromEvent(event))
}

function onDown(event: MouseEvent): void {
  const currentPoint = point(event)
  if (event.button === 1 || event.button === 2 || isSpaceDown.value || props.project.activeTool === 'pan') {
    isPanning.value = true
    suppressClick.value = true
    panStart = { x: event.clientX, y: event.clientY, viewport: { ...props.project.viewport } }
    return
  }
  if (event.button !== 0) return
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
    schedulePaint()
    return
  }
  hoverCell.value = cellFromEvent(event)
  if (isDragging.value) dragEnd.value = hoverCell.value
  schedulePaint()
}

function onUp(event: MouseEvent): void {
  if (isPanning.value) {
    isPanning.value = false
    panStart = undefined
    return
  }
  if (!isDragging.value || !dragStart.value) return
  const end = cellFromEvent(event)
  const moved = dragStart.value.x !== end.x || dragStart.value.y !== end.y
  const start = dragStart.value
  const direction = props.project.activeDirection
  isDragging.value = false
  dragStart.value = undefined
  dragEnd.value = undefined
  if (moved && ['belt', 'tunnel'].includes(props.project.activeTool)) emit('dragBelt', start, end, direction)
  schedulePaint()
}

function onLeave(): void {
  hoverCell.value = undefined
  isDragging.value = false
  dragStart.value = undefined
  dragEnd.value = undefined
  isPanning.value = false
  panStart = undefined
  schedulePaint()
}

function onDelete(event: MouseEvent): void {
  if (isPanning.value || isSpaceDown.value) return
  emit('deleteCell', cellFromEvent(event))
}

function onWheel(event: WheelEvent): void {
  const canvas = canvasRef.value
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
  schedulePaint()
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
  () => [props.project.tick, props.project.renderAlpha, props.project.entities.length, props.project.errors.length, props.selectedEntityId, props.project.activeTool, props.project.activeDirection, props.project.viewport.x, props.project.viewport.y, props.project.viewport.zoom],
  schedulePaint,
  { deep: true }
)


watch(preview, schedulePaint, { deep: true })

onMounted(() => {
  paint()
  window.addEventListener('resize', schedulePaint)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
})

onBeforeUnmount(() => {
  if (paintFrame) window.cancelAnimationFrame(paintFrame)
  window.removeEventListener('resize', schedulePaint)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
})
</script>
