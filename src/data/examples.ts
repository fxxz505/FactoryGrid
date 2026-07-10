import { buildingById } from './machines'
import type { BuildingType, Direction, FactoryEntity, FactoryProject, ShapeId } from '../models/factory'

let entityCounter = 0

export function createEntity(overrides: Partial<FactoryEntity> & Pick<FactoryEntity, 'type'>): FactoryEntity {
  const type = overrides.type
  return {
    id: overrides.id ?? type + '-' + entityCounter++,
    kind: overrides.kind ?? inferKind(type),
    type,
    label: overrides.label ?? labelFor(type),
    position: overrides.position ?? { x: 0, y: 0 },
    direction: overrides.direction ?? 'east',
    sourceShape: overrides.sourceShape ?? sourceShapeFor(type),
    input: overrides.input ?? [],
    output: overrides.output ?? [],
    progress: overrides.progress ?? 0,
    status: overrides.status ?? 'idle',
    recipeId: overrides.recipeId ?? defaultRecipeFor(type),
    level: overrides.level
  }
}

function inferKind(type: BuildingType): FactoryEntity['kind'] {
  if (type.startsWith('source-')) return 'source'
  if (type === 'belt' || type === 'fast-belt') return 'belt'
  if (type === 'hub') return 'hub'
  return 'processor'
}

function sourceShapeFor(type: BuildingType): ShapeId | undefined {
  if (type === 'source-circle') return 'circle'
  if (type === 'source-square') return 'square'
  if (type === 'source-star') return 'star'
  if (type === 'source-diamond') return 'diamond'
  if (type === 'source-iron') return 'iron-ore'
  if (type === 'source-coal') return 'coal-ore'
  if (type === 'source-copper') return 'copper-ore'
  return undefined
}

function defaultRecipeFor(type: BuildingType): string | undefined {
  if (type === 'assembler') return 'iron-plate'
  return undefined
}

function labelFor(type: BuildingType): string {
  return buildingById[type]?.name ?? type
}

export function createShapezProject(): FactoryProject {
  const entities: FactoryEntity[] = [
    createEntity({ id: 'circle-source', type: 'source-circle', position: { x: 0, y: 1 }, direction: 'east' }),
    createEntity({ id: 'belt-a1', type: 'belt', position: { x: 1, y: 1 }, direction: 'east' }),
    createEntity({ id: 'splitter-a', type: 'splitter', position: { x: 2, y: 1 }, direction: 'east' }),
    createEntity({ id: 'belt-a-upper', type: 'belt', position: { x: 2, y: 0 }, direction: 'north' }),
    createEntity({ id: 'trash-side', type: 'trash', position: { x: 2, y: -1 }, direction: 'north' }),
    createEntity({ id: 'belt-a-side', type: 'belt', position: { x: 2, y: 2 }, direction: 'south' }),
    createEntity({ id: 'belt-a-turn', type: 'belt', position: { x: 2, y: 3 }, direction: 'east' }),
    createEntity({ id: 'belt-a2', type: 'belt', position: { x: 3, y: 3 }, direction: 'east' }),
    createEntity({ id: 'red-painter', type: 'painter-red', position: { x: 4, y: 3 }, direction: 'east' }),
    createEntity({ id: 'belt-a3', type: 'belt', position: { x: 5, y: 3 }, direction: 'east' }),
    createEntity({ id: 'launcher-a', type: 'launcher', position: { x: 6, y: 3 }, direction: 'east' }),
    createEntity({ id: 'hub', type: 'hub', position: { x: 10, y: 3 }, direction: 'east' }),
    createEntity({ id: 'square-source', type: 'source-square', position: { x: 0, y: 7 }, direction: 'east' }),
    createEntity({ id: 'square-belt-1', type: 'belt', position: { x: 1, y: 7 }, direction: 'east' }),
    createEntity({ id: 'cutter', type: 'cutter', position: { x: 2, y: 7 }, direction: 'east' }),
    createEntity({ id: 'square-splitter', type: 'splitter', position: { x: 3, y: 7 }, direction: 'east' }),
    createEntity({ id: 'square-upper-belt', type: 'belt', position: { x: 3, y: 6 }, direction: 'north' }),
    createEntity({ id: 'square-turn-belt', type: 'belt', position: { x: 3, y: 5 }, direction: 'east' }),
    createEntity({ id: 'tunnel-a', type: 'tunnel', position: { x: 4, y: 5 }, direction: 'east' }),
    createEntity({ id: 'tunnel-b', type: 'tunnel', position: { x: 6, y: 5 }, direction: 'east' }),
    createEntity({ id: 'half-hub', type: 'hub', position: { x: 7, y: 5 }, direction: 'east' }),
    createEntity({ id: 'square-trash-belt', type: 'belt', position: { x: 3, y: 8 }, direction: 'south' }),
    createEntity({ id: 'square-trash', type: 'trash', position: { x: 3, y: 9 }, direction: 'south' }),
    createEntity({ id: 'star-source', type: 'source-star', position: { x: 0, y: 11 }, direction: 'east' }),
    createEntity({ id: 'star-belt-1', type: 'belt', position: { x: 1, y: 11 }, direction: 'east' }),
    createEntity({ id: 'green-painter', type: 'painter-green', position: { x: 2, y: 11 }, direction: 'east' }),
    createEntity({ id: 'star-belt-2', type: 'belt', position: { x: 3, y: 11 }, direction: 'east' }),
    createEntity({ id: 'star-hub', type: 'hub', position: { x: 4, y: 11 }, direction: 'east' })
  ]

  return {
    id: 'shapez-factory',
    name: '异形工厂实验场',
    tick: 0,
    running: false,
    renderAlpha: 0,
    speed: 2,
    activeTool: 'belt',
    activeDirection: 'east',
    selectedEntityId: 'splitter-a',
    viewport: { x: 150, y: 88, zoom: 1 },
    goals: [
      { shape: 'circle-red', amount: 12, delivered: 0 },
      { shape: 'half-square', amount: 6, delivered: 0 },
      { shape: 'star-green', amount: 4, delivered: 0 }
    ],
    unlocked: [
      'source-circle', 'source-square', 'source-star', 'source-diamond',
      'source-iron', 'source-coal', 'source-copper', 'belt',
      'splitter', 'merger', 'tunnel', 'launcher', 'cutter', 'rotator',
      'painter-red', 'painter-blue', 'painter-green', 'stacker',
      'furnace', 'assembler', 'trash', 'hub'
    ],
    entities,
    belts: {},
    metrics: {
      delivered: {}, produced: {}, trashed: {}, beltItems: 0,
      activeBuildings: 0, bottlenecks: [], recentDelivery: []
    },
    research: { points: 0, delivered: {}, completed: [], maxMachineLevel: 1 },
    performance: { fps: 60, frameTime: 16.7, quality: 'high' },
    errors: [],
    events: [],
    blueprints: [
      {
        id: 'bp-red-circle-line',
        name: '红圆主线',
        description: '圆形矿脉、分流、染色、跨线发射与枢纽交付。',
        entityIds: ['circle-source', 'belt-a1', 'splitter-a', 'belt-a-side', 'belt-a-turn', 'belt-a2', 'red-painter', 'belt-a3', 'launcher-a'],
        entities: [],
        width: 0,
        height: 0,
        createdAt: '2026-07-06T00:00:00.000Z'
      }
    ],
    history: []
  }
}

export function cloneProject(project: FactoryProject): FactoryProject {
  return JSON.parse(JSON.stringify(project)) as FactoryProject
}

export function nextPosition(position: { x: number; y: number }, direction: Direction, distance = 1): { x: number; y: number } {
  if (direction === 'north') return { x: position.x, y: position.y - distance }
  if (direction === 'south') return { x: position.x, y: position.y + distance }
  if (direction === 'west') return { x: position.x - distance, y: position.y }
  return { x: position.x + distance, y: position.y }
}
