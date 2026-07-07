import { createEntity, cloneProject } from '../../data/examples'
import type { BuildingType, Direction, FactoryProject, GridPosition } from '../../models/factory'

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
  next.history = [...next.history, next.entities].slice(-20)
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
  next.history = [...next.history, next.entities].slice(-20)
  const removed = next.entities.filter(
    (entity) => entity.position.x === position.x && entity.position.y === position.y
  )
  removed.forEach((entity) => delete next.belts[entity.id])
  next.entities = next.entities.filter(
    (entity) => entity.position.x !== position.x || entity.position.y !== position.y
  )
  const entity = createEntity({
    id: `${type}-${Date.now().toString(36)}-${Math.abs(position.x)}-${Math.abs(position.y)}`,
    type,
    position,
    direction
  })
  next.entities.push(entity)
  if (type === 'belt') next.belts[entity.id] = {}
  next.selectedEntityId = entity.id
  return next
}

export function deleteAt(project: FactoryProject, position: GridPosition): FactoryProject {
  const next = cloneProject(project)
  next.history = [...next.history, next.entities].slice(-20)
  const removed = next.entities.filter(
    (entity) => entity.position.x === position.x && entity.position.y === position.y
  )
  next.entities = next.entities.filter(
    (entity) => entity.position.x !== position.x || entity.position.y !== position.y
  )
  removed.forEach((entity) => delete next.belts[entity.id])
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
  next.history = [...next.history, next.entities].slice(-20)
  const route = type === 'tunnel' ? tunnelRoute(start, end, direction) : beltRoute(start, end, direction)
  route.forEach(({ position, direction: beltDirection }, index) => {
    const removed = next.entities.filter(
      (entity) => entity.position.x === position.x && entity.position.y === position.y
    )
    removed.forEach((entity) => delete next.belts[entity.id])
    next.entities = next.entities.filter((entity) => entity.position.x !== position.x || entity.position.y !== position.y)
    const entity = createEntity({
      id: `${type}-${Date.now().toString(36)}-${position.x}-${position.y}-${index}`,
      type,
      position,
      direction: beltDirection
    })
    next.entities.push(entity)
    if (type === 'belt') next.belts[entity.id] = {}
  })
  next.selectedEntityId = next.entities[next.entities.length - 1]?.id
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
    next.entities.filter((entity) => entity.type === 'belt').map((entity) => [entity.id, {}])
  )
  return next
}

export function cellId(position: GridPosition): string {
  return `${position.x},${position.y}`
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
