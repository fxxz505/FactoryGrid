import { buildingById } from '../../data/machines'
import { assemblerRecipes, furnaceRecipes, recipeById } from '../../data/recipes'
import { nextPosition, cloneProject } from '../../data/examples'
import { machinePortRoles } from '../../render/factoryAssets'
import type {
  BuildingType,
  Direction,
  FactoryEntity,
  FactoryError,
  FactoryMetrics,
  FactoryProject,
  GridPosition,
  ShapeId,
  ShapeItem,
  SimulationEvent,
  TickResult,
  RecipeDefinition
} from '../../models/factory'

interface TickAccumulator {
  produced: Record<string, number>
  delivered: Record<string, number>
  trashed: Record<string, number>
  events: SimulationEvent[]
}

const ROUTER_TYPES: BuildingType[] = ['splitter', 'merger', 'tunnel', 'launcher']

export function runTicks(project: FactoryProject, count: number): FactoryProject {
  let next = cloneProject(project)
  for (let index = 0; index < count; index += 1) {
    next = runTick(next).project
  }
  return next
}

export function runTick(project: FactoryProject): TickResult {
  const next = cloneProject(project)
  next.tick += 1
  ensureBelts(next)
  const accumulator: TickAccumulator = { produced: {}, delivered: {}, trashed: {}, events: [] }

  updateSources(next, accumulator)
  updateProcessors(next, accumulator)
  updateBelts(next)
  transferOutputs(next, accumulator)
  const errors = detectErrors(next)
  next.errors = errors
  next.metrics = updateMetrics(next, accumulator, errors)
  next.events = [...accumulator.events, ...next.events].slice(0, 80)

  return { project: next, events: accumulator.events, errors }
}

function ensureBelts(project: FactoryProject): void {
  project.entities.filter((entity) => entity.type === 'belt').forEach((entity) => {
    project.belts[entity.id] ??= {}
  })
}

function updateSources(project: FactoryProject, accumulator: TickAccumulator): void {
  project.entities.filter((entity) => entity.kind === 'source').forEach((entity) => {
    const definition = buildingById[entity.type]
    if (!entity.sourceShape || !definition) return
    if (entity.output.length >= 1) {
      entity.status = 'blocked'
      return
    }
    entity.progress += 1
    entity.status = 'running'
    if (entity.progress >= definition.durationTicks) {
      entity.progress = 0
      entity.output.push(createItem(entity.sourceShape, project.tick))
      increment(accumulator.produced, entity.sourceShape, 1)
    }
  })
}

function updateProcessors(project: FactoryProject, accumulator: TickAccumulator): void {
  project.entities.filter((entity) => entity.kind === 'processor').forEach((entity) => {
    if (entity.type === 'trash') {
      updateTrash(entity, accumulator)
      return
    }
    if (ROUTER_TYPES.includes(entity.type)) {
      updateRouter(project, entity)
      return
    }
    updateMachine(entity, project, accumulator)
  })
}

function updateTrash(entity: FactoryEntity, accumulator: TickAccumulator): void {
  if (entity.input.length) {
    const item = entity.input.shift()
    if (item) increment(accumulator.trashed, item.shape, 1)
    entity.status = 'running'
  } else {
    entity.status = 'idle'
  }
}

function updateRouter(project: FactoryProject, entity: FactoryEntity): void {
  const item = entity.input[0]
  if (!item) {
    entity.status = 'waiting'
    return
  }
  const target = nextRouterTarget(project, entity, item)
  if (!target || !canAccept(project, target, item, incomingDirection(entity, target))) {
    entity.status = 'blocked'
    return
  }
  entity.input.shift()
  entity.progress += 1
  acceptItem(project, target, item)
  entity.status = 'running'
}

function updateMachine(entity: FactoryEntity, project: FactoryProject, accumulator: TickAccumulator): void {
  if (entity.type === 'furnace' || entity.type === 'assembler') {
    updateRecipeMachine(entity, project, accumulator)
    return
  }
  if (!entity.input.length) {
    entity.status = 'waiting'
    return
  }
  if (entity.output.length >= 1) {
    entity.status = 'blocked'
    return
  }

  const definition = buildingById[entity.type]
  entity.progress += 1
  entity.status = 'running'
  if (entity.progress < (definition?.durationTicks ?? 10)) return

  const transformed = transformFromInput(entity)
  if (!transformed) {
    entity.status = 'waiting'
    return
  }
  entity.progress = 0
  entity.output.push(createItem(transformed, project.tick))
  increment(accumulator.produced, transformed, 1)
}

function updateRecipeMachine(entity: FactoryEntity, project: FactoryProject, accumulator: TickAccumulator): void {
  if (entity.output.length >= 1) {
    entity.status = 'blocked'
    return
  }
  const recipe = activeRecipe(entity)
  if (!recipe || !hasRecipeInputs(entity, recipe)) {
    entity.status = 'waiting'
    entity.progress = 0
    return
  }

  entity.progress += 1
  entity.status = 'running'
  if (entity.progress < recipe.durationTicks) return

  recipe.inputs.forEach((ingredient) => {
    for (let count = 0; count < ingredient.amount; count += 1) consumeFirst(entity, ingredient.shape)
  })
  entity.progress = 0
  entity.output.push(createItem(recipe.output, project.tick))
  increment(accumulator.produced, recipe.output, 1)
}

function activeRecipe(entity: FactoryEntity): RecipeDefinition | undefined {
  if (entity.type === 'furnace') {
    return furnaceRecipes.find((recipe) => hasRecipeInputs(entity, recipe))
      ?? furnaceRecipes.find((recipe) => recipe.inputs.some((ingredient) => entity.input.some((item) => item.shape === ingredient.shape)))
  }
  if (entity.type === 'assembler') return recipeById[entity.recipeId ?? 'gear'] ?? assemblerRecipes[0]
  return undefined
}

function hasRecipeInputs(entity: FactoryEntity, recipe: RecipeDefinition): boolean {
  return recipe.inputs.every((ingredient) => entity.input.filter((item) => item.shape === ingredient.shape).length >= ingredient.amount)
}

function updateBelts(project: FactoryProject): void {
  const belts = project.entities.filter((entity) => entity.type === 'belt')
  const ordered = [...belts].sort((a, b) => sortByDirection(a, b))
  ordered.forEach((belt) => {
    const runtime = project.belts[belt.id]
    const item = runtime?.item
    if (!item || runtime.lastMovedTick === project.tick) return
    const target = entityAt(project, nextPosition(belt.position, belt.direction))
    if (!target || !canAccept(project, target, item, oppositeDirection(belt.direction))) {
      belt.status = 'blocked'
      return
    }
    runtime.item = undefined
    runtime.lastMovedTick = project.tick
    acceptItem(project, target, item)
    belt.status = 'running'
  })
}

function transferOutputs(project: FactoryProject, accumulator: TickAccumulator): void {
  const outputters = project.entities.filter((entity) => entity.kind !== 'belt' && entity.output.length)
  outputters.forEach((entity) => {
    const item = entity.output[0]
    const target = entityAt(project, nextPosition(entity.position, entity.direction))
    if (!target || !canAccept(project, target, item, oppositeDirection(entity.direction))) {
      entity.status = 'blocked'
      return
    }
    entity.output.shift()
    acceptItem(project, target, item, accumulator)
  })
}

function nextRouterTarget(project: FactoryProject, entity: FactoryEntity, item: ShapeItem): FactoryEntity | undefined {
  if (entity.type === 'tunnel') return nextTunnelTarget(project, entity)
  if (entity.type === 'launcher') return entityAt(project, nextPosition(entity.position, entity.direction, 4))
  if (entity.type === 'splitter') {
    const branches = splitterBranches(entity.direction)
    const index = entity.progress % branches.length
    const preferredDirection = branches[index]
    const fallbackDirection = branches[1 - index]
    const preferred = entityAt(project, nextPosition(entity.position, preferredDirection))
    if (preferred && canAccept(project, preferred, item, oppositeDirection(preferredDirection))) return preferred
    return entityAt(project, nextPosition(entity.position, fallbackDirection))
  }
  return entityAt(project, nextPosition(entity.position, entity.direction))
}

function canAccept(project: FactoryProject, entity: FactoryEntity, item: ShapeItem, incoming?: Direction): boolean {
  if (entity.kind === 'belt') {
    const runtime = project.belts[entity.id]
    const hasOpenPort = !incoming || incoming === oppositeDirection(entity.direction) || pointsToInput(project, entity, incoming)
    return hasOpenPort && !runtime?.item
  }
  if (entity.kind === 'hub') return true
  if (entity.type === 'trash') return entity.input.length < 1
  if (entity.type === 'splitter') return entity.input.length < 1 && (!incoming || incoming === oppositeDirection(entity.direction))
  if (ROUTER_TYPES.includes(entity.type)) return entity.input.length < 1
  if (entity.kind === 'processor') return acceptsIncomingPort(entity, incoming, item.shape) && hasInputRoom(entity, item.shape) && acceptsShape(entity, item.shape)
  return false
}


function acceptsIncomingPort(entity: FactoryEntity, incoming?: Direction, shape?: ShapeId): boolean {
  if (!incoming) return true
  if (entity.type === 'furnace' && shape) return acceptsFurnacePort(entity, incoming, shape)
  return machinePortRoles(entity).some((port) => port.role === 'input' && port.direction === incoming)
}
function acceptItem(
  project: FactoryProject,
  entity: FactoryEntity,
  item: ShapeItem,
  accumulator?: TickAccumulator
): void {
  if (entity.kind === 'belt') {
    const runtime = project.belts[entity.id]
    if (!runtime.item) {
      runtime.item = { ...item, age: item.age + 1 }
      runtime.lastMovedTick = project.tick
      runtime.enteredTick = project.tick
      entity.status = 'running'
    }
    return
  }

  if (entity.kind === 'hub') {
    increment(project.metrics.delivered, item.shape, 1)
    if (accumulator) increment(accumulator.delivered, item.shape, 1)
    const goal = project.goals.find((candidate) => candidate.shape === item.shape)
    if (goal) goal.delivered += 1
    entity.status = 'delivering'
    accumulator?.events.unshift({ tick: project.tick, entityId: entity.id, message: `\u67a2\u7ebd\u63a5\u6536 ${item.shape}` })
    return
  }

  entity.input.push(item)
}

function transformFromInput(entity: FactoryEntity): ShapeId | undefined {
  if (entity.type === 'stacker') {
    const shapes = entity.input.map((item) => item.shape)
    const hasRedCircle = shapes.includes('circle-red')
    const hasSquare = shapes.includes('square')
    const hasBlueDiamond = shapes.includes('square-blue') || shapes.includes('diamond')
    const hasStar = shapes.includes('star') || shapes.includes('star-green')
    if (hasRedCircle && hasSquare) {
      consumeFirst(entity, 'circle-red')
      consumeFirst(entity, 'square')
      return 'circle-red+square'
    }
    if (hasBlueDiamond && hasStar) {
      const blueShape = shapes.includes('square-blue') ? 'square-blue' : 'diamond'
      const starShape = shapes.includes('star-green') ? 'star-green' : 'star'
      consumeFirst(entity, blueShape)
      consumeFirst(entity, starShape)
      return 'diamond-blue+star'
    }
    if (entity.input.length >= 2) {
      entity.input.shift()
      entity.input.shift()
      return 'circle-red+square'
    }
    return undefined
  }

  const item = entity.input.shift()
  if (!item) return undefined
  return transformShape(entity.type, item.shape)
}

function consumeFirst(entity: FactoryEntity, shape: ShapeId): void {
  const index = entity.input.findIndex((item) => item.shape === shape)
  if (index >= 0) entity.input.splice(index, 1)
}

function transformShape(type: FactoryEntity['type'], shape: ShapeId): ShapeId {
  if (type === 'cutter') {
    if (shape === 'circle') return 'half-circle'
    if (shape === 'square') return 'half-square'
    return shape
  }
  if (type === 'rotator') return shape === 'star' ? 'rotated-star' : shape
  if (type === 'painter-red') return shape === 'circle' ? 'circle-red' : shape
  if (type === 'painter-blue') return shape === 'square' || shape === 'diamond' ? 'square-blue' : shape
  if (type === 'painter-green') return shape === 'star' ? 'star-green' : shape
  return shape
}

function acceptsFurnacePort(entity: FactoryEntity, incoming: Direction, shape: ShapeId): boolean {
  const oreInput = oppositeDirection(entity.direction)
  const fuelInput = rotateCounterClockwise(entity.direction)
  if (incoming === oreInput) return isFurnaceOre(shape)
  if (incoming === fuelInput) return isFurnaceFuel(shape)
  return false
}

function hasInputRoom(entity: FactoryEntity, shape: ShapeId): boolean {
  if (entity.type === 'furnace') return hasFurnaceInputRoom(entity, shape)
  return entity.input.length < inputCapacity(entity)
}

function hasFurnaceInputRoom(entity: FactoryEntity, shape: ShapeId): boolean {
  if (!acceptsShape(entity, shape)) return false
  const sameShapeCount = entity.input.filter((item) => item.shape === shape).length
  if (isFurnaceFuel(shape)) return sameShapeCount < 2
  if (isFurnaceOre(shape)) return sameShapeCount < 2
  return false
}

function isFurnaceOre(shape: ShapeId): boolean {
  return shape === 'iron-ore' || shape === 'copper-ore'
}

function isFurnaceFuel(shape: ShapeId): boolean {
  return shape === 'coal-ore'
}
function acceptsShape(entity: FactoryEntity, shape: ShapeId): boolean {
  if (entity.type === 'painter-red') return shape === 'circle'
  if (entity.type === 'painter-blue') return shape === 'square' || shape === 'diamond'
  if (entity.type === 'painter-green') return shape === 'star'
  if (entity.type === 'stacker') return ['circle-red', 'square', 'square-blue', 'diamond', 'star', 'star-green'].includes(shape)
  if (entity.type === 'furnace') return furnaceRecipes.some((recipe) => recipe.inputs.some((ingredient) => ingredient.shape === shape))
  if (entity.type === 'assembler') {
    const recipe = recipeById[entity.recipeId ?? 'gear'] ?? assemblerRecipes[0]
    return recipe.inputs.some((ingredient) => ingredient.shape === shape)
  }
  return true
}

function inputCapacity(entity: FactoryEntity): number {
  if (entity.type === 'stacker') return 2
  if (entity.type === 'furnace') return 4
  if (entity.type === 'assembler') {
    const recipe = recipeById[entity.recipeId ?? 'gear'] ?? assemblerRecipes[0]
    return recipe.inputs.reduce((sum, ingredient) => sum + ingredient.amount, 0) + 2
  }
  return 1
}
function detectErrors(project: FactoryProject): FactoryError[] {
  const errors: FactoryError[] = []
  project.entities.forEach((entity) => {
    if (entity.status === 'blocked') {
      errors.push({
        entityId: entity.id,
        severity: entity.kind === 'belt' ? 'warning' : 'critical',
        message: `${entity.label} \u5835\u585e`,
        suggestion: '\u7ee7\u7eed\u94fa\u8bbe\u4f20\u9001\u5e26\u3001\u65cb\u8f6c\u51fa\u53e3\u65b9\u5411\uff0c\u6216\u653e\u7f6e\u517c\u5bb9\u673a\u5668\u3002'
      })
    }
  })
  return errors
}

function updateMetrics(project: FactoryProject, accumulator: TickAccumulator, errors: FactoryError[]): FactoryMetrics {
  const beltItems = Object.values(project.belts).filter((belt) => belt.item).length
  const activeBuildings = project.entities.filter((entity) => entity.status === 'running' || entity.status === 'delivering').length
  const deliveredThisTick = Object.values(accumulator.delivered).reduce((sum, amount) => sum + amount, 0)
  return {
    delivered: merge(project.metrics.delivered, accumulator.delivered),
    produced: merge(project.metrics.produced, accumulator.produced),
    trashed: merge(project.metrics.trashed, accumulator.trashed),
    beltItems,
    activeBuildings,
    bottlenecks: errors,
    recentDelivery: [...project.metrics.recentDelivery, deliveredThisTick].slice(-42)
  }
}

function entityAt(project: FactoryProject, position: GridPosition): FactoryEntity | undefined {
  return project.entities.find((entity) => entity.position.x === position.x && entity.position.y === position.y)
}

function createItem(shape: ShapeId, tick: number): ShapeItem {
  return { id: `${shape}-${tick}-${Math.random().toString(36).slice(2, 7)}`, shape, age: 0 }
}

function increment(target: Record<string, number>, key: string, amount: number): void {
  target[key] = (target[key] ?? 0) + amount
}

function merge(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const next = { ...a }
  Object.entries(b).forEach(([key, amount]) => increment(next, key, amount))
  return next
}

function sortByDirection(a: FactoryEntity, b: FactoryEntity): number {
  if (a.direction === 'east' || a.direction === 'west') {
    return a.direction === 'east' ? b.position.x - a.position.x : a.position.x - b.position.x
  }
  return a.direction === 'south' ? b.position.y - a.position.y : a.position.y - b.position.y
}

function nextTunnelTarget(project: FactoryProject, entity: FactoryEntity): FactoryEntity | undefined {
  const exit = findTunnelExit(project, entity)
  if (exit) return entityAt(project, nextPosition(exit.position, exit.direction))
  return entityAt(project, nextPosition(entity.position, entity.direction, 3))
}

function findTunnelExit(project: FactoryProject, entrance: FactoryEntity): FactoryEntity | undefined {
  for (let distance = 2; distance <= 5; distance += 1) {
    const candidate = entityAt(project, nextPosition(entrance.position, entrance.direction, distance))
    if (candidate?.type === 'tunnel' && candidate.direction === entrance.direction) return candidate
  }
  return undefined
}
function splitterBranches(direction: Direction): Direction[] {
  return [rotateCounterClockwise(direction), rotateClockwise(direction)]
}

function rotateClockwise(direction: Direction): Direction {
  if (direction === 'north') return 'east'
  if (direction === 'east') return 'south'
  if (direction === 'south') return 'west'
  return 'north'
}

function rotateCounterClockwise(direction: Direction): Direction {
  if (direction === 'north') return 'west'
  if (direction === 'west') return 'south'
  if (direction === 'south') return 'east'
  return 'north'
}

function incomingDirection(from: FactoryEntity, to: FactoryEntity): Direction | undefined {
  if (to.position.x > from.position.x) return 'west'
  if (to.position.x < from.position.x) return 'east'
  if (to.position.y > from.position.y) return 'north'
  if (to.position.y < from.position.y) return 'south'
  return undefined
}

function pointsToInput(project: FactoryProject, belt: FactoryEntity, incoming: Direction): boolean {
  const neighbor = entityAt(project, nextPosition(belt.position, incoming))
  return Boolean(neighbor && neighbor.direction === oppositeDirection(incoming))
}

function oppositeDirection(direction: Direction): Direction {
  if (direction === 'north') return 'south'
  if (direction === 'south') return 'north'
  if (direction === 'west') return 'east'
  return 'west'
}
