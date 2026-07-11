import { buildingById } from '../../data/machines'
import { createEntity, cloneProject } from '../../data/examples'
import type {
  Blueprint,
  BuildingType,
  Direction,
  FactoryEntity,
  FactoryProject,
  GridPosition
} from '../../models/factory'

const UPGRADABLE_MACHINES: BuildingType[] = [
  'cutter', 'rotator', 'painter-red', 'painter-blue', 'painter-green',
  'stacker', 'furnace', 'assembler'
]

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
  const next = cloneProject(project)
  pushHistory(next)
  next.entities = next.entities.map((entity) => entity.id === project.selectedEntityId
    ? { ...entity, direction: rotateDirection(entity.direction) }
    : entity)
  return next
}

export function placeBuilding(
  project: FactoryProject,
  type: BuildingType,
  position: GridPosition,
  direction: Direction
): FactoryProject {
  const next = cloneProject(project)
  pushHistory(next)
  removeAt(next, position)
  const entity = createPlacementEntity(
    type,
    position,
    direction,
    type + '-' + Date.now().toString(36) + '-' + Math.abs(position.x) + '-' + Math.abs(position.y)
  )
  next.entities.push(entity)
  if (isBelt(entity)) next.belts[entity.id] = {}
  next.selectedEntityId = entity.id
  return next
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
  const next = cloneProject(project)
  pushHistory(next)
  removeAt(next, position)
  next.selectedEntityId = next.entities[0]?.id
  return next
}

export function deleteArea(project: FactoryProject, start: GridPosition, end: GridPosition): FactoryProject {
  const next = cloneProject(project)
  pushHistory(next)
  const area = normalizeArea(start, end)
  const removed = next.entities.filter((entity) => inArea(entity.position, area.min, area.max))
  const removedIds = new Set(removed.map((entity) => entity.id))
  next.entities = next.entities.filter((entity) => !removedIds.has(entity.id))
  removedIds.forEach((id) => delete next.belts[id])
  next.selectedEntityId = next.entities[0]?.id
  return next
}

export function buildBeltLine(
  project: FactoryProject,
  start: GridPosition,
  end: GridPosition,
  direction?: Direction,
  type: BuildingType = 'belt'
): FactoryProject {
  const next = cloneProject(project)
  pushHistory(next)
  const route = type === 'tunnel' ? tunnelRoute(start, end, direction) : beltRoute(start, end, direction)
  route.forEach(({ position, direction: beltDirection }, index) => {
    removeAt(next, position)
    const entity = createEntity({
      id: type + '-' + Date.now().toString(36) + '-' + position.x + '-' + position.y + '-' + index,
      type,
      position,
      direction: beltDirection
    })
    next.entities.push(entity)
    if (isBelt(entity)) next.belts[entity.id] = {}
  })
  next.selectedEntityId = next.entities[next.entities.length - 1]?.id
  return next
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
  const next = cloneProject(project)
  pushHistory(next)
  blueprint.entities.forEach((saved, index) => {
    const position = { x: anchor.x + saved.offset.x, y: anchor.y + saved.offset.y }
    removeAt(next, position)
    const entity = createEntity({
      id: saved.type + '-paste-' + Date.now().toString(36) + '-' + index,
      type: saved.type,
      position,
      direction: saved.direction,
      recipeId: saved.recipeId,
      level: saved.level,
      input: [],
      output: [],
      progress: 0,
      status: 'idle'
    })
    next.entities.push(entity)
    if (isBelt(entity)) next.belts[entity.id] = {}
  })
  next.selectedEntityId = next.entities[next.entities.length - 1]?.id
  return next
}

export function upgradeArea(project: FactoryProject, start: GridPosition, end: GridPosition): FactoryProject {
  if (!project.research.completed.includes('automation-upgrade')) return project
  const next = cloneProject(project)
  pushHistory(next)
  const area = normalizeArea(start, end)
  next.entities = next.entities.map((entity) => {
    if (!inArea(entity.position, area.min, area.max)) return entity
    if (entity.type === 'belt') {
      return { ...entity, type: 'fast-belt', label: buildingById['fast-belt'].name }
    }
    if (!UPGRADABLE_MACHINES.includes(entity.type)) return entity
    return { ...entity, level: Math.min(project.research.maxMachineLevel, (entity.level ?? 1) + 1) }
  })
  return next
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
  const next = cloneProject(project)
  const previous = next.history[next.history.length - 1]
  next.history = next.history.slice(0, -1)
  next.entities = previous
  next.belts = Object.fromEntries(
    next.entities.filter(isBelt).map((entity) => [entity.id, {}])
  )
  return next
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

function removeAt(project: FactoryProject, position: GridPosition): void {
  const removed = project.entities.filter((entity) => samePosition(entity.position, position))
  removed.forEach((entity) => delete project.belts[entity.id])
  project.entities = project.entities.filter((entity) => !samePosition(entity.position, position))
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
  return entity.type === 'belt' || entity.type === 'fast-belt'
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
