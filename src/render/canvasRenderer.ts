import { shapeById } from '../data/resources'
import type { AreaPreview, BeltPreview, Direction, FactoryEntity, FactoryProject, GridPosition, ShapeId, ViewportState } from '../models/factory'
import { entityConnectionDirections, machineGeometryFor, machinePortRoles, planBeltSprite, type BeltSpritePlan, type MachineGeometryStyle, type MachinePort } from './factoryAssets'

export const CELL = 46
export const BELT_ITEM_RADIUS = 10.5
const INPUT_PORT_COLOR = '#86bd73'
const OUTPUT_PORT_COLOR = '#6fa9c8'
export const DEFAULT_VIEWPORT: ViewportState = { x: 130, y: 88, zoom: 1 }

export interface CanvasSelection {
  selectedEntityId?: string
  hoverCell?: GridPosition
  preview?: BeltPreview
  areaPreview?: AreaPreview
}


export function gridToScreen(position: GridPosition, viewport: ViewportState = DEFAULT_VIEWPORT): { x: number; y: number } {
  return {
    x: viewport.x + position.x * CELL * viewport.zoom,
    y: viewport.y + position.y * CELL * viewport.zoom
  }
}

export function screenToGrid(point: { x: number; y: number }, viewport: ViewportState = DEFAULT_VIEWPORT): GridPosition {
  return {
    x: Math.floor((point.x - viewport.x) / (CELL * viewport.zoom)),
    y: Math.floor((point.y - viewport.y) / (CELL * viewport.zoom))
  }
}

export function entityAtPoint(project: FactoryProject, point: { x: number; y: number }): FactoryEntity | undefined {
  const cell = screenToGrid(point, project.viewport ?? DEFAULT_VIEWPORT)
  return project.entities.find((entity) => entity.position.x === cell.x && entity.position.y === cell.y)
}

export interface FactoryRenderScene {
  visible: FactoryEntity[]
  belts: FactoryEntity[]
  visibleIds: Set<string>
  entityIndex: Map<string, FactoryEntity>
  beltPlans: Map<string, BeltSpritePlan>
  beltInputs: Map<string, Direction>
}

export function createFactoryRenderScene(canvas: HTMLCanvasElement, project: FactoryProject): FactoryRenderScene {
  const viewport = project.viewport ?? DEFAULT_VIEWPORT
  const visible = visibleEntities(project, canvas.clientWidth, canvas.clientHeight, viewport)
  const belts = visible.filter((entity) => entity.kind === 'belt')
  const entityIndex = new Map(project.entities.map((entity) => [positionKey(entity.position), entity]))
  const beltPlans = new Map(belts.map((entity) => [entity.id, planBeltSprite(project, entity)]))
  const beltInputs = new Map(belts.map((entity) => [entity.id, beltInputDirection(project, entity, entityIndex)]))
  return { visible, belts, visibleIds: new Set(visible.map((entity) => entity.id)), entityIndex, beltPlans, beltInputs }
}

export function renderFactoryStaticCanvas(
  canvas: HTMLCanvasElement,
  project: FactoryProject,
  selection: CanvasSelection,
  scene: FactoryRenderScene = createFactoryRenderScene(canvas, project)
): void {
  const ctx = prepareCanvas(canvas, project)
  if (!ctx) return
  const viewport = project.viewport ?? DEFAULT_VIEWPORT
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight)
  drawGrid(ctx, canvas.clientWidth, canvas.clientHeight, viewport, selection.hoverCell)
  drawTunnelLinks(ctx, project, viewport, scene.visibleIds)
  if (selection.preview) drawBeltPreview(ctx, viewport, selection.preview)
  if (selection.areaPreview) drawAreaPreview(ctx, viewport, selection.areaPreview)
  scene.belts.forEach((entity) => drawEntity(ctx, project, entity, selection.selectedEntityId === entity.id, viewport, scene))
  scene.visible
    .filter((entity) => entity.kind !== 'belt')
    .forEach((entity) => drawEntity(ctx, project, entity, selection.selectedEntityId === entity.id, viewport, scene))
}

export function renderFactoryDynamicCanvas(
  canvas: HTMLCanvasElement,
  project: FactoryProject,
  renderAlpha: number,
  scene: FactoryRenderScene = createFactoryRenderScene(canvas, project)
): void {
  const ctx = prepareCanvas(canvas, project)
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight)
  renderDynamicItems(ctx, project, renderAlpha, scene)
}

export function renderFactoryMachineOverlayCanvas(
  canvas: HTMLCanvasElement,
  project: FactoryProject,
  scene: FactoryRenderScene = createFactoryRenderScene(canvas, project)
): void {
  const ctx = prepareCanvas(canvas, project)
  if (!ctx) return
  const viewport = project.viewport ?? DEFAULT_VIEWPORT
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight)
  scene.visible
    .filter((entity) => entity.kind !== 'belt')
    .forEach((entity) => drawMachineOccluder(ctx, entity, viewport))
}

function drawMachineOccluder(ctx: CanvasRenderingContext2D, entity: FactoryEntity, viewport: ViewportState): void {
  const screen = gridToScreen(entity.position, viewport)
  const scale = viewport.zoom
  const size = CELL * scale
  const style = machineGeometryFor(entity.type)
  const body = size * 0.68 * style.scale
  const bodyX = screen.x + (size - body) / 2
  const bodyY = screen.y + (size - body) / 2

  ctx.save()
  roundedRectPath(ctx, bodyX, bodyY, body, body, 6 * scale)
  ctx.fillStyle = style.body
  ctx.fill()
  ctx.strokeStyle = style.rim
  ctx.lineWidth = 2 * scale
  ctx.stroke()
  drawMachineCore(ctx, style, screen.x + size / 2, screen.y + size / 2, body, scale, entity.direction)
  ctx.restore()
}

export function renderFactoryCanvas(canvas: HTMLCanvasElement, project: FactoryProject, selection: CanvasSelection): void {
  const scene = createFactoryRenderScene(canvas, project)
  renderFactoryStaticCanvas(canvas, project, selection, scene)
  const ctx = canvas.getContext('2d')
  if (ctx) renderDynamicItems(ctx, project, 0, scene)
}

function prepareCanvas(canvas: HTMLCanvasElement, project: FactoryProject): CanvasRenderingContext2D | undefined {
  const ctx = canvas.getContext('2d') ?? undefined
  if (!ctx) return undefined
  const ratioCap = project.performance?.quality === 'performance' ? 1.25 : 2
  const ratio = Math.min(window.devicePixelRatio || 1, ratioCap)
  const width = Math.round(canvas.clientWidth * ratio)
  const height = Math.round(canvas.clientHeight * ratio)
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  return ctx
}

function renderDynamicItems(
  ctx: CanvasRenderingContext2D,
  project: FactoryProject,
  renderAlpha: number,
  scene: FactoryRenderScene
): void {
  const viewport = project.viewport ?? DEFAULT_VIEWPORT
  const radius = BELT_ITEM_RADIUS * viewport.zoom
  const groups = new Map<ShapeId, Array<{ x: number; y: number }>>()

  scene.belts.forEach((entity) => {
    const runtime = project.belts[entity.id]
    const screen = gridToScreen(entity.position, viewport)
    const size = CELL * viewport.zoom
    const input = scene.beltInputs.get(entity.id)
    if (runtime?.item) addShapePoint(groups, runtime.item.shape, beltItemPoint(project, entity, screen.x, screen.y, size, renderAlpha, input))
  })

  groups.forEach((points, shape) => drawShapeBatch(ctx, shape, points, radius))
}

function addShapePoint(groups: Map<ShapeId, Array<{ x: number; y: number }>>, shape: ShapeId, point: { x: number; y: number }): void {
  const points = groups.get(shape)
  if (points) points.push(point)
  else groups.set(shape, [point])
}

function drawShapeBatch(
  ctx: CanvasRenderingContext2D,
  shape: ShapeId,
  points: Array<{ x: number; y: number }>,
  radius: number
): void {
  const def = shapeById[shape]
  if (!def) return
  ctx.save()
  ctx.fillStyle = def.color
  ctx.strokeStyle = 'rgba(38,52,59,0.28)'
  ctx.lineWidth = Math.max(1, radius * 0.09)
  ctx.beginPath()
  points.forEach((point) => appendShapePath(ctx, shape, point.x, point.y, radius))
  ctx.fill()
  ctx.stroke()

  if (def.accent && shouldUseShapeAccent(shape)) {
    points.forEach((point) => drawShape(ctx, shape, point.x, point.y, radius))
  }
  ctx.restore()
}

function appendShapePath(ctx: CanvasRenderingContext2D, shape: ShapeId, x: number, y: number, radius: number): void {
  const tier = shapeById[shape]?.tier
  if (tier !== undefined) {
    appendTierPath(ctx, tier, x, y, radius)
    return
  }
  if (shape.includes('circle')) {
    ctx.moveTo(x + radius, y)
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    return
  }
  if (shape.includes('square')) {
    ctx.rect(x - radius, y - radius, radius * 2, radius * 2)
    return
  }
  if (shape.includes('diamond')) {
    appendRegularPolygon(ctx, 4, x, y, radius * 1.25, Math.PI / 4)
    return
  }
  if (shape.includes('star')) {
    appendStarPath(ctx, x, y, radius)
    return
  }
  ctx.moveTo(x + radius, y)
  ctx.arc(x, y, radius, 0, Math.PI * 2)
}

function appendTierPath(ctx: CanvasRenderingContext2D, tier: number, x: number, y: number, radius: number): void {
  if (tier === 0) {
    ctx.moveTo(x + radius, y)
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    return
  }
  appendRegularPolygon(ctx, tier + 2, x, y, radius * 1.08, tier === 2 ? -Math.PI / 4 : -Math.PI / 2)
}

function appendRegularPolygon(
  ctx: CanvasRenderingContext2D,
  sides: number,
  x: number,
  y: number,
  radius: number,
  rotation = -Math.PI / 2
): void {
  for (let index = 0; index < sides; index += 1) {
    const angle = rotation + index * Math.PI * 2 / sides
    const px = x + Math.cos(angle) * radius
    const py = y + Math.sin(angle) * radius
    if (index === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
}
function appendStarPath(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
  for (let index = 0; index < 10; index += 1) {
    const angle = -Math.PI / 2 + index * Math.PI / 5
    const pointRadius = index % 2 === 0 ? radius : radius * 0.45
    const px = x + Math.cos(angle) * pointRadius
    const py = y + Math.sin(angle) * pointRadius
    if (index === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
}
function visibleGridBounds(width: number, height: number, viewport: ViewportState): { minX: number; maxX: number; minY: number; maxY: number } {
  const step = CELL * viewport.zoom
  return {
    minX: Math.floor(-viewport.x / step) - 1,
    maxX: Math.ceil((width - viewport.x) / step) + 1,
    minY: Math.floor(-viewport.y / step) - 1,
    maxY: Math.ceil((height - viewport.y) / step) + 1
  }
}

function visibleEntities(project: FactoryProject, width: number, height: number, viewport: ViewportState): FactoryEntity[] {
  const bounds = visibleGridBounds(width, height, viewport)
  return project.entities.filter((entity) => (
    entity.position.x >= bounds.minX && entity.position.x <= bounds.maxX
    && entity.position.y >= bounds.minY && entity.position.y <= bounds.maxY
  ))
}

function drawAreaPreview(ctx: CanvasRenderingContext2D, viewport: ViewportState, preview: AreaPreview): void {
  const minX = Math.min(preview.start.x, preview.end.x)
  const maxX = Math.max(preview.start.x, preview.end.x)
  const minY = Math.min(preview.start.y, preview.end.y)
  const maxY = Math.max(preview.start.y, preview.end.y)
  const screen = gridToScreen({ x: minX, y: minY }, viewport)
  const step = CELL * viewport.zoom
  const width = (maxX - minX + 1) * step
  const height = (maxY - minY + 1) * step
  const colors = {
    copy: ['rgba(23, 128, 112, 0.16)', '#178070'],
    delete: ['rgba(198, 79, 72, 0.16)', '#c64f48'],
    upgrade: ['rgba(202, 166, 57, 0.18)', '#a9821f']
  } as const
  const [fill, stroke] = colors[preview.mode]
  ctx.save()
  ctx.fillStyle = fill
  ctx.strokeStyle = stroke
  ctx.lineWidth = Math.max(2, 2 * viewport.zoom)
  ctx.setLineDash([7 * viewport.zoom, 5 * viewport.zoom])
  ctx.fillRect(screen.x, screen.y, width, height)
  ctx.strokeRect(screen.x, screen.y, width, height)
  ctx.restore()
}
function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number, viewport: ViewportState, hover?: GridPosition): void {
  const bg = ctx.createLinearGradient(0, 0, width, height)
  bg.addColorStop(0, '#edf0e9')
  bg.addColorStop(0.54, '#e7e1d3')
  bg.addColorStop(1, '#dce6e3')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, width, height)


const step = CELL * viewport.zoom
  const startX = mod(viewport.x, step)
  const startY = mod(viewport.y, step)
  ctx.strokeStyle = 'rgba(39, 52, 58, 0.16)'
  ctx.lineWidth = 1
  for (let x = startX; x < width; x += step) {
    ctx.beginPath()
    ctx.moveTo(x + 0.5, 0)
    ctx.lineTo(x + 0.5, height)
    ctx.stroke()
  }
  for (let y = startY; y < height; y += step) {
    ctx.beginPath()
    ctx.moveTo(0, y + 0.5)
    ctx.lineTo(width, y + 0.5)
    ctx.stroke()
  }

  ctx.strokeStyle = 'rgba(38, 52, 59, 0.38)'
  ctx.lineWidth = 2
  const origin = gridToScreen({ x: 0, y: 0 }, viewport)
  ctx.beginPath()
  ctx.moveTo(origin.x, 0)
  ctx.lineTo(origin.x, height)
  ctx.moveTo(0, origin.y)
  ctx.lineTo(width, origin.y)
  ctx.stroke()

  if (hover) {
    const screen = gridToScreen(hover, viewport)
    ctx.fillStyle = 'rgba(23, 126, 114, 0.16)'
    ctx.fillRect(screen.x, screen.y, step, step)
  }
}

function drawBeltPreview(ctx: CanvasRenderingContext2D, viewport: ViewportState, preview: BeltPreview): void {
  const step = CELL * viewport.zoom
  const project = previewProject(preview)
  if (preview.tool === 'tunnel' && preview.route.length > 1) drawTunnelPreviewLink(ctx, preview.route, viewport)
  preview.route.forEach((segment, index) => {
    const screen = gridToScreen(segment.position, viewport)
    const size = step
    const entity = project.entities[index]
    ctx.save()
    ctx.globalAlpha = 0.76
    if (preview.tool === 'tunnel') drawMachineAsset(ctx, project, entity, screen.x, screen.y, size, viewport.zoom)
    else drawBeltAsset(ctx, screen.x, screen.y, size, planBeltSprite(project, entity))
    ctx.strokeStyle = preview.valid ? 'rgba(23, 128, 112, 0.72)' : 'rgba(198, 79, 72, 0.82)'
    ctx.setLineDash(index % 2 === 0 ? [6, 5] : [3, 4])
    ctx.lineWidth = 2
    ctx.strokeRect(screen.x + 2 * viewport.zoom, screen.y + 2 * viewport.zoom, size - 4 * viewport.zoom, size - 4 * viewport.zoom)
    ctx.setLineDash([])
    ctx.restore()
  })
}

function previewProject(preview: BeltPreview): FactoryProject {
  const type = preview.tool === 'tunnel' ? 'tunnel' : 'belt'
  return {
    id: 'preview',
    name: 'preview',
    tick: 0,
    running: false,
    renderAlpha: 0,
    speed: 1,
    activeTool: type,
    activeDirection: preview.direction,
    viewport: DEFAULT_VIEWPORT,
    goals: [],
    unlocked: [],
    entities: preview.route.map((segment, index) => ({
      id: `preview-${index}`,
      kind: type === 'belt' ? 'belt' : 'processor',
      type,
      label: 'preview',
      position: segment.position,
      direction: segment.direction,
      input: [],
      output: [],
      progress: 0,
      status: 'idle'
    })),
    belts: {},
    metrics: { delivered: {}, produced: {}, trashed: {}, beltItems: 0, activeBuildings: 0, bottlenecks: [], recentDelivery: [] },
    research: { points: 0, delivered: {}, progress: {}, consumed: {}, completed: [], maxMachineLevel: 1 },
    performance: { fps: 60, frameTime: 16.7, quality: 'high' },
    errors: [],
    events: [],
    blueprints: [],
    history: []
  }
}

function drawTunnelLinks(ctx: CanvasRenderingContext2D, project: FactoryProject, viewport: ViewportState, visibleIds?: Set<string>): void {
  const handled = new Set<string>()
  project.entities.filter((entity) => entity.type === 'tunnel').forEach((entrance) => {
    if (visibleIds && !visibleIds.has(entrance.id)) return
    if (handled.has(entrance.id)) return
    const exit = findTunnelExit(project, entrance)
    if (!exit || handled.has(exit.id)) return
    handled.add(entrance.id)
    handled.add(exit.id)
    drawTunnelLink(ctx, entrance.position, exit.position, viewport)
  })
}

function drawTunnelPreviewLink(ctx: CanvasRenderingContext2D, route: Array<{ position: GridPosition; direction: Direction }>, viewport: ViewportState): void {
  drawTunnelLink(ctx, route[0].position, route[route.length - 1].position, viewport)
}

function drawTunnelLink(ctx: CanvasRenderingContext2D, start: GridPosition, end: GridPosition, viewport: ViewportState): void {
  const a = cellCenter(start, viewport)
  const b = cellCenter(end, viewport)
  const scale = viewport.zoom
  ctx.save()
  ctx.strokeStyle = 'rgba(78, 88, 93, 0.30)'
  ctx.lineWidth = Math.max(3, 5 * scale)
  ctx.lineCap = 'round'
  ctx.setLineDash([7 * scale, 6 * scale])
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.strokeStyle = 'rgba(255, 252, 245, 0.70)'
  ctx.lineWidth = Math.max(1, 2 * scale)
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.stroke()
  ctx.restore()
}

function findTunnelExit(project: FactoryProject, entrance: FactoryEntity): FactoryEntity | undefined {
  for (let distance = 2; distance <= 5; distance += 1) {
    const candidate = entityAtCell(project, offsetPosition(entrance.position, entrance.direction, distance))
    if (candidate?.type === 'tunnel' && candidate.direction === entrance.direction) return candidate
  }
  return undefined
}
function drawEntity(ctx: CanvasRenderingContext2D, project: FactoryProject, entity: FactoryEntity, selected: boolean, viewport: ViewportState, scene?: FactoryRenderScene): void {
  const screen = gridToScreen(entity.position, viewport)
  const scale = viewport.zoom
  const x = screen.x
  const y = screen.y
  const size = CELL * scale
  ctx.save()

  if (entity.kind === 'belt') drawBelt(ctx, project, entity, x, y, size, scene?.beltPlans.get(entity.id))
  else drawMachineAsset(ctx, project, entity, x, y, size, scale)

  if (selected) {
    ctx.strokeStyle = '#15796f'
    ctx.lineWidth = 3 * scale
    ctx.strokeRect(x + 2 * scale, y + 2 * scale, size - 4 * scale, size - 4 * scale)
  }

  ctx.restore()
}
function drawBelt(
  ctx: CanvasRenderingContext2D,
  project: FactoryProject,
  entity: FactoryEntity,
  x: number,
  y: number,
  size: number,
  cachedPlan?: BeltSpritePlan
): void {
  const plan = cachedPlan ?? planBeltSprite(project, entity)
  drawBeltAsset(ctx, x, y, size, plan, entity.type === 'fast-belt')
}

function beltItemPoint(
  project: FactoryProject,
  entity: FactoryEntity,
  x: number,
  y: number,
  size: number,
  renderAlpha = 0,
  cachedInput?: Direction
): { x: number; y: number } {
  const runtime = project.belts[entity.id]
  const enteredTick = runtime?.enteredTick ?? runtime?.lastMovedTick ?? project.tick
  const ticksOnBelt = Math.max(0, project.tick - enteredTick)
  const progress = clamp01((ticksOnBelt + beltFrameProgress(project, renderAlpha)) / beltMoveInterval(entity))
  const input = cachedInput ?? resolveBeltInputDirection(project, entity)
  return beltPathPoint(x, y, size, input, entity.direction, progress)
}

export function beltPathPoint(
  x: number,
  y: number,
  size: number,
  input: Direction,
  output: Direction,
  progress: number
): { x: number; y: number } {
  const from = edgePoint(x, y, size, input)
  const center = { x: x + size / 2, y: y + size / 2 }
  const to = edgePoint(x, y, size, output)
  const t = clamp01(progress)

  if (input === output) return lerpPoint(center, to, t)
  if (input === oppositeDirection(output)) return lerpPoint(from, to, t)
  if (t < 0.5) return lerpPoint(from, center, t / 0.5)
  return lerpPoint(center, to, (t - 0.5) / 0.5)
}
function beltMoveInterval(entity: FactoryEntity): number {
  return entity.type === 'fast-belt' ? 1 : 2
}

function beltFrameProgress(project: FactoryProject, renderAlpha = 0): number {
  if (!project.running) return 0
  return clamp01(renderAlpha)
}

export function resolveBeltInputDirection(
  project: FactoryProject,
  entity: FactoryEntity,
  entityIndex?: Map<string, FactoryEntity>
): Direction {
  const index = entityIndex ?? new Map(project.entities.map((candidate) => [positionKey(candidate.position), candidate]))
  const incoming = directions().find((direction) => {
    if (direction === entity.direction) return false
    const neighbor = index.get(positionKey(offsetPosition(entity.position, direction)))
    return !!neighbor && canFeedPosition(neighbor, entity.position, oppositeDirection(direction))
  })
  return incoming ?? oppositeDirection(entity.direction)
}

function beltInputDirection(project: FactoryProject, entity: FactoryEntity, entityIndex?: Map<string, FactoryEntity>): Direction {
  return resolveBeltInputDirection(project, entity, entityIndex)
}

function canFeedPosition(entity: FactoryEntity, position: GridPosition, portDirection: Direction): boolean {
  if (entity.kind === 'belt') {
    const next = offsetPosition(entity.position, entity.direction)
    return next.x === position.x && next.y === position.y
  }
  return machinePortRoles(entity).some((port) => port.role === 'output' && port.direction === portDirection)
}

function directions(): Direction[] {
  return ['north', 'east', 'south', 'west']
}

function edgePoint(x: number, y: number, size: number, direction: Direction): { x: number; y: number } {
  const inset = size * 0.03
  if (direction === 'east') return { x: x + size - inset, y: y + size / 2 }
  if (direction === 'west') return { x: x + inset, y: y + size / 2 }
  if (direction === 'south') return { x: x + size / 2, y: y + size - inset }
  return { x: x + size / 2, y: y + inset }
}

function lerpPoint(from: { x: number; y: number }, to: { x: number; y: number }, t: number): { x: number; y: number } {
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function oppositeDirection(direction: Direction): Direction {
  if (direction === 'north') return 'south'
  if (direction === 'south') return 'north'
  if (direction === 'west') return 'east'
  return 'west'
}

function drawMachineAsset(ctx: CanvasRenderingContext2D, project: FactoryProject, entity: FactoryEntity, x: number, y: number, size: number, scale: number): void {
  const style = machineGeometryFor(entity.type)
  const cx = x + size / 2
  const cy = y + size / 2
  const body = size * 0.68 * style.scale
  const bodyX = cx - body / 2
  const bodyY = cy - body / 2

  ctx.save()
  ctx.shadowColor = 'rgba(31, 45, 54, 0.16)'
  ctx.shadowBlur = 8 * scale
  ctx.shadowOffsetY = 3 * scale
  drawMachineConnector(ctx, project, entity, x, y, size, style)
  ctx.shadowColor = 'transparent'

  roundedRectPath(ctx, bodyX, bodyY, body, body, 6 * scale)
  ctx.fillStyle = style.body
  ctx.fill()
  ctx.strokeStyle = style.rim
  ctx.lineWidth = 2 * scale
  ctx.stroke()

  drawMachineCore(ctx, style, cx, cy, body, scale, entity.direction)
  ctx.restore()
}

function drawMachineConnector(ctx: CanvasRenderingContext2D, project: FactoryProject, entity: FactoryEntity, x: number, y: number, size: number, style: MachineGeometryStyle): void {
  const cx = x + size / 2
  const cy = y + size / 2
  const track = size * 0.62
  const rimTrack = track + size * 0.12
  const directions = entityConnectionDirections(project, entity)
  const ports = machinePortRoles(entity)

  ctx.save()
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.fillStyle = '#bfc4c7'
  directions.forEach((direction) => drawConnectorArm(ctx, cx, cy, x, y, size, direction, rimTrack))
  ctx.fillStyle = style.body === '#dbeee9' ? '#dbeee9' : '#dfe3e5'
  directions.forEach((direction) => drawConnectorArm(ctx, cx, cy, x, y, size, direction, track))
  ctx.strokeStyle = '#9ea5a9'
  ctx.lineWidth = Math.max(1.2, size * 0.03)
  directions.forEach((direction) => drawConnectorRail(ctx, cx, cy, x, y, size, direction, track))
  drawMachinePortHousings(ctx, ports, x, y, size, track)
  ctx.restore()
}

function drawMachinePortHousings(
  ctx: CanvasRenderingContext2D,
  ports: MachinePort[],
  x: number,
  y: number,
  size: number,
  track: number
): void {
  const length = size * 0.34
  const thickness = track * 0.52

  ports.forEach((port) => {
    const center = portHousingCenter(x, y, size, port.direction)
    ctx.save()
    ctx.translate(center.x, center.y)
    ctx.rotate(directionToRotation(port.direction))
    drawMachinePortHousing(ctx, length, thickness, port.role)
    ctx.restore()
  })
}

function drawMachinePortHousing(
  ctx: CanvasRenderingContext2D,
  length: number,
  thickness: number,
  role: MachinePort['role']
): void {
  ctx.beginPath()
  ctx.moveTo(-length * 0.52, -thickness * 0.42)
  ctx.lineTo(length * 0.28, -thickness * 0.36)
  ctx.lineTo(length * 0.5, -thickness * 0.2)
  ctx.lineTo(length * 0.5, thickness * 0.2)
  ctx.lineTo(length * 0.28, thickness * 0.36)
  ctx.lineTo(-length * 0.52, thickness * 0.42)
  ctx.closePath()
  ctx.fillStyle = '#667176'
  ctx.fill()
  ctx.strokeStyle = '#4d595e'
  ctx.lineWidth = Math.max(1, thickness * 0.1)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(-length * 0.34, -thickness * 0.26)
  ctx.lineTo(length * 0.2, -thickness * 0.23)
  ctx.lineTo(length * 0.35, -thickness * 0.12)
  ctx.lineTo(length * 0.35, thickness * 0.12)
  ctx.lineTo(length * 0.2, thickness * 0.23)
  ctx.lineTo(-length * 0.34, thickness * 0.26)
  ctx.closePath()
  ctx.fillStyle = 'rgba(255, 255, 252, 0.08)'
  ctx.fill()

  drawPortDirectionTriangle(ctx, length, thickness, role)
}

function drawPortDirectionTriangle(
  ctx: CanvasRenderingContext2D,
  length: number,
  thickness: number,
  role: MachinePort['role']
): void {
  const direction = role === 'input' ? -1 : 1
  const centerX = role === 'input' ? -length * 0.02 : length * 0.04
  const halfLength = length * 0.25
  const halfHeight = thickness * 0.28

  ctx.beginPath()
  ctx.moveTo(centerX + direction * halfLength, 0)
  ctx.lineTo(centerX - direction * halfLength, -halfHeight)
  ctx.lineTo(centerX - direction * halfLength, halfHeight)
  ctx.closePath()
  ctx.fillStyle = role === 'input' ? INPUT_PORT_COLOR : OUTPUT_PORT_COLOR
  ctx.fill()
  ctx.strokeStyle = 'rgba(42, 54, 58, 0.42)'
  ctx.lineWidth = Math.max(0.7, thickness * 0.045)
  ctx.stroke()
}

function portHousingCenter(x: number, y: number, size: number, direction: Direction): { x: number; y: number } {
  if (direction === 'east') return { x: x + size, y: y + size / 2 }
  if (direction === 'west') return { x, y: y + size / 2 }
  if (direction === 'south') return { x: x + size / 2, y: y + size }
  return { x: x + size / 2, y }
}
function drawConnectorArm(ctx: CanvasRenderingContext2D, cx: number, cy: number, x: number, y: number, size: number, direction: Direction, track: number): void {
  const overlap = Math.max(1, size * 0.025)
  if (direction === 'east') ctx.fillRect(cx - overlap, cy - track / 2, x + size - cx + overlap * 2, track)
  else if (direction === 'west') ctx.fillRect(x - overlap, cy - track / 2, cx - x + overlap * 2, track)
  else if (direction === 'south') ctx.fillRect(cx - track / 2, cy - overlap, track, y + size - cy + overlap * 2)
  else ctx.fillRect(cx - track / 2, y - overlap, track, cy - y + overlap * 2)
}

function drawConnectorRail(ctx: CanvasRenderingContext2D, cx: number, cy: number, x: number, y: number, size: number, direction: Direction, track: number): void {
  const offset = track * 0.47
  const overlap = Math.max(1, size * 0.025)
  ctx.beginPath()
  if (direction === 'east' || direction === 'west') {
    const from = direction === 'east' ? cx : x - overlap
    const to = direction === 'east' ? x + size + overlap : cx
    ctx.moveTo(from, cy - offset)
    ctx.lineTo(to, cy - offset)
    ctx.moveTo(from, cy + offset)
    ctx.lineTo(to, cy + offset)
  } else {
    const from = direction === 'south' ? cy : y - overlap
    const to = direction === 'south' ? y + size + overlap : cy
    ctx.moveTo(cx - offset, from)
    ctx.lineTo(cx - offset, to)
    ctx.moveTo(cx + offset, from)
    ctx.lineTo(cx + offset, to)
  }
  ctx.stroke()
}
function drawMachineCore(ctx: CanvasRenderingContext2D, style: MachineGeometryStyle, cx: number, cy: number, body: number, scale: number, direction: Direction): void {
  const r = body * 0.18
  ctx.fillStyle = style.accent
  ctx.strokeStyle = style.rim
  ctx.lineWidth = 1.5 * scale

  if (style.core === 'circle') {
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  } else if (style.core === 'square') {
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
    ctx.strokeRect(cx - r, cy - r, r * 2, r * 2)
  } else if (style.core === 'diamond') {
    ctx.beginPath()
    ctx.moveTo(cx, cy - r * 1.25)
    ctx.lineTo(cx + r * 1.25, cy)
    ctx.lineTo(cx, cy + r * 1.25)
    ctx.lineTo(cx - r * 1.25, cy)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  } else if (style.core === 'ring') {
    ctx.beginPath()
    ctx.arc(cx, cy, r * 1.25, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2)
    ctx.fill()
  } else if (style.core === 'stack') {
    for (let i = -1; i <= 1; i += 1) {
      roundedRectPath(ctx, cx - body * 0.23, cy + i * body * 0.14 - body * 0.04, body * 0.46, body * 0.08, 2 * scale)
      ctx.fill()
    }
  } else if (style.core === 'split' || style.core === 'merge') {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(directionToRotation(direction))
    ctx.lineCap = 'round'
    ctx.lineWidth = 3 * scale
    ctx.beginPath()
    if (style.core === 'split') {
      ctx.moveTo(-body * 0.24, 0)
      ctx.lineTo(0, 0)
      ctx.lineTo(0, -body * 0.24)
      ctx.moveTo(0, 0)
      ctx.lineTo(0, body * 0.24)
    } else {
      ctx.moveTo(0, -body * 0.24)
      ctx.lineTo(0, 0)
      ctx.lineTo(body * 0.24, 0)
      ctx.moveTo(0, body * 0.24)
      ctx.lineTo(0, 0)
    }
    ctx.stroke()
    ctx.restore()
  } else if (style.core === 'pipe') {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(directionToRotation(direction))
    ctx.lineWidth = 4 * scale
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(-body * 0.23, body * 0.02)
    ctx.quadraticCurveTo(-body * 0.12, -body * 0.22, 0, body * 0.02)
    ctx.quadraticCurveTo(body * 0.12, body * 0.26, body * 0.23, body * 0.02)
    ctx.stroke()
    ctx.fillStyle = 'rgba(255, 252, 245, 0.55)'
    roundedRectPath(ctx, -body * 0.26, body * 0.12, body * 0.52, body * 0.08, 2 * scale)
    ctx.fill()
    ctx.restore()
  } else if (style.core === 'bars') {
    for (let i = -1; i <= 1; i += 1) ctx.fillRect(cx - body * 0.22, cy + i * body * 0.12 - 1 * scale, body * 0.44, 2 * scale)
  }
}

function drawBeltAsset(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, plan: BeltSpritePlan, fast = false): void {
  const track = size * 0.62
  const cx = x + size / 2
  const cy = y + size / 2
  const connections = plan.connections.length ? plan.connections : ['east'] as Direction[]

  ctx.save()
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.shadowColor = 'rgba(20, 22, 21, 0.18)'
  ctx.shadowBlur = size * 0.05
  ctx.shadowOffsetY = size * 0.03

  ctx.fillStyle = fast ? '#78938f' : '#bfc4c7'
  connections.forEach((direction) => drawBeltArm(ctx, x, y, size, direction, track + size * 0.12))
  roundRect(ctx, cx - (track + size * 0.12) / 2, cy - (track + size * 0.12) / 2, track + size * 0.12, track + size * 0.12, size * 0.08)
  ctx.fill()

  ctx.shadowColor = 'transparent'
  ctx.fillStyle = fast ? '#b8d1cc' : '#dfe3e5'
  connections.forEach((direction) => drawBeltArm(ctx, x, y, size, direction, track))
  roundRect(ctx, cx - track / 2, cy - track / 2, track, track, size * 0.07)
  ctx.fill()

  drawBeltSideRails(ctx, x, y, size, connections, track)
  drawBeltPlates(ctx, x, y, size, connections)
  drawBeltGuideMarks(ctx, x, y, size, plan.direction, connections.length)
  ctx.restore()
}

function drawBeltArm(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, direction: Direction, track: number): void {
  const cx = x + size / 2
  const cy = y + size / 2
  if (direction === 'east') ctx.fillRect(cx - 1, cy - track / 2, size / 2 + 1.5, track)
  else if (direction === 'west') ctx.fillRect(x - 0.5, cy - track / 2, size / 2 + 1.5, track)
  else if (direction === 'south') ctx.fillRect(cx - track / 2, cy - 1, track, size / 2 + 1.5)
  else ctx.fillRect(cx - track / 2, y - 0.5, track, size / 2 + 1.5)
}

function drawBeltSideRails(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, connections: Direction[], track: number): void {
  const cx = x + size / 2
  const cy = y + size / 2
  const railOffset = track * 0.47
  ctx.strokeStyle = '#9ea5a9'
  ctx.lineWidth = Math.max(1.5, size * 0.045)
  connections.forEach((direction) => {
    ctx.beginPath()
    if (direction === 'east' || direction === 'west') {
      const from = direction === 'east' ? cx : x
      const to = direction === 'east' ? x + size : cx
      ctx.moveTo(from, cy - railOffset)
      ctx.lineTo(to, cy - railOffset)
      ctx.moveTo(from, cy + railOffset)
      ctx.lineTo(to, cy + railOffset)
    } else {
      const from = direction === 'south' ? cy : y
      const to = direction === 'south' ? y + size : cy
      ctx.moveTo(cx - railOffset, from)
      ctx.lineTo(cx - railOffset, to)
      ctx.moveTo(cx + railOffset, from)
      ctx.lineTo(cx + railOffset, to)
    }
    ctx.stroke()
  })
}

function drawBeltPlates(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, connections: Direction[]): void {
  ctx.strokeStyle = '#c4c9cc'
  ctx.lineWidth = Math.max(1, size * 0.03)
  connections.forEach((direction) => {
    for (let i = 0; i < 4; i += 1) {
      const t = (i + 0.5) / 4
      drawBeltPlateMark(ctx, x, y, size, direction, t)
    }
  })
}


function drawBeltPlateMark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, direction: Direction, t: number): void {
  const cx = direction === 'east' || direction === 'west' ? (direction === 'east' ? x + size * t : x + size * (1 - t)) : x + size / 2
  const cy = direction === 'south' || direction === 'north' ? (direction === 'south' ? y + size * t : y + size * (1 - t)) : y + size / 2
  const long = size * 0.22
  const short = size * 0.035
  ctx.fillStyle = '#c7cccf'
  ctx.globalAlpha = 0.6
  if (direction === 'east' || direction === 'west') ctx.fillRect(cx - long / 2, cy - short / 2, long, short)
  else ctx.fillRect(cx - short / 2, cy - long / 2, short, long)
  ctx.globalAlpha = 1
}

function drawBeltGuideMarks(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, direction: Direction, connectionCount: number): void {
  const slots = connectionCount > 2 ? [0.34, 0.66] : [0.3, 0.68]
  slots.forEach((t, index) => {
    drawBeltPaleTriangle(ctx, x, y, size, direction, t)
    if (index === 0) drawBeltCargoDot(ctx, x, y, size, direction, Math.min(0.86, t + 0.18))
  })
}
function drawBeltPaleTriangle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, direction: Direction, t: number): void {
  const cx = direction === 'east' || direction === 'west' ? (direction === 'east' ? x + size * t : x + size * (1 - t)) : x + size / 2
  const cy = direction === 'south' || direction === 'north' ? (direction === 'south' ? y + size * t : y + size * (1 - t)) : y + size / 2
  const long = size * 0.17
  const wide = size * 0.12

  ctx.fillStyle = '#aeb4b8'
  ctx.globalAlpha = 0.58
  ctx.beginPath()
  if (direction === 'east') {
    ctx.moveTo(cx + long / 2, cy)
    ctx.lineTo(cx - long / 2, cy - wide / 2)
    ctx.lineTo(cx - long / 2, cy + wide / 2)
  } else if (direction === 'west') {
    ctx.moveTo(cx - long / 2, cy)
    ctx.lineTo(cx + long / 2, cy - wide / 2)
    ctx.lineTo(cx + long / 2, cy + wide / 2)
  } else if (direction === 'south') {
    ctx.moveTo(cx, cy + long / 2)
    ctx.lineTo(cx - wide / 2, cy - long / 2)
    ctx.lineTo(cx + wide / 2, cy - long / 2)
  } else {
    ctx.moveTo(cx, cy - long / 2)
    ctx.lineTo(cx - wide / 2, cy + long / 2)
    ctx.lineTo(cx + wide / 2, cy + long / 2)
  }
  ctx.closePath()
  ctx.fill()
  ctx.globalAlpha = 1
}
function drawBeltCargoDot(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, direction: Direction, t: number): void {
  const cx = direction === 'east' || direction === 'west' ? (direction === 'east' ? x + size * t : x + size * (1 - t)) : x + size / 2
  const cy = direction === 'south' || direction === 'north' ? (direction === 'south' ? y + size * t : y + size * (1 - t)) : y + size / 2
  const r = size * 0.07
  ctx.fillStyle = '#9da3a7'
  ctx.strokeStyle = '#858c91'
  ctx.lineWidth = Math.max(1, size * 0.018)
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
  ctx.strokeRect(cx - r, cy - r, r * 2, r * 2)
}

function cellCenter(position: GridPosition, viewport: ViewportState): { x: number; y: number } {
  const screen = gridToScreen(position, viewport)
  const size = CELL * viewport.zoom
  return { x: screen.x + size / 2, y: screen.y + size / 2 }
}

function positionKey(position: GridPosition): string {
  return `${position.x},${position.y}`
}
function entityAtCell(project: FactoryProject, position: GridPosition): FactoryEntity | undefined {
  return project.entities.find((entity) => entity.position.x === position.x && entity.position.y === position.y)
}

function offsetPosition(position: GridPosition, direction: Direction, distance = 1): GridPosition {
  if (direction === 'north') return { x: position.x, y: position.y - distance }
  if (direction === 'south') return { x: position.x, y: position.y + distance }
  if (direction === 'west') return { x: position.x - distance, y: position.y }
  return { x: position.x + distance, y: position.y }
}

function directionToRotation(direction: Direction): number {
  if (direction === 'south') return Math.PI / 2
  if (direction === 'west') return Math.PI
  if (direction === 'north') return -Math.PI / 2
  return 0
}
function drawShape(ctx: CanvasRenderingContext2D, shape: ShapeId, x: number, y: number, radius: number): void {
  const def = shapeById[shape]
  const fill = def?.color ?? '#222'
  const useAccent = !!def?.accent && shouldUseShapeAccent(shape)
  ctx.save()
  ctx.fillStyle = fill
  ctx.beginPath()
  appendShapePath(ctx, shape, x, y, radius)
  ctx.fill()
  ctx.strokeStyle = 'rgba(38,52,59,0.28)'
  ctx.lineWidth = Math.max(1, radius * 0.09)
  ctx.stroke()

  if (useAccent && def?.accent) {
    ctx.beginPath()
    ctx.rect(x, y - radius, radius, radius * 2)
    ctx.clip()
    ctx.fillStyle = def.accent
    ctx.fill()
  }
  ctx.restore()
}
function shouldUseShapeAccent(shape: ShapeId): boolean {
  return shapeById[shape]?.tier === undefined
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  roundedRectPath(ctx, x, y, w, h, r)
}

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
}
