export type ShapeId =
  | 'circle'
  | 'square'
  | 'star'
  | 'diamond'
  | 'half-circle'
  | 'half-square'
  | 'circle-red'
  | 'square-blue'
  | 'star-green'
  | 'rotated-star'
  | 'circle-red+square'
  | 'diamond-blue+star'
  | 'trash'

export type EntityKind = 'source' | 'belt' | 'processor' | 'hub'

export type BuildingType =
  | 'source-circle'
  | 'source-square'
  | 'source-star'
  | 'source-diamond'
  | 'belt'
  | 'splitter'
  | 'merger'
  | 'tunnel'
  | 'launcher'
  | 'cutter'
  | 'rotator'
  | 'painter-red'
  | 'painter-blue'
  | 'painter-green'
  | 'stacker'
  | 'hub'
  | 'trash'

export type Direction = 'north' | 'east' | 'south' | 'west'
export type EntityStatus = 'idle' | 'running' | 'waiting' | 'blocked' | 'delivering'
export type ToolId = BuildingType | 'select' | 'pan' | 'delete'

export interface GridPosition {
  x: number
  y: number
}

export interface ShapeDefinition {
  id: ShapeId
  name: string
  code: string
  color: string
  accent?: string
  description: string
}

export interface BuildingDefinition {
  id: BuildingType
  name: string
  kind: EntityKind
  hotkey: string
  durationTicks: number
  description: string
}

export interface ShapeItem {
  id: string
  shape: ShapeId
  age: number
}

export interface FactoryEntity {
  id: string
  kind: EntityKind
  type: BuildingType
  label: string
  position: GridPosition
  direction: Direction
  sourceShape?: ShapeId
  input: ShapeItem[]
  output: ShapeItem[]
  progress: number
  status: EntityStatus
}

export interface BeltRuntime {
  item?: ShapeItem
  lastMovedTick?: number
  enteredTick?: number
}

export interface ViewportState {
  x: number
  y: number
  zoom: number
}

export interface BeltPreview {
  cells: GridPosition[]
  route: Array<{ position: GridPosition; direction: Direction }>
  direction: Direction
  valid: boolean
  tool?: 'belt' | 'tunnel'
}

export interface FactoryError {
  entityId: string
  severity: 'info' | 'warning' | 'critical'
  message: string
  suggestion: string
}

export interface SimulationEvent {
  tick: number
  entityId: string
  message: string
}

export interface FactoryMetrics {
  delivered: Record<string, number>
  produced: Record<string, number>
  trashed: Record<string, number>
  beltItems: number
  activeBuildings: number
  bottlenecks: FactoryError[]
  recentDelivery: number[]
}

export interface DeliveryGoal {
  shape: ShapeId
  amount: number
  delivered: number
}

export interface Blueprint {
  id: string
  name: string
  description: string
  entityIds: string[]
  createdAt: string
}

export interface FactoryProject {
  id: string
  name: string
  tick: number
  running: boolean
  renderAlpha: number
  speed: number
  activeTool: ToolId
  activeDirection: Direction
  selectedEntityId?: string
  viewport: ViewportState
  goals: DeliveryGoal[]
  unlocked: BuildingType[]
  entities: FactoryEntity[]
  belts: Record<string, BeltRuntime>
  metrics: FactoryMetrics
  errors: FactoryError[]
  events: SimulationEvent[]
  blueprints: Blueprint[]
  history: FactoryEntity[][]
}

export interface TickResult {
  project: FactoryProject
  events: SimulationEvent[]
  errors: FactoryError[]
}
