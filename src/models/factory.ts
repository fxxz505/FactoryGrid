export type ShapeId =
  | 'circle'
  | 'square'
  | 'star'
  | 'diamond'
  | 'iron-ore'
  | 'coal-ore'
  | 'copper-ore'
  | 'iron-ingot'
  | 'copper-ingot'
  | 'iron-plate'
  | 'steel'
  | 'iron-gear'
  | 'copper-wire'
  | 'circuit'
  | 'motor'
  | 'bearing'
  | 'steel-frame'
  | 'processor'
  | 'servo'
  | 'automation-core'
  | 'logistics-pack'
  | 'automation-pack'
  | 'metallurgy-pack'
  | 'electronics-pack'
  | 'robotics-pack'
  | 'core-pack'
  | 'utility-pack'
  | 'half-circle'
  | 'half-square'
  | 'circle-red'
  | 'circle-blue'
  | 'circle-green'
  | 'square-red'
  | 'square-blue'
  | 'square-green'
  | 'star-red'
  | 'star-blue'
  | 'star-green'
  | 'diamond-red'
  | 'diamond-blue'
  | 'diamond-green'
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
  | 'source-iron'
  | 'source-coal'
  | 'source-copper'
  | 'belt'
  | 'fast-belt'
  | 'express-belt'
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
  | 'furnace'
  | 'assembler'
  | 'research-lab'
  | 'hub'
  | 'trash'

export type Direction = 'north' | 'east' | 'south' | 'west'
export type EntityStatus = 'idle' | 'running' | 'waiting' | 'blocked' | 'delivering'
export type AreaTool = 'copy-area' | 'paste-blueprint' | 'delete-area' | 'upgrade-area'
export type ToolId = BuildingType | 'select' | 'pan' | 'delete' | AreaTool
export type RenderQuality = 'high' | 'balanced' | 'performance'
export type BlueprintRotation = 0 | 90 | 180 | 270
export type BeltTier = 'keep' | 'belt' | 'fast-belt' | 'express-belt'

export interface GridPosition {
  x: number
  y: number
}

export interface GridArea {
  start: GridPosition
  end: GridPosition
}

export interface ShapeDefinition {
  id: ShapeId
  name: string
  code: string
  color: string
  accent?: string
  description: string
  tier?: number
}

export interface BuildingDefinition {
  id: BuildingType
  name: string
  kind: EntityKind
  hotkey: string
  durationTicks: number
  description: string
}

export interface RecipeIngredient {
  shape: ShapeId
  amount: number
}

export interface RecipeDefinition {
  id: string
  name: string
  machine: 'furnace' | 'assembler'
  inputs: RecipeIngredient[]
  output: ShapeId
  outputAmount?: number
  durationTicks: number
  description: string
  requiredResearch?: string
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
  recipeId?: string
  level?: number
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
  beltType?: 'belt' | 'fast-belt' | 'express-belt'
}

export interface AreaPreview {
  start: GridPosition
  end: GridPosition
  mode: 'copy' | 'delete' | 'upgrade'
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

export interface BlueprintEntity {
  type: BuildingType
  offset: GridPosition
  direction: Direction
  recipeId?: string
  level?: number
}

export interface Blueprint {
  id: string
  name: string
  description: string
  entityIds?: string[]
  entities: BlueprintEntity[]
  width: number
  height: number
  createdAt: string
}

export interface BlueprintPasteOptions {
  rotation: BlueprintRotation
  mirrorX: boolean
  beltTier: BeltTier
}

export interface MapBookmark {
  id: string
  name: string
  position: GridPosition
}

export interface ResearchRequirement {
  shape: ShapeId
  amount: number
}

export interface ResearchDefinition {
  id: string
  name: string
  description: string
  cost: number
  prerequisites: string[]
  requirements: ResearchRequirement[]
  unlockBuildings?: BuildingType[]
  unlockRecipes?: string[]
  maxMachineLevel?: number
  durationTicks: number
}

export interface ResearchState {
  points: number
  delivered: Partial<Record<ShapeId, number>>
  progress: Record<string, number>
  consumed: Record<string, Partial<Record<ShapeId, number>>>
  completed: string[]
  maxMachineLevel: number
}

export interface FactoryPerformance {
  fps: number
  frameTime: number
  quality: RenderQuality
  simulationMode?: 'main' | 'worker'
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
  research: ResearchState
  performance: FactoryPerformance
  errors: FactoryError[]
  events: SimulationEvent[]
  blueprints: Blueprint[]
  mapBookmarks: MapBookmark[]
  history: FactoryEntity[][]
}

export interface TickResult {
  project: FactoryProject
  events: SimulationEvent[]
  errors: FactoryError[]
}
