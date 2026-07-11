import { describe, expect, it } from 'vitest'
import { createShapezProject } from '../../src/data/examples'
import { buildBeltLine, createPlacementEntity, placeBuilding } from '../../src/engine/simulation/editorActions'
import { entityConnectionDirections, machineGeometryFor, machinePortRoles, planBeltSprite } from '../../src/render/factoryAssets'
import { buildings } from '../../src/data/machines'
import type { FactoryEntity } from '../../src/models/factory'
import { BELT_ITEM_RADIUS, FACTORY_CHUNK_CELLS, beltPathPoint, factoryChunkKey, factoryChunkSignature, resolveBeltInputDirection } from '../../src/render/canvasRenderer'

describe('factory geometric rendering contract', () => {
  it('maps every available machine to a local geometric style instead of image assets', () => {
    buildings.forEach((building) => {
      const style = machineGeometryFor(building.id)
      expect(style.body).toMatch(/^#|^rgb|^hsl/)
      expect(style.accent).toMatch(/^#|^rgb|^hsl/)
    })
  })

  it('classifies seamless belt sprites from neighboring belts', () => {
    let project = createShapezProject()
    project.entities = []
    project.belts = {}

    project = buildBeltLine(project, { x: 0, y: 0 }, { x: 2, y: 1 }, 'east')

    const corner = project.entities.find((entity) => entity.type === 'belt' && entity.position.x === 2 && entity.position.y === 0)
    expect(corner).toBeTruthy()
    expect(planBeltSprite(project, corner!).kind).toBe('corner')
  })

  it('keeps cached entity indexes consistent with direct topology lookup', () => {
    let project = createShapezProject()
    project.entities = []
    project.belts = {}
    project = buildBeltLine(project, { x: 0, y: 0 }, { x: 2, y: 1 }, 'east')

    const corner = project.entities.find((entity) => entity.position.x === 2 && entity.position.y === 0)
    const entityIndex = new Map(project.entities.map((entity) => [
      `${entity.position.x},${entity.position.y}`,
      entity
    ]))

    expect(corner).toBeTruthy()
    expect(planBeltSprite(project, corner!, entityIndex)).toEqual(planBeltSprite(project, corner!))
    expect(planBeltSprite(project, corner!, entityIndex).connections).toEqual(['south', 'west'])
  })

  it('only exposes real belt flow connections instead of every adjacent belt', () => {
    let project = createShapezProject()
    project.entities = []
    project.belts = {}

    project = buildBeltLine(project, { x: 0, y: 0 }, { x: 2, y: 0 }, 'east')
    project = buildBeltLine(project, { x: 1, y: -1 }, { x: 1, y: -1 }, 'east')

    const middle = project.entities.find((entity) => entity.type === 'belt' && entity.position.x === 1 && entity.position.y === 0)

    expect(middle).toBeTruthy()
    expect(planBeltSprite(project, middle!).connections).toEqual(['east', 'west'])
  })

  it('stores the belt output direction separately from visual connections', () => {
    let project = createShapezProject()
    project.entities = []
    project.belts = {}

    project = buildBeltLine(project, { x: 0, y: 0 }, { x: 2, y: 1 }, 'east')

    const corner = project.entities.find((entity) => entity.type === 'belt' && entity.position.x === 2 && entity.position.y === 0)
    const plan = planBeltSprite(project, corner!)

    expect(plan.kind).toBe('corner')
    expect(plan.direction).toBe('south')
    expect(plan.connections).toEqual(['south', 'west'])
  })

  it('uses the belt that actually points into a corner as its visual input', () => {
    const project = createShapezProject()
    project.entities = [
      { id: 'corner', kind: 'belt', type: 'belt', label: 'corner', position: { x: 1, y: 1 }, direction: 'east', input: [], output: [], progress: 0, status: 'idle' },
      { id: 'upstream', kind: 'belt', type: 'belt', label: 'upstream', position: { x: 1, y: 0 }, direction: 'south', input: [], output: [], progress: 0, status: 'idle' },
      { id: 'unrelated', kind: 'belt', type: 'belt', label: 'unrelated', position: { x: 0, y: 1 }, direction: 'west', input: [], output: [], progress: 0, status: 'idle' }
    ]

    expect(resolveBeltInputDirection(project, project.entities[0])).toBe('north')
  })

  it('uses a splitter side output as the input of a turning belt', () => {
    const project = createShapezProject()
    project.entities = [
      { id: 'corner', kind: 'belt', type: 'belt', label: 'corner', position: { x: 1, y: 1 }, direction: 'east', input: [], output: [], progress: 0, status: 'idle' },
      { id: 'splitter', kind: 'processor', type: 'splitter', label: 'splitter', position: { x: 1, y: 2 }, direction: 'east', input: [], output: [], progress: 0, status: 'idle' }
    ]

    expect(resolveBeltInputDirection(project, project.entities[0])).toBe('south')
  })

  it('keeps corner cargo on a continuous curved path inside the belt cell', () => {
    const before = beltPathPoint(0, 0, 46, 'north', 'east', 0.49)
    const after = beltPathPoint(0, 0, 46, 'north', 'east', 0.51)
    const end = beltPathPoint(0, 0, 46, 'north', 'east', 1)

    expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(2)
    expect(end.x).toBeGreaterThan(44)
    expect(end.y).toBe(23)
  })

  it('keeps equal progress steps visually even around a corner', () => {
    const points = [0, 0.25, 0.5, 0.75, 1].map((progress) => beltPathPoint(0, 0, 46, 'north', 'east', progress))
    const distances = points.slice(1).map((point, index) => Math.hypot(point.x - points[index].x, point.y - points[index].y))

    expect(Math.max(...distances) - Math.min(...distances)).toBeLessThan(1.5)
    expect(BELT_ITEM_RADIUS).toBe(10.5)
  })

  it('maps positive and negative world cells into stable 32x32 chunks', () => {
    expect(FACTORY_CHUNK_CELLS).toBe(32)
    expect(factoryChunkKey({ x: 0, y: 0 })).toBe('0:0')
    expect(factoryChunkKey({ x: 31, y: 31 })).toBe('0:0')
    expect(factoryChunkKey({ x: 32, y: 32 })).toBe('1:1')
    expect(factoryChunkKey({ x: -1, y: -1 })).toBe('-1:-1')
    expect(factoryChunkKey({ x: -32, y: -32 })).toBe('-1:-1')
    expect(factoryChunkKey({ x: -33, y: -33 })).toBe('-2:-2')
  })

  it('invalidates only chunks affected by local topology changes', () => {
    const project = createShapezProject()
    project.entities = [
      { id: 'local', kind: 'belt', type: 'belt', label: 'local', position: { x: 31, y: 4 }, direction: 'east', input: [], output: [], progress: 0, status: 'idle' },
      { id: 'far', kind: 'processor', type: 'cutter', label: 'far', position: { x: 80, y: 80 }, direction: 'east', input: [], output: [], progress: 0, status: 'idle' }
    ]
    const initial = factoryChunkSignature(project, 0, 0)

    project.entities[1] = { ...project.entities[1], direction: 'south' }
    expect(factoryChunkSignature(project, 0, 0)).toBe(initial)

    project.entities.push({
      id: 'neighbor',
      kind: 'belt',
      type: 'belt',
      label: 'neighbor',
      position: { x: 32, y: 4 },
      direction: 'east',
      input: [],
      output: [],
      progress: 0,
      status: 'idle'
    })
    expect(factoryChunkSignature(project, 0, 0)).not.toBe(initial)
  })
  it('constructs machine previews through the same entity path as final placement', () => {
    const position = { x: 100, y: 100 }
    const previewable = buildings.filter((building) => !['belt', 'fast-belt', 'tunnel'].includes(building.id))

    previewable.forEach((building) => {
      const preview = createPlacementEntity(building.id, position, 'south')
      const placedProject = placeBuilding(createShapezProject(), building.id, position, 'south')
      const placed = placedProject.entities.find((entity) => (
        entity.position.x === position.x && entity.position.y === position.y
      ))

      expect(placed).toBeTruthy()
      expect({ ...placed, id: 'placement-preview' }).toEqual(preview)
    })
  })
  it('exposes furnace and assembler as multi-port machines with input and output roles', () => {
    const project = createShapezProject()
    const furnace: FactoryEntity = { id: 'furnace-test', kind: 'processor', type: 'furnace', label: 'furnace', position: { x: 0, y: 0 }, direction: 'east', input: [], output: [], progress: 0, status: 'idle' }
    const assembler: FactoryEntity = { id: 'assembler-test', kind: 'processor', type: 'assembler', label: 'assembler', position: { x: 0, y: 2 }, direction: 'east', input: [], output: [], progress: 0, status: 'idle' }

    expect(machinePortRoles(furnace)).toEqual([
      { direction: 'east', role: 'output' },
      { direction: 'west', role: 'input' },
      { direction: 'north', role: 'input' }
    ])
    expect(entityConnectionDirections(project, furnace)).toEqual(['north', 'east', 'west'])
    expect(machinePortRoles(assembler)).toEqual([
      { direction: 'east', role: 'output' },
      { direction: 'west', role: 'input' },
      { direction: 'north', role: 'input' },
      { direction: 'south', role: 'input' }
    ])
    expect(entityConnectionDirections(project, assembler)).toEqual(['north', 'east', 'south', 'west'])
  })
  it('exposes the research lab as a four-way input-only machine', () => {
    const lab: FactoryEntity = { id: 'lab-test', kind: 'processor', type: 'research-lab', label: 'lab', position: { x: 0, y: 0 }, direction: 'east', input: [], output: [], progress: 0, status: 'idle' }

    expect(machinePortRoles(lab)).toEqual([
      { direction: 'north', role: 'input' },
      { direction: 'east', role: 'input' },
      { direction: 'south', role: 'input' },
      { direction: 'west', role: 'input' }
    ])
  })
})
