import { buildingById } from '../../data/machines'
import { createEntity } from '../../data/examples'
import type {
  Blueprint,
  BlueprintPasteOptions,
  BuildingType,
  Direction,
  FactoryEntity,
  FactoryProject,
  GridPosition
} from '../../models/factory'

const UPGRADABLE_MACHINES: BuildingType[] = [
  'splitter', 'merger', 'tunnel',
  'cutter', 'rotator', 'painter-red', 'painter-blue', 'painter-green',
  'stacker', 'furnace', 'assembler'
]

export interface EditorTopologyMutation {
  added: FactoryEntity[]
  removed: FactoryEntity[]
}

const editorMutations = new WeakMap<FactoryProject, EditorTopologyMutation>()

export function editorTopologyMutation(project: FactoryProject): EditorTopologyMutation | undefined {
  return editorMutations.get(project)
}

function cloneProjectForEdit(project: FactoryProject): FactoryProject {
  return {
    ...project,
    entities: [...project.entities],
    belts: project.belts,
    history: [...project.history]
  }
}

function recordMutation(next: FactoryProject, removed: FactoryEntity[], added: FactoryEntity[]): FactoryProject {
  editorMutations.set(next, { added, removed })
  return next
}

export function rotateDirection(direction: Direction): Direction {
  if (direction === 'north') return 'east'
  if (direction === 'east') return 'south'
  if (direction === 'south') return 'west'
  return 'north'
}

export function rotateSelectedEntity(project: FactoryProject): FactoryProject {
  if (!project.selectedEntityId) return project
  const selected = project.entities.find((entity) => entity.id === project.selectedEntityId)
  if (!selected) return project
  const next = cloneProjectForEdit(project)
  pushHistory(next)
  let replacement: FactoryEntity | undefined
  next.entities = next.entities.map((entity) => entity.id === project.selectedEntityId
    ? (replacement = { ...entity, direction: rotateDirection(entity.direction) })
    : entity)
  return recordMutation(next, [selected], replacement ? [replacement] : [])
}

export function placeBuilding(
  project: FactoryProject,
  type: BuildingType,
  position: GridPosition,
  direction: Direction
): FactoryProject {
  const next = cloneProjectForEdit(project)
  pushHistory(next)
  const removed = removeAt(next, position)
  const entity = createPlacementEntity(
    type,
    position,
    direction,
    type + '-' + Date.now().toString(36) + '-' + Math.abs(position.x) + '-' + Math.abs(position.y)
  )
  next.entities.push(entity)
  if (isBelt(entity)) {
    if (next.belts === project.belts) next.belts = { ...project.belts }
    next.belts[entity.id] = {}
  }
  next.selectedEntityId = entity.id
  return recordMutation(next, removed, [entity])
}

export function createPlacementEntity(
  type: BuildingType,
  position: GridPosition,
  direction: Direction,
  id = 'placement-preview'
): FactoryEntity {
  return createEntity({ id, type, position, direction })
}

export function deleteAt(project: FactoryProject, position: GridPosition): FactoryProject {
  const next = cloneProjectForEdit(project)
  pushHistory(next)
  const removed = removeAt(next, position)
  next.selectedEntityId = next.entities[0]?.id
  return recordMutation(next, removed, [])
}

export function deleteArea(project: FactoryProject, start: GridPosition, end: GridPosition): FactoryProject {
  const next = cloneProjectForEdit(project)
  pushHistory(next)
  const area = normalizeArea(start, end)
  const removed = next.entities.filter((entity) => inArea(entity.position, area.min, area.max))
  const removedIds = new Set(removed.map((entity) => entity.id))
  next.entities = next.entities.filter((entity) => !removedIds.has(entity.id))
  const runtimeIds = removed.filter(isBelt).map((entity) => entity.id).filter((id) => project.belts[id] !== undefined)
  if (runtimeIds.length) {
    next.belts = { ...project.belts }
    runtimeIds.forEach((id) => delete next.belts[id])
  }
  next.selectedEntityId = next.entities[0]?.id
  return recordMutation(next, removed, [])
}

export function buildBeltLine(
  project: FactoryProject,
  start: GridPosition,
  end: GridPosition,
  direction?: Direction,
  type: BuildingType = 'belt'
): FactoryProject {
  const next = cloneProjectForEdit(project)
  pushHistory(next)
  const route = type === 'tunnel' ? tunnelRoute(start, end, direction) : beltRoute(start, end, direction)
  const removed: FactoryEntity[] = []
  const added: FactoryEntity[] = []
  route.forEach(({ position, direction: beltDirection }, index) => {
    removed.push(...removeAt(next, position))
    const entity = createEntity({
      id: type + '-' + Date.now().toString(36) + '-' + position.x + '-' + position.y + '-' + index,
      type,
      position,
      direction: beltDirection
    })
    next.entities.push(entity)
    added.push(entity)
    if (isBelt(entity)) {
      if (next.belts === project.belts) next.belts = { ...project.belts }
      next.belts[entity.id] = {}
    }
  })
  next.selectedEntityId = next.entities[next.entities.length - 1]?.id
  return recordMutation(next, removed, added)
}

export function copyAreaToBlueprint(
  project: FactoryProject,
  start: GridPosition,
  end: GridPosition,
  name = '区域蓝图'
): Blueprint {
  const area = normalizeArea(start, end)
  const entities = project.entities
    .filter((entity) => inArea(entity.position, area.min, area.max) && entity.type !== 'hub')
    .map((entity) => ({
      type: entity.type,
      offset: { x: entity.position.x - area.min.x, y: entity.position.y - area.min.y },
      direction: entity.direction,
      recipeId: entity.recipeId,
      level: entity.level
    }))

  return {
    id: 'bp-' + Date.now().toString(36),
    name,
    description: '包含 ' + entities.length + ' 个建筑，可在任意位置粘贴。',
    entities,
    width: area.max.x - area.min.x + 1,
    height: area.max.y - area.min.y + 1,
    createdAt: new Date().toISOString()
  }
}

export function pasteBlueprint(project: FactoryProject, blueprint: Blueprint, anchor: GridPosition): FactoryProject {
  return pasteBlueprintWithOptions(project, blueprint, anchor, { rotation: 0, mirrorX: false, beltTier: 'keep' })
}

export function pasteBlueprintWithOptions(
  project: FactoryProject,
  blueprint: Blueprint,
  anchor: GridPosition,
  options: BlueprintPasteOptions
): FactoryProject {
  const next = cloneProjectForEdit(project)
  pushHistory(next)
  const removed: FactoryEntity[] = []
  const added: FactoryEntity[] = []
  blueprint.entities.forEach((saved, index) => {
    const transformed = transformBlueprintOffset(saved.offset, blueprint, options)
    const position = { x: anchor.x + transformed.x, y: anchor.y + transformed.y }
    const type = replaceBlueprintBeltTier(saved.type, options.beltTier)
    removed.push(...removeAt(next, position))
    const entity = createEntity({
      id: type + '-paste-' + Date.now().toString(36) + '-' + index,
      type,
      position,
      direction: transformBlueprintDirection(saved.direction, options),
      recipeId: saved.recipeId,
      level: saved.level,
      input: [],
      output: [],
      progress: 0,
      status: 'idle'
    })
    next.entities.push(entity)
    added.push(entity)
    if (isBelt(entity)) {
      if (next.belts === project.belts) next.belts = { ...project.belts }
      next.belts[entity.id] = {}
    }
  })
  next.selectedEntityId = next.entities[next.entities.length - 1]?.id
  return recordMutation(next, removed, added)
}

function transformBlueprintOffset(
  offset: GridPosition,
  blueprint: Blueprint,
  options: BlueprintPasteOptions
): GridPosition {
  let x = options.mirrorX ? blueprint.width - 1 - offset.x : offset.x
  let y = offset.y
  if (options.rotation === 90) [x, y] = [blueprint.height - 1 - y, x]
  else if (options.rotation === 180) [x, y] = [blueprint.width - 1 - x, blueprint.height - 1 - y]
  else if (options.rotation === 270) [x, y] = [y, blueprint.width - 1 - x]
  return { x, y }
}

function transformBlueprintDirection(direction: Direction, options: BlueprintPasteOptions): Direction {
  let next = options.mirrorX
    ? direction === 'east' ? 'west' : direction === 'west' ? 'east' : direction
    : direction
  const turns = options.rotation / 90
  for (let index = 0; index < turns; index += 1) next = rotateDirection(next)
  return next
}

function replaceBlueprintBeltTier(type: BuildingType, tier: BlueprintPasteOptions['beltTier']): BuildingType {
  if (tier === 'keep' || !['belt', 'fast-belt', 'express-belt'].includes(type)) return type
  return tier
}

export function upgradeArea(project: FactoryProject, start: GridPosition, end: GridPosition): FactoryProject {
  if (!project.research.completed.includes('automation-upgrade')) return project
  const next = cloneProjectForEdit(project)
  pushHistory(next)
  const area = normalizeArea(start, end)
  const removed: FactoryEntity[] = []
  const added: FactoryEntity[] = []
  next.entities = next.entities.map((entity) => {
    if (!inArea(entity.position, area.min, area.max)) return entity
    if (entity.type === 'belt') {
      const replacement = { ...entity, type: 'fast-belt' as const, label: buildingById['fast-belt'].name }
      removed.push(entity)
      added.push(replacement)
      return replacement
    }
    if (entity.type === 'fast-belt' && project.research.completed.includes('mass-production')) {
      const replacement = { ...entity, type: 'express-belt' as const, label: buildingById['express-belt'].name }
      removed.push(entity)
      added.push(replacement)
      return replacement
    }
    if (!UPGRADABLE_MACHINES.includes(entity.type)) return entity
    const replacement = { ...entity, level: Math.min(project.research.maxMachineLevel, (entity.level ?? 1) + 1) }
    removed.push(entity)
    added.push(replacement)
    return replacement
  })
  return recordMutation(next, removed, added)
}

export function tunnelRoute(start: GridPosition, end: GridPosition, preferred?: Direction): Array<{ position: GridPosition; direction: Direction }> {
  const direction = inferDirection(start, end, preferred)
  const distance = manhattanDistance(start, end)
  if (distance < 2) return [{ position: start, direction }]
  return [
    { position: start, direction },
    { position: end, direction }
  ]
}

export function beltRoute(start: GridPosition, end: GridPosition, preferred?: Direction): Array<{ position: GridPosition; direction: Direction }> {
  const cells = cellsBetween(start, end, preferred)
  return cells.map((position, index) => {
    const next = cells[index + 1]
    const previous = cells[index - 1]
    return { position, direction: next ? directionBetween(position, next) : previous ? directionBetween(previous, position) : preferred ?? 'east' }
  })
}

export function undo(project: FactoryProject): FactoryProject {
  if (!project.history.length) return project
  const next = cloneProjectForEdit(project)
  const previous = next.history[next.history.length - 1]
  next.history = next.history.slice(0, -1)
  next.entities = previous
  next.belts = Object.fromEntries(
    next.entities.filter(isBelt).flatMap((entity) => {
      const runtime = project.belts[entity.id]
      return runtime?.item ? [[entity.id, runtime]] : []
    })
  )
  return recordMutation(next, project.entities, next.entities)
}

export function cellId(position: GridPosition): string {
  return position.x + ',' + position.y
}

export function cellsBetween(start: GridPosition, end: GridPosition, preferred?: Direction): GridPosition[] {
  const cells: GridPosition[] = []
  const dx = end.x - start.x
  const dy = end.y - start.y
  const horizontalFirst = preferred === 'east' || preferred === 'west' || (preferred === undefined && Math.abs(dx) >= Math.abs(dy))

  const pushUnique = (position: GridPosition): void => {
    const last = cells[cells.length - 1]
    if (!last || last.x !== position.x || last.y !== position.y) cells.push(position)
  }
  const addHorizontal = (fromX: number, toX: number, y: number): void => {
    const step = toX >= fromX ? 1 : -1
    for (let x = fromX; step > 0 ? x <= toX : x >= toX; x += step) pushUnique({ x, y })
  }
  const addVertical = (fromY: number, toY: number, x: number): void => {
    const step = toY >= fromY ? 1 : -1
    for (let y = fromY; step > 0 ? y <= toY : y >= toY; y += step) pushUnique({ x, y })
  }

  if (horizontalFirst) {
    addHorizontal(start.x, end.x, start.y)
    addVertical(start.y, end.y, end.x)
  } else {
    addVertical(start.y, end.y, start.x)
    addHorizontal(start.x, end.x, end.y)
  }
  return cells
}

function removeAt(project: FactoryProject, position: GridPosition): FactoryEntity[] {
  const removed: FactoryEntity[] = []
  const kept: FactoryEntity[] = []
  project.entities.forEach((entity) => {
    if (samePosition(entity.position, position)) removed.push(entity)
    else kept.push(entity)
  })
  const runtimeIds = removed.map((entity) => entity.id).filter((id) => project.belts[id] !== undefined)
  if (runtimeIds.length) {
    project.belts = { ...project.belts }
    runtimeIds.forEach((id) => delete project.belts[id])
  }
  project.entities = kept
  return removed
}

function pushHistory(project: FactoryProject): void {
  project.history = [...project.history, project.entities].slice(-20)
}

function normalizeArea(start: GridPosition, end: GridPosition): { min: GridPosition; max: GridPosition } {
  return {
    min: { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y) },
    max: { x: Math.max(start.x, end.x), y: Math.max(start.y, end.y) }
  }
}

function inArea(position: GridPosition, min: GridPosition, max: GridPosition): boolean {
  return position.x >= min.x && position.x <= max.x && position.y >= min.y && position.y <= max.y
}

function samePosition(a: GridPosition, b: GridPosition): boolean {
  return a.x === b.x && a.y === b.y
}

function isBelt(entity: FactoryEntity): boolean {
  return entity.type === 'belt' || entity.type === 'fast-belt' || entity.type === 'express-belt'
}

function inferDirection(start: GridPosition, end: GridPosition, preferred?: Direction): Direction {
  const dx = end.x - start.x
  const dy = end.y - start.y
  if (Math.abs(dx) >= Math.abs(dy) && (preferred === 'east' || preferred === 'west')) return preferred
  if (Math.abs(dy) > Math.abs(dx) && (preferred === 'north' || preferred === 'south')) return preferred
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'east' : 'west'
  return dy >= 0 ? 'south' : 'north'
}

function manhattanDistance(start: GridPosition, end: GridPosition): number {
  return Math.abs(end.x - start.x) + Math.abs(end.y - start.y)
}

function directionBetween(from: GridPosition, to: GridPosition): Direction {
  if (to.x > from.x) return 'east'
  if (to.x < from.x) return 'west'
  if (to.y > from.y) return 'south'
  return 'north'
}
