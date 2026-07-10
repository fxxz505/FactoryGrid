import { describe, expect, it } from 'vitest'
import { createShapezProject } from '../../src/data/examples'
import { buildBeltLine } from '../../src/engine/simulation/editorActions'
import { entityConnectionDirections, machineGeometryFor, machinePortRoles, planBeltSprite } from '../../src/render/factoryAssets'
import { buildings } from '../../src/data/machines'
import type { FactoryEntity } from '../../src/models/factory'

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