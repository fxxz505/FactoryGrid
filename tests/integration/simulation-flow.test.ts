import { describe, expect, it } from 'vitest'
import { createShapezProject } from '../../src/data/examples'
import { beltRoute, buildBeltLine, placeBuilding, rotateDirection, rotateSelectedEntity } from '../../src/engine/simulation/editorActions'
import { runTick, runTicks } from '../../src/engine/simulation/tickEngine'
import { entityConnectionDirections } from '../../src/render/factoryAssets'

describe('shape factory simulation', () => {


  it('produces ore test materials from the three mineral generators', () => {
    let project = createShapezProject()
    project.entities = []
    project.belts = {}

    project = placeBuilding(project, 'source-iron', { x: 0, y: 0 }, 'east')
    project = placeBuilding(project, 'source-coal', { x: 0, y: 2 }, 'east')
    project = placeBuilding(project, 'source-copper', { x: 0, y: 4 }, 'east')

    const result = runTicks(project, 14)

    expect(result.metrics.produced['iron-ore']).toBeGreaterThanOrEqual(1)
    expect(result.metrics.produced['coal-ore']).toBeGreaterThanOrEqual(1)
    expect(result.metrics.produced['copper-ore']).toBeGreaterThanOrEqual(1)
  })

  it('keeps furnace ore and fuel ports distinct while waiting for matching inputs', () => {
    let project = createShapezProject()
    project.entities = []
    project.belts = {}

    project = placeBuilding(project, 'furnace', { x: 0, y: 0 }, 'east')
    project = placeBuilding(project, 'source-coal', { x: -1, y: 0 }, 'east')
    project = placeBuilding(project, 'source-iron', { x: 0, y: -1 }, 'south')

    const wrongPorts = runTicks(project, 18)
    const wrongFurnace = wrongPorts.entities.find((entity) => entity.type === 'furnace')!

    expect(wrongFurnace.input).toHaveLength(0)
    expect(wrongFurnace.output).toHaveLength(0)

    project = createShapezProject()
    project.entities = []
    project.belts = {}

    project = placeBuilding(project, 'furnace', { x: 0, y: 0 }, 'east')
    project = placeBuilding(project, 'source-iron', { x: -1, y: 0 }, 'east')
    project = placeBuilding(project, 'source-coal', { x: 0, y: -1 }, 'south')

    const rightPorts = runTicks(project, 60)
    const rightFurnace = rightPorts.entities.find((entity) => entity.type === 'furnace')!

    expect(rightFurnace.output[0]?.shape).toBe('iron-ingot')
    expect(rightPorts.metrics.produced['iron-ingot']).toBe(1)
  })
  it('smelts ore with coal in a furnace and outputs ingots only after both inputs arrive', () => {
    let project = createShapezProject()
    project.entities = []
    project.belts = {}

    project = placeBuilding(project, 'furnace', { x: 0, y: 0 }, 'east')
    const furnace = project.entities.find((entity) => entity.type === 'furnace')!
    furnace.input.push({ id: 'iron', shape: 'iron-ore', age: 0 })

    const missingFuel = runTicks(project, 40)
    expect(missingFuel.entities.find((entity) => entity.type === 'furnace')?.output).toHaveLength(0)

    const fueled = missingFuel.entities.find((entity) => entity.type === 'furnace')!
    fueled.input.push({ id: 'coal', shape: 'coal-ore', age: 0 })
    const result = runTicks(missingFuel, 40)

    expect(result.entities.find((entity) => entity.type === 'furnace')?.output[0]?.shape).toBe('iron-ingot')
    expect(result.metrics.produced['iron-ingot']).toBe(1)
  })

  it('uses the selected assembler recipe to craft different products', () => {
    let project = createShapezProject()
    project.entities = []
    project.belts = {}

    project = placeBuilding(project, 'assembler', { x: 0, y: 0 }, 'east')
    const assembler = project.entities.find((entity) => entity.type === 'assembler')!
    assembler.recipeId = 'wire'
    assembler.input.push({ id: 'copper', shape: 'copper-ingot', age: 0 })

    const result = runTicks(project, 24)

    expect(result.entities.find((entity) => entity.type === 'assembler')?.output[0]?.shape).toBe('copper-wire')
    expect(result.metrics.produced['copper-wire']).toBe(1)
  })
  it('keeps a render interpolation alpha separate from fixed simulation ticks', () => {
    const project = createShapezProject()

    expect(project.renderAlpha).toBe(0)
    const result = runTick(project).project

    expect(result.tick).toBe(project.tick + 1)
    expect(result.renderAlpha).toBe(0)
  })

  it('moves shapes along directional belt tiles into a painter and hub', () => {
    const project = createShapezProject()

    const result = runTicks(project, 180)

    expect(result.metrics.delivered['circle-red']).toBeGreaterThanOrEqual(5)
    expect(result.goals[0].delivered).toBeGreaterThanOrEqual(5)
    expect(result.errors.some((error) => error.severity === 'critical')).toBe(false)
  })

  it('cuts raw squares into half squares and can discard overflow in trash', () => {
    const project = createShapezProject()

    const result = runTicks(project, 120)

    expect(result.metrics.produced['half-square']).toBeGreaterThanOrEqual(1)
    expect(result.metrics.trashed['half-square']).toBeGreaterThanOrEqual(1)
  })

  it('builds a directional belt line with one drag operation', () => {
    const project = createShapezProject()
    const result = buildBeltLine(project, { x: 10, y: 10 }, { x: 14, y: 10 }, 'east')

    const line = result.entities.filter((entity) => entity.position.y === 10 && entity.type === 'belt')

    expect(line).toHaveLength(5)
    expect(line.every((entity) => entity.direction === 'east')).toBe(true)
  })

  it('builds a connected L-shaped belt route with inferred turn directions', () => {
    const project = createShapezProject()
    const result = buildBeltLine(project, { x: 20, y: 20 }, { x: 23, y: 23 }, 'east')

    const route = result.entities
      .filter((entity) => entity.type === 'belt' && entity.position.x >= 20 && entity.position.x <= 23 && entity.position.y >= 20 && entity.position.y <= 23)
      .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x)

    expect(route).toHaveLength(7)
    expect(route.filter((entity) => entity.position.y === 20 && entity.position.x < 23).every((entity) => entity.direction === 'east')).toBe(true)
    expect(route.filter((entity) => entity.position.x === 23 && entity.position.y > 20).every((entity) => entity.direction === 'south')).toBe(true)
  })



  it('routes splitter output to both side branches instead of passing straight through', () => {
    let project = createShapezProject()
    project.entities = []
    project.belts = {}

    project = placeBuilding(project, 'source-circle', { x: 0, y: 0 }, 'east')
    project = placeBuilding(project, 'belt', { x: 1, y: 0 }, 'east')
    project = placeBuilding(project, 'splitter', { x: 2, y: 0 }, 'east')
    project = placeBuilding(project, 'belt', { x: 2, y: -1 }, 'north')
    project = placeBuilding(project, 'belt', { x: 2, y: 1 }, 'south')

    const result = runTicks(project, 90)
    const upper = result.entities.find((entity) => entity.type === 'belt' && entity.position.x === 2 && entity.position.y === -1)
    const lower = result.entities.find((entity) => entity.type === 'belt' && entity.position.x === 2 && entity.position.y === 1)
    const straight = result.entities.find((entity) => entity.position.x === 3 && entity.position.y === 0)

    expect(straight).toBeUndefined()
    expect(result.belts[upper!.id].item || result.belts[lower!.id].item || upper?.status === 'running' || lower?.status === 'running').toBeTruthy()
  })

  it('draws splitter ports as input plus two side outputs', () => {
    let project = createShapezProject()
    project.entities = []
    project.belts = {}

    project = placeBuilding(project, 'splitter', { x: 2, y: 0 }, 'east')
    project = placeBuilding(project, 'belt', { x: 1, y: 0 }, 'east')
    project = placeBuilding(project, 'belt', { x: 2, y: -1 }, 'north')
    project = placeBuilding(project, 'belt', { x: 2, y: 1 }, 'south')

    const splitter = project.entities.find((entity) => entity.type === 'splitter')

    expect(splitter).toBeDefined()
    expect(entityConnectionDirections(project, splitter!)).toEqual(['north', 'south', 'west'])
  })

  it('places paired underground tunnels by dragging the tunnel tool', () => {
    let project = createShapezProject()
    project.entities = []
    project.belts = {}

    project = buildBeltLine(project, { x: 2, y: 0 }, { x: 5, y: 0 }, 'east', 'tunnel')

    const tunnels = project.entities.filter((entity) => entity.type === 'tunnel').sort((a, b) => a.position.x - b.position.x)

    expect(tunnels).toHaveLength(2)
    expect(tunnels.map((entity) => entity.position)).toEqual([{ x: 2, y: 0 }, { x: 5, y: 0 }])
    expect(tunnels.every((entity) => entity.direction === 'east')).toBe(true)
    expect(Object.keys(project.belts).some((id) => id.startsWith('tunnel-'))).toBe(false)
  })

  it('moves items through paired underground tunnels to the exit belt', () => {
    let project = createShapezProject()
    project.entities = []
    project.belts = {}

    project = placeBuilding(project, 'source-circle', { x: 0, y: 0 }, 'east')
    project = placeBuilding(project, 'belt', { x: 1, y: 0 }, 'east')
    project = placeBuilding(project, 'tunnel', { x: 2, y: 0 }, 'east')
    project = placeBuilding(project, 'tunnel', { x: 5, y: 0 }, 'east')
    project = placeBuilding(project, 'belt', { x: 6, y: 0 }, 'east')
    project = placeBuilding(project, 'hub', { x: 7, y: 0 }, 'east')
    project.goals = [{ shape: 'circle', amount: 1, delivered: 0 }]

    const result = runTicks(project, 90)

    expect(result.metrics.delivered.circle).toBeGreaterThanOrEqual(1)
    expect(result.errors.some((error) => error.entityId.includes('tunnel'))).toBe(false)
  })

  it('does not treat paired tunnel exits as a second underground jump', () => {
    let project = createShapezProject()
    project.entities = []
    project.belts = {}

    project = placeBuilding(project, 'source-circle', { x: 0, y: 0 }, 'east')
    project = placeBuilding(project, 'belt', { x: 1, y: 0 }, 'east')
    project = placeBuilding(project, 'tunnel', { x: 2, y: 0 }, 'east')
    project = placeBuilding(project, 'tunnel', { x: 5, y: 0 }, 'east')
    project = placeBuilding(project, 'belt', { x: 6, y: 0 }, 'east')
    project = placeBuilding(project, 'hub', { x: 9, y: 0 }, 'east')
    project.goals = [{ shape: 'circle', amount: 1, delivered: 0 }]

    const result = runTicks(project, 120)

    expect(result.metrics.delivered.circle ?? 0).toBe(0)
    expect(result.entities.find((entity) => entity.position.x === 6 && entity.type === 'belt')?.status).toBe('blocked')
  })

  it('routes shapes through splitter, merger, tunnel and launcher machines', () => {
    let project = createShapezProject()
    project.entities = []
    project.belts = {}
    project.goals = [{ shape: 'circle', amount: 2, delivered: 0 }]

    project = placeBuilding(project, 'source-circle', { x: 0, y: 0 }, 'east')
    project = placeBuilding(project, 'belt', { x: 1, y: 0 }, 'east')
    project = placeBuilding(project, 'splitter', { x: 2, y: 0 }, 'east')
    project = placeBuilding(project, 'belt', { x: 2, y: -1 }, 'north')
    project = placeBuilding(project, 'belt', { x: 2, y: -2 }, 'south')
    project = placeBuilding(project, 'belt', { x: 2, y: 1 }, 'south')
    project = placeBuilding(project, 'merger', { x: 2, y: 2 }, 'south')
    project = placeBuilding(project, 'tunnel', { x: 2, y: 3 }, 'south')
    project = placeBuilding(project, 'launcher', { x: 2, y: 6 }, 'south')
    project = placeBuilding(project, 'hub', { x: 2, y: 10 }, 'south')

    const result = runTicks(project, 180)

    expect(result.metrics.delivered.circle).toBeGreaterThanOrEqual(1)
    expect(result.entities.find((entity) => entity.type === 'splitter')?.progress).toBeGreaterThan(0)
  })


  it('replaces buildings on occupied cells while keeping the grid deterministic', () => {
    const project = createShapezProject()
    const result = placeBuilding(project, 'cutter', { x: 3, y: 4 }, 'east')

    const cell = result.entities.filter((entity) => entity.position.x === 3 && entity.position.y === 4)

    expect(cell).toHaveLength(1)
    expect(cell[0].type).toBe('cutter')
  })

  it('removes stale belt runtime when a machine replaces a belt', () => {
    let project = createShapezProject()
    project.entities = []
    project.belts = {}

    project = placeBuilding(project, 'belt', { x: 3, y: 4 }, 'east')
    const belt = project.entities.find((entity) => entity.type === 'belt')!
    expect(project.belts[belt.id]).toBeDefined()

    const result = placeBuilding(project, 'tunnel', { x: 3, y: 4 }, 'east')

    expect(result.entities.filter((entity) => entity.position.x === 3 && entity.position.y === 4)).toHaveLength(1)
    expect(result.entities.find((entity) => entity.position.x === 3 && entity.position.y === 4)?.type).toBe('tunnel')
    expect(result.belts[belt.id]).toBeUndefined()
  })



  it('rotates the selected machine direction without changing the active build direction', () => {
    let project = createShapezProject()
    project = placeBuilding(project, 'cutter', { x: 30, y: 30 }, 'east')
    project.activeDirection = 'north'
    const selectedId = project.selectedEntityId

    const result = rotateSelectedEntity(project)

    expect(result.entities.find((entity) => entity.id === selectedId)?.direction).toBe('south')
    expect(result.activeDirection).toBe('north')
  })

  it('uses the same preferred route for belt preview and actual placement', () => {
    const start = { x: 5, y: 5 }
    const end = { x: 8, y: 7 }
    const previewRoute = beltRoute(start, end, 'north')
    const placed = buildBeltLine(createShapezProject(), start, end, 'north')
      .entities
      .filter((entity) => entity.type === 'belt' && entity.position.x >= 5 && entity.position.x <= 8 && entity.position.y >= 5 && entity.position.y <= 7)
      .map((entity) => ({ position: entity.position, direction: entity.direction }))

    expect(placed).toEqual(previewRoute)
  })


  it('preview route carries per-cell directions for turns', () => {
    const route = beltRoute({ x: 0, y: 0 }, { x: 2, y: 2 }, 'east')

    expect(route).toEqual([
      { position: { x: 0, y: 0 }, direction: 'east' },
      { position: { x: 1, y: 0 }, direction: 'east' },
      { position: { x: 2, y: 0 }, direction: 'south' },
      { position: { x: 2, y: 1 }, direction: 'south' },
      { position: { x: 2, y: 2 }, direction: 'south' }
    ])
  })
  it('draws source machines with only one output port even beside unrelated belts', () => {
    let project = createShapezProject()
    project.entities = []
    project.belts = {}

    project = placeBuilding(project, 'source-circle', { x: 10, y: 10 }, 'north')
    project = placeBuilding(project, 'belt', { x: 10, y: 9 }, 'north')
    project = placeBuilding(project, 'belt', { x: 10, y: 11 }, 'east')
    project = placeBuilding(project, 'belt', { x: 9, y: 10 }, 'east')
    project = placeBuilding(project, 'belt', { x: 11, y: 10 }, 'west')

    const source = project.entities.find((entity) => entity.type === 'source-circle')

    expect(source).toBeDefined()
    expect(entityConnectionDirections(project, source!)).toEqual(['north'])
  })
  it('draws single-output processors with only input and output ports', () => {
    let project = createShapezProject()
    project.entities = []
    project.belts = {}

    project = placeBuilding(project, 'cutter', { x: 10, y: 10 }, 'east')
    project = placeBuilding(project, 'belt', { x: 10, y: 9 }, 'south')
    project = placeBuilding(project, 'belt', { x: 11, y: 10 }, 'east')
    project = placeBuilding(project, 'belt', { x: 10, y: 11 }, 'north')
    project = placeBuilding(project, 'belt', { x: 9, y: 10 }, 'west')

    const cutter = project.entities.find((entity) => entity.type === 'cutter')

    expect(cutter).toBeDefined()
    expect(entityConnectionDirections(project, cutter!)).toEqual(['east', 'west'])
  })


  it('keeps merger visual ports on all connected sides', () => {
    let project = createShapezProject()
    project.entities = []
    project.belts = {}

    project = placeBuilding(project, 'merger', { x: 10, y: 10 }, 'east')
    project = placeBuilding(project, 'belt', { x: 10, y: 9 }, 'south')
    project = placeBuilding(project, 'belt', { x: 11, y: 10 }, 'east')
    project = placeBuilding(project, 'belt', { x: 10, y: 11 }, 'north')
    project = placeBuilding(project, 'belt', { x: 9, y: 10 }, 'west')

    const merger = project.entities.find((entity) => entity.type === 'merger')

    expect(merger).toBeDefined()
    expect(entityConnectionDirections(project, merger!)).toEqual(['north', 'east', 'south', 'west'])
  })

  it('keeps router and processor ports visible even before belts are attached', () => {
    let project = createShapezProject()
    project.entities = []
    project.belts = {}

    project = placeBuilding(project, 'tunnel', { x: 4, y: 4 }, 'east')
    project = placeBuilding(project, 'launcher', { x: 8, y: 4 }, 'south')
    project = placeBuilding(project, 'cutter', { x: 12, y: 4 }, 'west')
    project = placeBuilding(project, 'trash', { x: 16, y: 4 }, 'north')

    const tunnel = project.entities.find((entity) => entity.type === 'tunnel')
    const launcher = project.entities.find((entity) => entity.type === 'launcher')
    const cutter = project.entities.find((entity) => entity.type === 'cutter')
    const trash = project.entities.find((entity) => entity.type === 'trash')

    expect(tunnel).toBeDefined()
    expect(launcher).toBeDefined()
    expect(cutter).toBeDefined()
    expect(trash).toBeDefined()
    expect(entityConnectionDirections(project, tunnel!)).toEqual(['east', 'west'])
    expect(entityConnectionDirections(project, launcher!)).toEqual(['north', 'south'])
    expect(entityConnectionDirections(project, cutter!)).toEqual(['east', 'west'])
    expect(entityConnectionDirections(project, trash!)).toEqual(['south'])
  })

  it('runs every existing processor machine with its expected behavior', () => {
    let project = createShapezProject()
    project.entities = []
    project.belts = {}
    project.goals = [{ shape: 'circle', amount: 1, delivered: 0 }]

    project = placeBuilding(project, 'rotator', { x: 0, y: 0 }, 'east')
    project = placeBuilding(project, 'painter-red', { x: 3, y: 0 }, 'east')
    project = placeBuilding(project, 'painter-blue', { x: 6, y: 0 }, 'east')
    project = placeBuilding(project, 'painter-green', { x: 9, y: 0 }, 'east')
    project = placeBuilding(project, 'stacker', { x: 12, y: 0 }, 'east')
    project = placeBuilding(project, 'trash', { x: 15, y: 0 }, 'east')
    project = placeBuilding(project, 'belt', { x: 17, y: 0 }, 'east')
    project = placeBuilding(project, 'hub', { x: 18, y: 0 }, 'east')

    const byType = (type: string) => project.entities.find((entity) => entity.type === type)!
    byType('rotator').input.push({ id: 'star-in', shape: 'star', age: 0 })
    byType('painter-red').input.push({ id: 'circle-in', shape: 'circle', age: 0 })
    byType('painter-blue').input.push({ id: 'square-in', shape: 'square', age: 0 })
    byType('painter-green').input.push({ id: 'green-star-in', shape: 'star', age: 0 })
    byType('stacker').input.push({ id: 'red-circle-in', shape: 'circle-red', age: 0 })
    byType('stacker').input.push({ id: 'square-layer-in', shape: 'square', age: 0 })
    byType('trash').input.push({ id: 'trash-in', shape: 'diamond', age: 0 })
    const hubBelt = project.entities.find((entity) => entity.type === 'belt' && entity.position.x === 17)!
    project.belts[hubBelt.id].item = { id: 'hub-in', shape: 'circle', age: 0 }

    const result = runTicks(project, 30)
    const after = (type: string) => result.entities.find((entity) => entity.type === type)!

    expect(after('rotator').output[0]?.shape).toBe('rotated-star')
    expect(after('painter-red').output[0]?.shape).toBe('circle-red')
    expect(after('painter-blue').output[0]?.shape).toBe('square-blue')
    expect(after('painter-green').output[0]?.shape).toBe('star-green')
    expect(after('stacker').output[0]?.shape).toBe('circle-red+square')
    expect(result.metrics.trashed.diamond).toBe(1)
    expect(result.metrics.delivered.circle).toBe(1)
  })

  it('keeps belt items when the next belt is occupied instead of dropping them', () => {
    let project = createShapezProject()
    project.entities = []
    project.belts = {}

    project = placeBuilding(project, 'belt', { x: 0, y: 0 }, 'east')
    project = placeBuilding(project, 'belt', { x: 1, y: 0 }, 'east')

    const left = project.entities.find((entity) => entity.type === 'belt' && entity.position.x === 0)
    const right = project.entities.find((entity) => entity.type === 'belt' && entity.position.x === 1)

    expect(left).toBeDefined()
    expect(right).toBeDefined()
    project.belts[left!.id].item = { id: 'left-item', shape: 'circle', age: 0 }
    project.belts[right!.id].item = { id: 'right-item', shape: 'square', age: 0 }

    const result = runTick(project).project

    expect(result.belts[left!.id].item?.id).toBe('left-item')
    expect(result.belts[right!.id].item?.id).toBe('right-item')
  })

  it('records when an item enters a belt for smooth conveyor rendering', () => {
    let project = createShapezProject()
    project.entities = []
    project.belts = {}

    project = placeBuilding(project, 'source-circle', { x: 0, y: 0 }, 'east')
    project = placeBuilding(project, 'belt', { x: 1, y: 0 }, 'east')

    const result = runTicks(project, 15)
    const belt = result.entities.find((entity) => entity.type === 'belt')!

    expect(result.belts[belt.id].item).toBeDefined()
    expect(result.belts[belt.id].enteredTick).toBe(result.belts[belt.id].lastMovedTick)
    expect(result.belts[belt.id].enteredTick).toBeGreaterThan(0)
  })

  it('rotates belt direction clockwise', () => {
    expect(rotateDirection('north')).toBe('east')
    expect(rotateDirection('east')).toBe('south')
    expect(rotateDirection('south')).toBe('west')
    expect(rotateDirection('west')).toBe('north')
  })
})
