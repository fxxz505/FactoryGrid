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
    <div
      ref="stageRef"
      class="factory-canvas-stage"
      :class="{ 'is-panning': isPanning || isPanSettling }"
      @mousemove="onMove"
      @mouseup="onUp"
      @mouseleave="onLeave"
    >
      <canvas
        ref="staticCanvasARef"
        class="factory-canvas factory-canvas-static factory-render-layer"
        :class="{ active: activeRenderLayer === 0 }"
        aria-hidden="true"
      ></canvas>
      <canvas
        ref="staticCanvasBRef"
        class="factory-canvas factory-canvas-static factory-render-layer"
        :class="{ active: activeRenderLayer === 1 }"
        aria-hidden="true"
      ></canvas>
      <canvas ref="dynamicCanvasRef" class="factory-canvas-dynamic factory-render-layer active" aria-hidden="true"></canvas>
      <canvas
        ref="machineOverlayCanvasARef"
        class="factory-canvas-dynamic factory-canvas-machine-overlay factory-render-layer"
        :class="{ active: activeRenderLayer === 0 }"
        aria-hidden="true"
      ></canvas>
      <canvas
        ref="machineOverlayCanvasBRef"
        class="factory-canvas-dynamic factory-canvas-machine-overlay factory-render-layer"
        :class="{ active: activeRenderLayer === 1 }"
        aria-hidden="true"
      ></canvas>
      <canvas
        ref="inputCanvasRef"
        class="factory-canvas factory-canvas-input"
        :class="{ panning: isPanning || project.activeTool === 'pan', previewing: Boolean(preview || areaPreview || placementPreview) }"
        data-testid="factory-canvas"
        @click="onClick"
        @dblclick="onDoubleClick"
        @mousedown="onDown"
        @auxclick.prevent
        @wheel.prevent="onWheel"
        @contextmenu.prevent="onDelete"
      ></canvas>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, toRaw, watch } from 'vue'
import { buildings } from '../../data/machines'
import type { AreaPreview, BeltPreview, BuildingType, Direction, FactoryProject, GridPosition, ViewportState } from '../../models/factory'
import { beltRoute, createPlacementEntity, tunnelRoute } from '../../engine/simulation/editorActions'
import {
  CELL, areVisibleFactoryChunksCached, clearFactoryChunkRenderCache, createFactoryChunkRenderCache, createFactoryChunkSnapshot,
  createFactoryRenderScene, entityAtPoint, renderFactoryDynamicCanvas, renderFactoryMachineOverlayCanvas,
  renderFactoryStaticCanvas, screenToGrid, prewarmFactoryChunks,
  type FactoryChunkSnapshot, type FactoryRenderScene, type PlacementPreview
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

const staticCanvasARef = ref<HTMLCanvasElement>()
const staticCanvasBRef = ref<HTMLCanvasElement>()
const dynamicCanvasRef = ref<HTMLCanvasElement>()
const machineOverlayCanvasARef = ref<HTMLCanvasElement>()
const machineOverlayCanvasBRef = ref<HTMLCanvasElement>()
const inputCanvasRef = ref<HTMLCanvasElement>()
const stageRef = ref<HTMLDivElement>()
const hoverCell = ref<GridPosition>()
const dragStart = ref<GridPosition>()
const dragEnd = ref<GridPosition>()
const isPanning = ref(false)
const isPanSettling = ref(false)
const isSpaceDown = ref(false)
const isDragging = ref(false)
const suppressClick = ref(false)
let panStart: { x: number; y: number; viewport: ViewportState } | undefined
let panFrame = 0
let panDelta = { x: 0, y: 0 }
let pendingPanViewport: ViewportState | undefined
let clearPanTransformAfterPaint = false
let panCommitFrame = 0
let panCommitHandle = 0
let panCommitTimer = 0
let panCommitPreparing = false
let panCommitScene: FactoryRenderScene | undefined
const activeRenderLayer = ref<0 | 1>(0)
const PAN_STREAM_THRESHOLD = 120
const SIMULATION_STEP_MS = 170
const topologySignature = computed(() => props.project.entities.map((entity) => (
  `${entity.id}:${entity.type}:${entity.position.x}:${entity.position.y}:${entity.direction}:${entity.level ?? 1}`
)).join('|'))
let staticPaintFrame = 0
let animationFrame = 0
let prewarmHandle = 0
let scene: FactoryRenderScene | undefined
let sceneKey = ''
let sceneViewport: ViewportState | undefined
const SCENE_OVERSCAN_CELLS = 8
const chunkCache = createFactoryChunkRenderCache()
let chunkSnapshot: FactoryChunkSnapshot | undefined
let chunkTopology = ''
let lastTick = props.project.tick
let tickStartedAt = performance.now()
let lastAnimationTime = performance.now()
let renderedViewport: ViewportState = { ...props.project.viewport }

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

const previewableMachines = new Set<BuildingType>(
  buildings.map((building) => building.id).filter((type) => !['belt', 'fast-belt', 'tunnel'].includes(type))
)

const placementPreview = computed<PlacementPreview | undefined>(() => {
  if (!hoverCell.value || isPanning.value || isDragging.value) return undefined
  const type = props.project.activeTool as BuildingType
  if (!previewableMachines.has(type)) return undefined
  return {
    entity: createPlacementEntity(type, hoverCell.value, props.project.activeDirection),
    replacing: props.project.entities.some((entity) => (
      entity.position.x === hoverCell.value?.x && entity.position.y === hoverCell.value?.y
    ))
  }
})

function selectionState() {
  return {
    selectedEntityId: props.selectedEntityId,
    hoverCell: hoverCell.value,
    preview: preview.value,
    areaPreview: areaPreview.value,
    placementPreview: placementPreview.value
  }
}

function paintStatic(): void {
  if (staticPaintFrame) window.cancelAnimationFrame(staticPaintFrame)
  staticPaintFrame = 0
  const canvas = activeStaticCanvas()
  if (!canvas) return
  const project = toRaw(props.project)
  if (!chunkSnapshot || chunkTopology !== topologySignature.value) {
    chunkTopology = topologySignature.value
    chunkSnapshot = createFactoryChunkSnapshot(project)
  }
  const nextSceneKey = [
    topologySignature.value,
    project.viewport.zoom,
    canvas.clientWidth,
    canvas.clientHeight
  ].join('|')
  if (!scene || sceneKey !== nextSceneKey || !sceneCoversViewport(project.viewport)) {
    sceneKey = nextSceneKey
    sceneViewport = { ...project.viewport }
    scene = createFactoryRenderScene(canvas, project, chunkSnapshot, SCENE_OVERSCAN_CELLS)
  }
  renderFactoryStaticCanvas(canvas, project, selectionState(), scene, chunkCache, chunkSnapshot)
  const overlayCanvas = activeOverlayCanvas()
  if (overlayCanvas) {
    renderFactoryMachineOverlayCanvas(
      overlayCanvas,
      project,
      scene,
      placementPreview.value,
      chunkCache,
      chunkSnapshot
    )
  }
  renderedViewport = { ...project.viewport }
  scheduleChunkPrewarm(project.viewport)
  syncStageGrid(project.viewport)
  if (clearPanTransformAfterPaint) {
    paintDynamicFrame(lastAnimationTime, renderedViewport)
    clearPanTransformAfterPaint = false
    clearPanTransform()
    isPanSettling.value = false
  }
}

function sceneCoversViewport(viewport: ViewportState): boolean {
  if (!sceneViewport || sceneViewport.zoom !== viewport.zoom) return false
  const step = CELL * viewport.zoom
  return Math.abs(sceneViewport.x - viewport.x) / step <= SCENE_OVERSCAN_CELLS - 2
    && Math.abs(sceneViewport.y - viewport.y) / step <= SCENE_OVERSCAN_CELLS - 2
}

function scheduleStaticPaint(): void {
  if (panCommitPreparing) return
  if (!staticPaintFrame) staticPaintFrame = window.requestAnimationFrame(paintStatic)
}

function scheduleChunkPrewarm(viewport: ViewportState): void {
  if (prewarmHandle || !chunkSnapshot) return
  const stage = stageRef.value
  if (!stage) return
  const idleWindow = window as Window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
  }
  const run = () => {
    prewarmHandle = 0
    if (!chunkSnapshot || !stageRef.value) return
    const warmed = prewarmFactoryChunks(
      chunkCache,
      chunkSnapshot,
      toRaw(props.project),
      viewport,
      stageRef.value.clientWidth,
      stageRef.value.clientHeight
    )
    if (warmed) scheduleChunkPrewarm(viewport)
  }
  prewarmHandle = idleWindow.requestIdleCallback
    ? idleWindow.requestIdleCallback(run, { timeout: 120 })
    : window.setTimeout(run, 34)
}

function animateItems(time: number): void {
  animationFrame = window.requestAnimationFrame(animateItems)
  lastAnimationTime = time
  if (document.visibilityState === 'hidden') return
  paintDynamicFrame(time)
}

function paintDynamicFrame(time: number, viewport: ViewportState = renderedViewport): void {
  const canvas = dynamicCanvasRef.value
  const staticCanvas = activeStaticCanvas()
  if (!canvas || !staticCanvas) return
  if (props.project.tick !== lastTick) {
    lastTick = props.project.tick
    tickStartedAt = time
  }
  const project = toRaw(props.project)
  if (!scene) scene = createFactoryRenderScene(staticCanvas, project)
  const stepMs = SIMULATION_STEP_MS / Math.max(1, props.project.speed)
  const renderAlpha = props.project.running ? Math.min(1, Math.max(0, (time - tickStartedAt) / stepMs)) : 0
  renderFactoryDynamicCanvas(canvas, project, renderAlpha, scene, viewport)
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
  if (props.project.activeTool === 'select') {
    const clicked = entityAtPoint(props.project, point(event))
    if (clicked) emit('select', clicked.id)
    return
  }
  if (props.project.activeTool !== 'pan') emit('place', cell)
}

function canvasLayers(): HTMLCanvasElement[] {
  return [activeStaticCanvas(), dynamicCanvasRef.value, activeOverlayCanvas()]
    .filter((canvas): canvas is HTMLCanvasElement => Boolean(canvas))
}

function activeStaticCanvas(): HTMLCanvasElement | undefined {
  return activeRenderLayer.value === 0 ? staticCanvasARef.value : staticCanvasBRef.value
}

function inactiveStaticCanvas(): HTMLCanvasElement | undefined {
  return activeRenderLayer.value === 0 ? staticCanvasBRef.value : staticCanvasARef.value
}

function activeOverlayCanvas(): HTMLCanvasElement | undefined {
  return activeRenderLayer.value === 0 ? machineOverlayCanvasARef.value : machineOverlayCanvasBRef.value
}

function inactiveOverlayCanvas(): HTMLCanvasElement | undefined {
  return activeRenderLayer.value === 0 ? machineOverlayCanvasBRef.value : machineOverlayCanvasARef.value
}

function syncStageGrid(viewport: ViewportState): void {
  const stage = stageRef.value
  if (!stage) return
  const step = CELL * viewport.zoom
  stage.style.setProperty('--factory-grid-size', step + 'px')
  stage.style.setProperty('--factory-grid-x', mod(viewport.x, step) + 'px')
  stage.style.setProperty('--factory-grid-y', mod(viewport.y, step) + 'px')
}

function applyPanTransform(): void {
  panFrame = 0
  const transform = 'translate3d(' + panDelta.x + 'px, ' + panDelta.y + 'px, 0)'
  canvasLayers().forEach((canvas) => { canvas.style.transform = transform })
  if (pendingPanViewport) syncStageGrid(pendingPanViewport)
  if (panStart && pendingPanViewport && Math.max(Math.abs(panDelta.x), Math.abs(panDelta.y)) >= PAN_STREAM_THRESHOLD) {
    rebasePanViewport()
  }
}

function rebasePanViewport(): void {
  if (!panStart || !pendingPanViewport) return
  const nextViewport = pendingPanViewport
  const pointerX = panStart.x + panDelta.x
  const pointerY = panStart.y + panDelta.y
  emit('viewportChange', nextViewport)
  panStart = { x: pointerX, y: pointerY, viewport: { ...nextViewport } }
  pendingPanViewport = nextViewport
  panDelta = { x: 0, y: 0 }
  clearPanTransformAfterPaint = true
  scheduleStaticPaint()
}

function schedulePanCommit(): void {
  cancelPanCommit()
  isPanSettling.value = true
  scheduleIdlePanCommit(canFastCommitPan() ? 42 : 76)
}

function canFastCommitPan(): boolean {
  const stage = stageRef.value
  if (!stage || !chunkSnapshot || !pendingPanViewport) return false
  return areVisibleFactoryChunksCached(
    chunkCache,
    chunkSnapshot,
    pendingPanViewport,
    stage.clientWidth,
    stage.clientHeight
  )
}

function scheduleIdlePanCommit(cooldown: number): void {
  panCommitTimer = window.setTimeout(scheduleFinalPanCommit, cooldown)
}

function scheduleFinalPanCommit(): void {
  panCommitTimer = 0
  const idleWindow = window as Window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
    cancelIdleCallback?: (handle: number) => void
  }
  if (idleWindow.requestIdleCallback) {
    panCommitHandle = idleWindow.requestIdleCallback(commitPendingPan, { timeout: 80 })
  } else {
    panCommitTimer = window.setTimeout(commitPendingPan, 0)
  }
}

function cancelPanCommit(): void {
  const idleWindow = window as Window & { cancelIdleCallback?: (handle: number) => void }
  if (panCommitFrame) window.cancelAnimationFrame(panCommitFrame)
  if (panCommitHandle && idleWindow.cancelIdleCallback) idleWindow.cancelIdleCallback(panCommitHandle)
  if (panCommitTimer) window.clearTimeout(panCommitTimer)
  panCommitFrame = 0
  panCommitHandle = 0
  panCommitTimer = 0
  panCommitPreparing = false
  panCommitScene = undefined
}

function commitPendingPan(): void {
  panCommitFrame = 0
  panCommitHandle = 0
  panCommitTimer = 0
  const nextViewport = pendingPanViewport
  pendingPanViewport = undefined
  if (!nextViewport) {
    clearPanTransform()
    isPanSettling.value = false
    return
  }
  panCommitPreparing = true
  emit('viewportChange', nextViewport)
  preparePanStaticBuffer()
}

function preparePanStaticBuffer(): void {
  const buffer = inactiveStaticCanvas()
  const project = toRaw(props.project)
  if (!buffer) {
    finishPanCommitFallback()
    return
  }
  if (!chunkSnapshot || chunkTopology !== topologySignature.value) {
    chunkTopology = topologySignature.value
    chunkSnapshot = createFactoryChunkSnapshot(project)
  }
  panCommitScene = createFactoryRenderScene(buffer, project, chunkSnapshot, SCENE_OVERSCAN_CELLS)
  renderFactoryStaticCanvas(buffer, project, selectionState(), panCommitScene, chunkCache, chunkSnapshot)
  schedulePanCommitStage(preparePanOverlayBuffer)
}

function preparePanOverlayBuffer(): void {
  const buffer = inactiveOverlayCanvas()
  const project = toRaw(props.project)
  if (!buffer || !panCommitScene || !chunkSnapshot) {
    finishPanCommitFallback()
    return
  }
  renderFactoryMachineOverlayCanvas(
    buffer,
    project,
    panCommitScene,
    placementPreview.value,
    chunkCache,
    chunkSnapshot
  )
  panCommitFrame = window.requestAnimationFrame(swapPanCommitBuffers)
}

function swapPanCommitBuffers(time: number): void {
  panCommitFrame = 0
  const nextStaticCanvas = inactiveStaticCanvas()
  const nextOverlayCanvas = inactiveOverlayCanvas()
  const previousStaticCanvas = activeStaticCanvas()
  const previousOverlayCanvas = activeOverlayCanvas()
  if (!nextStaticCanvas || !nextOverlayCanvas || !previousStaticCanvas || !previousOverlayCanvas || !panCommitScene) {
    finishPanCommitFallback()
    return
  }
  nextStaticCanvas.style.transform = ''
  nextOverlayCanvas.style.transform = ''
  nextStaticCanvas.classList.add('active')
  nextOverlayCanvas.classList.add('active')
  previousStaticCanvas.classList.remove('active')
  previousOverlayCanvas.classList.remove('active')
  activeRenderLayer.value = activeRenderLayer.value === 0 ? 1 : 0
  scene = panCommitScene
  sceneViewport = { ...props.project.viewport }
  sceneKey = [topologySignature.value, props.project.viewport.zoom, nextStaticCanvas.clientWidth, nextStaticCanvas.clientHeight].join('|')
  renderedViewport = { ...props.project.viewport }
  paintDynamicFrame(time, renderedViewport)
  syncStageGrid(renderedViewport)
  previousStaticCanvas.style.transform = ''
  previousOverlayCanvas.style.transform = ''
  canvasLayers().forEach((canvas) => { canvas.style.transform = '' })
  panDelta = { x: 0, y: 0 }
  panCommitPreparing = false
  panCommitScene = undefined
  pendingPanViewport = undefined
  isPanSettling.value = false
  scheduleChunkPrewarm(renderedViewport)
}

function schedulePanCommitStage(callback: () => void): void {
  const idleWindow = window as Window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
  }
  if (idleWindow.requestIdleCallback) panCommitHandle = idleWindow.requestIdleCallback(callback, { timeout: 80 })
  else panCommitTimer = window.setTimeout(callback, 16)
}

function finishPanCommitFallback(): void {
  panCommitPreparing = false
  panCommitScene = undefined
  clearPanTransformAfterPaint = true
  paintStatic()
}

function schedulePanTransform(deltaX: number, deltaY: number): void {
  if (!panStart) return
  panDelta = { x: deltaX, y: deltaY }
  pendingPanViewport = {
    ...panStart.viewport,
    x: panStart.viewport.x + deltaX,
    y: panStart.viewport.y + deltaY
  }
  if (!panFrame) panFrame = window.requestAnimationFrame(applyPanTransform)
}

function clearPanTransform(): void {
  canvasLayers().forEach((canvas) => { canvas.style.transform = '' })
  panDelta = { x: 0, y: 0 }
}

function finishPan(): void {
  if (!panStart) return
  if (panFrame) {
    window.cancelAnimationFrame(panFrame)
    applyPanTransform()
  }
  const nextViewport = pendingPanViewport ?? panStart.viewport
  const moved = nextViewport.x !== panStart.viewport.x || nextViewport.y !== panStart.viewport.y
  isPanning.value = false
  panStart = undefined
  if (moved) {
    pendingPanViewport = nextViewport
    schedulePanCommit()
  } else {
    pendingPanViewport = undefined
    clearPanTransform()
    syncStageGrid(props.project.viewport)
  }
}

function onDown(event: MouseEvent): void {
  if (pendingPanViewport && !isPanning.value) commitPendingPan()
  else cancelPanCommit()
  cancelChunkPrewarm()
  const currentPoint = point(event)
  if (event.button === 1 || event.button === 2 || isSpaceDown.value || props.project.activeTool === 'pan') {
    isPanning.value = true
    suppressClick.value = true
    if (staticPaintFrame) {
      window.cancelAnimationFrame(staticPaintFrame)
      staticPaintFrame = 0
    }
    panStart = { x: event.clientX, y: event.clientY, viewport: { ...props.project.viewport } }
    pendingPanViewport = panStart.viewport
    return
  }
  if (event.button !== 0 || props.project.activeTool === 'paste-blueprint') return
  dragStart.value = screenToGrid(currentPoint, props.project.viewport)
  dragEnd.value = dragStart.value
  isDragging.value = true
}

function onMove(event: MouseEvent): void {
  if (isPanning.value && panStart) {
    schedulePanTransform(event.clientX - panStart.x, event.clientY - panStart.y)
    return
  }
  hoverCell.value = cellFromEvent(event)
  if (isDragging.value) dragEnd.value = hoverCell.value
  scheduleStaticPaint()
}

function onUp(event: MouseEvent): void {
  if (isPanning.value && panStart) {
    schedulePanTransform(event.clientX - panStart.x, event.clientY - panStart.y)
    finishPan()
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
  if (isPanning.value) finishPan()
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
  const canvas = inputCanvasRef.value
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

function cancelChunkPrewarm(): void {
  if (!prewarmHandle) return
  const idleWindow = window as Window & { cancelIdleCallback?: (handle: number) => void }
  if (idleWindow.cancelIdleCallback) idleWindow.cancelIdleCallback(prewarmHandle)
  else window.clearTimeout(prewarmHandle)
  prewarmHandle = 0
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
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
watch(placementPreview, scheduleStaticPaint, { deep: true })
onMounted(() => {
  paintStatic()
  animationFrame = window.requestAnimationFrame(animateItems)
  window.addEventListener('resize', scheduleStaticPaint)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
})

onBeforeUnmount(() => {
  if (staticPaintFrame) window.cancelAnimationFrame(staticPaintFrame)
  if (panFrame) window.cancelAnimationFrame(panFrame)
  if (animationFrame) window.cancelAnimationFrame(animationFrame)
  cancelChunkPrewarm()
  cancelPanCommit()
  clearFactoryChunkRenderCache(chunkCache)
  window.removeEventListener('resize', scheduleStaticPaint)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
})
</script>
