import type { BuildingType, Direction, FactoryEntity, FactoryProject } from '../models/factory'

export type PortRole = 'input' | 'output'

export interface MachinePort {
  direction: Direction
  role: PortRole
}


export type BeltSpriteKind = 'straight' | 'corner' | 'tee' | 'cross'

export interface BeltSpritePlan {
  kind: BeltSpriteKind
  rotation: number
  connections: Direction[]
  direction: Direction
}

export interface MachineGeometryStyle {
  body: string
  rim: string
  accent: string
  core: 'circle' | 'square' | 'diamond' | 'bars' | 'ring' | 'stack' | 'split' | 'merge' | 'pipe' | 'none'
  scale: number
}

export const machineGeometry: Record<BuildingType, MachineGeometryStyle> = {
  'source-circle': { body: '#e7f6f2', rim: '#47665f', accent: '#59bfd5', core: 'circle', scale: 0.9 },
  'source-square': { body: '#f4efd9', rim: '#6d6243', accent: '#e4bd45', core: 'square', scale: 0.9 },
  'source-star': { body: '#e7f4df', rim: '#526847', accent: '#83c860', core: 'ring', scale: 0.9 },
  'source-diamond': { body: '#eee7f6', rim: '#625371', accent: '#a986db', core: 'diamond', scale: 0.9 },
  'source-iron': { body: '#edf1ec', rim: '#596460', accent: '#cfd6d3', core: 'circle', scale: 0.9 },
  'source-coal': { body: '#e4e3df', rim: '#323433', accent: '#242424', core: 'circle', scale: 0.9 },
  'source-copper': { body: '#f0e7de', rim: '#704b35', accent: '#a66a3f', core: 'circle', scale: 0.9 },
  belt: { body: '#4a4b46', rim: '#262a28', accent: '#7a7a70', core: 'bars', scale: 1 },
  'fast-belt': { body: '#3f5654', rim: '#22312f', accent: '#6da69f', core: 'bars', scale: 1 },
  splitter: { body: '#e4eee8', rim: '#405d54', accent: '#4fa186', core: 'split', scale: 0.96 },
  merger: { body: '#e4eee8', rim: '#405d54', accent: '#4fa186', core: 'merge', scale: 0.96 },
  tunnel: { body: '#e8ece9', rim: '#46545b', accent: '#7c8b92', core: 'pipe', scale: 0.96 },
  launcher: { body: '#ece8df', rim: '#5f5546', accent: '#c49b54', core: 'bars', scale: 0.96 },
  cutter: { body: '#eef0ea', rim: '#505a56', accent: '#d67563', core: 'diamond', scale: 0.96 },
  rotator: { body: '#e9efef', rim: '#4e6266', accent: '#67aabd', core: 'ring', scale: 0.96 },
  'painter-red': { body: '#f2e7e4', rim: '#69514d', accent: '#de615c', core: 'circle', scale: 0.96 },
  'painter-blue': { body: '#e5ebf5', rim: '#4f5b70', accent: '#5b8adf', core: 'circle', scale: 0.96 },
  'painter-green': { body: '#e5f0e6', rim: '#4d654e', accent: '#63b66c', core: 'circle', scale: 0.96 },
  stacker: { body: '#efede4', rim: '#5e5b4f', accent: '#bba958', core: 'stack', scale: 0.96 },
  furnace: { body: '#eee8df', rim: '#6a5544', accent: '#d07048', core: 'ring', scale: 0.98 },
  assembler: { body: '#e7eee9', rim: '#465e55', accent: '#5fa487', core: 'stack', scale: 0.98 },
  hub: { body: '#dbeee9', rim: '#2e5954', accent: '#1e8d80', core: 'square', scale: 1 },
  trash: { body: '#eee4df', rim: '#765149', accent: '#b55a4f', core: 'bars', scale: 0.96 }
}

export function machineGeometryFor(type: BuildingType): MachineGeometryStyle {
  return machineGeometry[type]
}

export function planBeltSprite(project: FactoryProject, belt: FactoryEntity): BeltSpritePlan {
  const connections = connectedDirections(project, belt)
  const unique = normalizeConnections(connections.length > 0 ? connections : [belt.direction])

  if (unique.length >= 4) return { kind: 'cross', rotation: 0, connections: unique, direction: belt.direction }
  if (unique.length === 3) return { kind: 'tee', rotation: teeRotation(unique), connections: unique, direction: belt.direction }
  if (unique.length === 2 && !areOpposite(unique[0], unique[1])) {
    return { kind: 'corner', rotation: cornerRotation(unique), connections: unique, direction: belt.direction }
  }

  const straightDirection = unique.find((direction) => direction === 'east' || direction === 'west') ? 'east' : 'north'
  return { kind: 'straight', rotation: directionRotation(straightDirection), connections: unique, direction: belt.direction }
}

export function entityConnectionDirections(project: FactoryProject, entity: FactoryEntity): Direction[] {
  if (entity.kind === 'belt') return connectedDirections(project, entity)
  return normalizeConnections(machinePorts(entity).map((port) => port.direction))
}

export function machinePortRoles(entity: FactoryEntity): MachinePort[] {
  return machinePorts(entity)
}

export function connectedDirections(project: FactoryProject, entity: FactoryEntity): Direction[] {
  const dirs = new Set<Direction>()
  dirs.add(entity.direction)

  directions().forEach((direction) => {
    const neighbor = entityAt(project, offsetPosition(entity.position, direction))
    if (!neighbor) return

    if (neighbor.type === 'splitter' && splitterPorts(neighbor.direction).includes(opposite(direction))) {
      dirs.add(direction)
      return
    }

    if (neighbor.kind !== 'belt' && machinePorts(neighbor).some((port) => port.direction === opposite(direction))) {
      dirs.add(direction)
      return
    }

    if (neighbor.kind === 'belt') {
      if (pointsTo(neighbor, entity.position) || pointsTo(entity, neighbor.position)) dirs.add(direction)
      return
    }

    if (pointsTo(neighbor, entity.position) || pointsTo(entity, neighbor.position)) dirs.add(direction)
  })

  return normalizeConnections(Array.from(dirs))
}

function normalizeConnections(connections: Direction[]): Direction[] {
  const order = directions()
  const set = new Set(connections)
  return order.filter((direction) => set.has(direction))
}

function cornerRotation(connections: Direction[]): number {
  const key = normalizeConnections(connections).join('-')
  if (key === 'east-south') return 0
  if (key === 'south-west') return Math.PI / 2
  if (key === 'north-west') return Math.PI
  return -Math.PI / 2
}

function teeRotation(connections: Direction[]): number {
  const missing = directions().find((direction) => !connections.includes(direction))
  if (missing === 'west') return 0
  if (missing === 'north') return Math.PI / 2
  if (missing === 'east') return Math.PI
  return -Math.PI / 2
}

function directionRotation(direction: Direction): number {
  if (direction === 'south') return Math.PI / 2
  if (direction === 'west') return Math.PI
  if (direction === 'north') return -Math.PI / 2
  return 0
}

function areOpposite(a: Direction, b: Direction): boolean {
  return opposite(a) === b
}

function machinePorts(entity: FactoryEntity): MachinePort[] {
  if (entity.kind === 'source') return [{ direction: entity.direction, role: 'output' }]
  if (entity.type === 'splitter') {
    return splitterPorts(entity.direction).map((direction) => ({
      direction,
      role: direction === opposite(entity.direction) ? 'input' : 'output'
    }))
  }
  if (entity.type === 'merger') {
    return directions().map((direction) => ({ direction, role: direction === entity.direction ? 'output' : 'input' }))
  }
  if (entity.type === 'furnace') {
    return [
      { direction: entity.direction, role: 'output' },
      { direction: opposite(entity.direction), role: 'input' },
      { direction: rotateCounterClockwise(entity.direction), role: 'input' }
    ]
  }
  if (entity.type === 'assembler') {
    return [
      { direction: entity.direction, role: 'output' },
      { direction: opposite(entity.direction), role: 'input' },
      { direction: rotateCounterClockwise(entity.direction), role: 'input' },
      { direction: rotateClockwise(entity.direction), role: 'input' }
    ]
  }
  if (entity.type === 'hub' || entity.type === 'trash') return [{ direction: opposite(entity.direction), role: 'input' }]
  return [
    { direction: entity.direction, role: 'output' },
    { direction: opposite(entity.direction), role: 'input' }
  ]
}

function splitterPorts(direction: Direction): Direction[] {
  return [rotateCounterClockwise(direction), rotateClockwise(direction), opposite(direction)]
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

function pointsTo(entity: FactoryEntity, position: { x: number; y: number }): boolean {
  const next = offsetPosition(entity.position, entity.direction)
  return next.x === position.x && next.y === position.y
}

function entityAt(project: FactoryProject, position: { x: number; y: number }): FactoryEntity | undefined {
  return project.entities.find((entity) => entity.position.x === position.x && entity.position.y === position.y)
}

function offsetPosition(position: { x: number; y: number }, direction: Direction): { x: number; y: number } {
  if (direction === 'north') return { x: position.x, y: position.y - 1 }
  if (direction === 'south') return { x: position.x, y: position.y + 1 }
  if (direction === 'west') return { x: position.x - 1, y: position.y }
  return { x: position.x + 1, y: position.y }
}

function opposite(direction: Direction): Direction {
  if (direction === 'north') return 'south'
  if (direction === 'south') return 'north'
  if (direction === 'west') return 'east'
  return 'west'
}

function directions(): Direction[] {
  return ['north', 'east', 'south', 'west']
}
