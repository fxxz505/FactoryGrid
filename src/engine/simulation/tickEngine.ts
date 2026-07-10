import { buildingById } from '../../data/machines'
import { assemblerRecipes, furnaceRecipes, recipeById, recipeIsUnlocked } from '../../data/recipes'
import { researchDefinitions, researchPointValues } from '../../data/research'
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

type EntityIndex = Map<string, FactoryEntity>

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
  const next = cloneSimulationProject(project)
  next.tick += 1
  ensureBelts(next)
  const accumulator: TickAccumulator = { produced: {}, delivered: {}, trashed: {}, events: [] }
  const index = buildEntityIndex(next)

  updateSources(next, accumulator)
  updateProcessors(next, accumulator, index)
  updateBelts(next, index)
  transferOutputs(next, accumulator, index)
  updateResearch(next, accumulator)
  const errors = detectErrors(next)
  next.errors = errors
  next.metrics = updateMetrics(next, accumulator, errors)
  next.events = [...accumulator.events, ...next.events].slice(0, 80)

  return { project: next, events: accumulator.events, errors }
}

function cloneSimulationProject(project: FactoryProject): FactoryProject {
  const entities = project.entities.map((entity) => ({
    ...entity,
    position: { ...entity.position },
    input: entity.input.map((item) => ({ ...item })),
    output: entity.output.map((item) => ({ ...item }))
  }))
  const belts = Object.fromEntries(Object.entries(project.belts).map(([id, runtime]) => [
    id,
    { ...runtime, item: runtime.item ? { ...runtime.item } : undefined }
  ]))
  return {
    ...project,
    entities,
    belts,
    goals: project.goals.map((goal) => ({ ...goal })),
    unlocked: [...project.unlocked],
    metrics: {
      ...project.metrics,
      delivered: { ...project.metrics.delivered },
      produced: { ...project.metrics.produced },
      trashed: { ...project.metrics.trashed },
      bottlenecks: [...project.metrics.bottlenecks],
      recentDelivery: [...project.metrics.recentDelivery]
    },
    research: {
      ...project.research,
      delivered: { ...project.research.delivered },
      completed: [...project.research.completed]
    },
    errors: [...project.errors],
    events: [...project.events]
  }
}
function ensureBelts(project: FactoryProject): void {
  project.entities.filter((entity) => entity.kind === 'belt').forEach((entity) => {
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

function updateProcessors(project: FactoryProject, accumulator: TickAccumulator, index: EntityIndex): void {
  project.entities.filter((entity) => entity.kind === 'processor').forEach((entity) => {
    if (entity.type === 'trash') {
      updateTrash(entity, accumulator)
      return
    }
    if (ROUTER_TYPES.includes(entity.type)) {
      updateRouter(project, entity, index)
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

function updateRouter(project: FactoryProject, entity: FactoryEntity, index: EntityIndex): void {
  const item = entity.input[0]
  if (!item) {
    entity.status = 'waiting'
    return
  }
  const target = nextRouterTarget(project, entity, item, index)
  if (!target || !canAccept(project, target, item, incomingDirection(entity, target), index)) {
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
  if (entity.progress < adjustedDuration(definition?.durationTicks ?? 10, entity.level)) return

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
  const recipe = activeRecipe(entity, project)
  if (!recipe || !hasRecipeInputs(entity, recipe)) {
    entity.status = 'waiting'
    entity.progress = 0
    return
  }

  entity.progress += 1
  entity.status = 'running'
  if (entity.progress < adjustedDuration(recipe.durationTicks, entity.level)) return

  recipe.inputs.forEach((ingredient) => {
    for (let count = 0; count < ingredient.amount; count += 1) consumeFirst(entity, ingredient.shape)
  })
  entity.progress = 0
  const outputAmount = recipe.outputAmount ?? 1
  for (let count = 0; count < outputAmount; count += 1) entity.output.push(createItem(recipe.output, project.tick))
  increment(accumulator.produced, recipe.output, outputAmount)
}

function activeRecipe(entity: FactoryEntity, project: FactoryProject): RecipeDefinition | undefined {
  if (entity.type === 'furnace') {
    return furnaceRecipes.find((recipe) => hasRecipeInputs(entity, recipe))
      ?? furnaceRecipes.find((recipe) => recipe.inputs.some((ingredient) => entity.input.some((item) => item.shape === ingredient.shape)))
  }
  if (entity.type === 'assembler') {
    const recipe = recipeById[entity.recipeId ?? 'iron-plate'] ?? assemblerRecipes[0]
    return recipeIsUnlocked(project, recipe) ? recipe : undefined
  }
  return undefined
}

function hasRecipeInputs(entity: FactoryEntity, recipe: RecipeDefinition): boolean {
  return recipe.inputs.every((ingredient) => entity.input.filter((item) => item.shape === ingredient.shape).length >= ingredient.amount)
}

function updateBelts(project: FactoryProject, index: EntityIndex): void {
  const belts = project.entities.filter((entity) => entity.kind === 'belt')
  const ordered = [...belts].sort((a, b) => sortByDirection(a, b))
  ordered.forEach((belt) => {
    const runtime = project.belts[belt.id]
    const item = runtime?.item
    const enteredTick = runtime?.enteredTick ?? project.tick - beltMoveInterval(belt)
    if (!item || runtime.lastMovedTick === project.tick || project.tick - enteredTick < beltMoveInterval(belt)) return
    const target = entityAt(index, nextPosition(belt.position, belt.direction))
    if (!target || !canAccept(project, target, item, oppositeDirection(belt.direction), index)) {
      belt.status = 'blocked'
      return
    }
    runtime.item = undefined
    runtime.lastMovedTick = project.tick
    acceptItem(project, target, item)
    belt.status = 'running'
  })
}

function transferOutputs(project: FactoryProject, accumulator: TickAccumulator, index: EntityIndex): void {
  const outputters = project.entities.filter((entity) => entity.kind !== 'belt' && entity.output.length)
  outputters.forEach((entity) => {
    const item = entity.output[0]
    const target = entityAt(index, nextPosition(entity.position, entity.direction))
    if (!target || !canAccept(project, target, item, oppositeDirection(entity.direction), index)) {
      entity.status = 'blocked'
      return
    }
    entity.output.shift()
    acceptItem(project, target, item, accumulator)
  })
}

function nextRouterTarget(project: FactoryProject, entity: FactoryEntity, item: ShapeItem, index: EntityIndex): FactoryEntity | undefined {
  if (entity.type === 'tunnel') return nextTunnelTarget(project, entity, index)
  if (entity.type === 'launcher') return entityAt(index, nextPosition(entity.position, entity.direction, 4))
  if (entity.type === 'splitter') {
    const branches = splitterBranches(entity.direction)
    const branchIndex = entity.progress % branches.length
    const preferredDirection = branches[branchIndex]
    const fallbackDirection = branches[1 - branchIndex]
    const preferred = entityAt(index, nextPosition(entity.position, preferredDirection))
    if (preferred && canAccept(project, preferred, item, oppositeDirection(preferredDirection), index)) return preferred
    return entityAt(index, nextPosition(entity.position, fallbackDirection))
  }
  return entityAt(index, nextPosition(entity.position, entity.direction))
}

function canAccept(project: FactoryProject, entity: FactoryEntity, item: ShapeItem, incoming?: Direction, index?: EntityIndex): boolean {
  if (entity.kind === 'belt') {
    const runtime = project.belts[entity.id]
    const hasOpenPort = !incoming || incoming === oppositeDirection(entity.direction) || pointsToInput(index ?? buildEntityIndex(project), entity, incoming)
    return hasOpenPort && !runtime?.item
  }
  if (entity.kind === 'hub') return true
  if (entity.type === 'trash') return entity.input.length < 1
  if (entity.type === 'splitter') return entity.input.length < 1 && (!incoming || incoming === oppositeDirection(entity.direction))
  if (ROUTER_TYPES.includes(entity.type)) return entity.input.length < 1
  if (entity.kind === 'processor') return acceptsIncomingPort(entity, incoming, item.shape) && hasInputRoom(entity, item.shape) && acceptsShape(project, entity, item.shape)
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
    if (accumulator) increment(accumulator.delivered, item.shape, 1)
    else increment(project.metrics.delivered, item.shape, 1)
    const goal = project.goals.find((candidate) => candidate.shape === item.shape)
    if (goal) goal.delivered += 1
    const researchPoints = researchPointValues[item.shape] ?? 0
    if (researchPoints > 0) {
      project.research.points += researchPoints
      project.research.delivered[item.shape] = (project.research.delivered[item.shape] ?? 0) + 1
    }
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
  const isInputPort = machinePortRoles(entity).some((port) => port.role === 'input' && port.direction === incoming)
  return isInputPort && (isFurnaceOre(shape) || isFurnaceFuel(shape))
}

function hasInputRoom(entity: FactoryEntity, shape: ShapeId): boolean {
  if (entity.type === 'furnace') return hasFurnaceInputRoom(entity, shape)
  return entity.input.length < inputCapacity(entity)
}

function hasFurnaceInputRoom(entity: FactoryEntity, shape: ShapeId): boolean {
  if (!isFurnaceOre(shape) && !isFurnaceFuel(shape)) return false
  const sameShapeCount = entity.input.filter((item) => item.shape === shape).length
  if (isFurnaceFuel(shape)) return sameShapeCount < 2
  if (isFurnaceOre(shape)) return sameShapeCount < 2
  return false
}

function isFurnaceOre(shape: ShapeId): boolean {
  return shape === 'iron-ore' || shape === 'copper-ore' || shape === 'iron-ingot'
}

function isFurnaceFuel(shape: ShapeId): boolean {
  return shape === 'coal-ore'
}
function acceptsShape(project: FactoryProject, entity: FactoryEntity, shape: ShapeId): boolean {
  if (entity.type === 'painter-red') return shape === 'circle'
  if (entity.type === 'painter-blue') return shape === 'square' || shape === 'diamond'
  if (entity.type === 'painter-green') return shape === 'star'
  if (entity.type === 'stacker') return ['circle-red', 'square', 'square-blue', 'diamond', 'star', 'star-green'].includes(shape)
  if (entity.type === 'furnace') return furnaceRecipes.some((recipe) => recipe.inputs.some((ingredient) => ingredient.shape === shape))
  if (entity.type === 'assembler') {
    const recipe = recipeById[entity.recipeId ?? 'iron-plate'] ?? assemblerRecipes[0]
    return recipeIsUnlocked(project, recipe) && recipe.inputs.some((ingredient) => ingredient.shape === shape)
  }
  return true
}

function inputCapacity(entity: FactoryEntity): number {
  if (entity.type === 'stacker') return 2
  if (entity.type === 'furnace') return 4
  if (entity.type === 'assembler') {
    const recipe = recipeById[entity.recipeId ?? 'iron-plate'] ?? assemblerRecipes[0]
    return recipe.inputs.reduce((sum, ingredient) => sum + ingredient.amount, 0) + 2
  }
  return 1
}

function adjustedDuration(baseDuration: number, level = 1): number {
  if (level >= 3) return Math.max(1, Math.ceil(baseDuration * 0.55))
  if (level >= 2) return Math.max(1, Math.ceil(baseDuration * 0.75))
  return baseDuration
}

function beltMoveInterval(entity: FactoryEntity): number {
  return entity.type === 'fast-belt' ? 1 : 2
}

function updateResearch(project: FactoryProject, accumulator: TickAccumulator): void {
  let completedResearch = true
  while (completedResearch) {
    completedResearch = false
    for (const research of researchDefinitions) {
      if (project.research.completed.includes(research.id)) continue
      if (!research.prerequisites.every((id) => project.research.completed.includes(id))) continue
      if (project.research.points < research.cost) continue
      if (!research.requirements.every((requirement) => (project.research.delivered[requirement.shape] ?? 0) >= requirement.amount)) continue

      project.research.points -= research.cost
      project.research.completed.push(research.id)
      research.unlockBuildings?.forEach((building) => {
        if (!project.unlocked.includes(building)) project.unlocked.push(building)
      })
      if (research.maxMachineLevel) {
        project.research.maxMachineLevel = Math.max(project.research.maxMachineLevel, research.maxMachineLevel)
      }
      accumulator.events.unshift({
        tick: project.tick,
        entityId: 'research',
        message: '研究完成：' + research.name
      })
      completedResearch = true
      break
    }
  }
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

function buildEntityIndex(project: FactoryProject): EntityIndex {
  return new Map(project.entities.map((entity) => [positionKey(entity.position), entity]))
}

function entityAt(index: EntityIndex, position: GridPosition): FactoryEntity | undefined {
  return index.get(positionKey(position))
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

function nextTunnelTarget(project: FactoryProject, entity: FactoryEntity, index: EntityIndex): FactoryEntity | undefined {
  const exit = findTunnelExit(entity, index)
  if (exit) return entityAt(index, nextPosition(exit.position, exit.direction))
  return entityAt(index, nextPosition(entity.position, entity.direction, 3))
}

function findTunnelExit(entrance: FactoryEntity, index: EntityIndex): FactoryEntity | undefined {
  for (let distance = 2; distance <= 5; distance += 1) {
    const candidate = entityAt(index, nextPosition(entrance.position, entrance.direction, distance))
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

function pointsToInput(index: EntityIndex, belt: FactoryEntity, incoming: Direction): boolean {
  const neighbor = entityAt(index, nextPosition(belt.position, incoming))
  return Boolean(neighbor && neighbor.direction === oppositeDirection(incoming))
}


function positionKey(position: GridPosition): string {
  return position.x + ',' + position.y
}
function oppositeDirection(direction: Direction): Direction {
  if (direction === 'north') return 'south'
  if (direction === 'south') return 'north'
  if (direction === 'west') return 'east'
  return 'west'
}
