import { describe, expect, it } from 'vitest'
import { createShapezProject } from '../../src/data/examples'
import { researchById } from '../../src/data/research'
import {
  copyAreaToBlueprint,
  deleteArea,
  pasteBlueprint,
  placeBuilding,
  upgradeArea
} from '../../src/engine/simulation/editorActions'
import { runTick, runTicks } from '../../src/engine/simulation/tickEngine'

describe('industrial expansion systems', () => {
  it('produces iron plates, steel and motors through the expanded recipes', () => {
    let project = createShapezProject()
    project.entities = []
    project.belts = {}

    project = placeBuilding(project, 'assembler', { x: 0, y: 0 }, 'east')
    const plateAssembler = project.entities.find((entity) => entity.type === 'assembler')!
    plateAssembler.recipeId = 'iron-plate'
    plateAssembler.input.push({ id: 'ingot', shape: 'iron-ingot', age: 0 })

    project = placeBuilding(project, 'furnace', { x: 0, y: 2 }, 'east')
    const steelFurnace = project.entities.find((entity) => entity.type === 'furnace')!
    steelFurnace.input.push(
      { id: 'steel-iron', shape: 'iron-ingot', age: 0 },
      { id: 'steel-coal', shape: 'coal-ore', age: 0 }
    )

    project.research.completed.push('metallurgy-automation')
    project = placeBuilding(project, 'assembler', { x: 0, y: 4 }, 'east')
    const motorAssembler = project.entities.find((entity) => entity.type === 'assembler' && entity.position.y === 4)!
    motorAssembler.recipeId = 'motor'
    motorAssembler.input.push(
      { id: 'gear', shape: 'iron-gear', age: 0 },
      { id: 'circuit', shape: 'circuit', age: 0 }
    )

    const result = runTicks(project, 60)

    expect(result.metrics.produced['iron-plate']).toBe(1)
    expect(result.metrics.produced.steel).toBe(1)
    expect(result.metrics.produced.motor).toBe(1)
  })

  it('keeps the motor recipe inactive until metallurgy automation is researched', () => {
    let project = createShapezProject()
    project.entities = []
    project.belts = {}
    project = placeBuilding(project, 'assembler', { x: 0, y: 0 }, 'east')
    const assembler = project.entities.find((entity) => entity.type === 'assembler')!
    assembler.recipeId = 'motor'
    assembler.input.push(
      { id: 'gear', shape: 'iron-gear', age: 0 },
      { id: 'circuit', shape: 'circuit', age: 0 }
    )

    const result = runTicks(project, 80)

    expect(result.metrics.produced.motor).toBeUndefined()
    expect(result.entities.find((entity) => entity.type === 'assembler')?.input).toHaveLength(2)
  })

  it('turns industrial hub deliveries into research points and unlocks research rewards', () => {
    let project = createShapezProject()
    project.entities = []
    project.belts = {}
    project = placeBuilding(project, 'belt', { x: 0, y: 0 }, 'east')
    project = placeBuilding(project, 'hub', { x: 1, y: 0 }, 'east')
    const belt = project.entities.find((entity) => entity.type === 'belt')!

    project.belts[belt.id].item = { id: 'plate-delivery', shape: 'iron-plate', age: 0 }
    project.belts[belt.id].enteredTick = -2
    const delivered = runTick(project).project

    expect(delivered.research.points).toBe(1)
    expect(delivered.research.delivered['iron-plate']).toBe(1)
    expect(delivered.metrics.delivered['iron-plate']).toBe(1)

    delivered.research.points = researchById['logistics-engineering'].cost
    delivered.research.delivered['iron-plate'] = 8
    delivered.research.delivered['copper-wire'] = 8
    const unlocked = runTick(delivered).project

    expect(unlocked.research.completed).toContain('logistics-engineering')
    expect(unlocked.unlocked).toContain('fast-belt')
  })

  it('copies, pastes and deletes rectangular factory areas as one operation', () => {
    let project = createShapezProject()
    project.entities = []
    project.belts = {}
    project = placeBuilding(project, 'belt', { x: 2, y: 3 }, 'south')
    project = placeBuilding(project, 'assembler', { x: 3, y: 3 }, 'east')
    const assembler = project.entities.find((entity) => entity.type === 'assembler')!
    assembler.recipeId = 'circuit'
    assembler.level = 2

    const blueprint = copyAreaToBlueprint(project, { x: 2, y: 3 }, { x: 3, y: 3 }, '电路单元')
    const pasted = pasteBlueprint(project, blueprint, { x: 10, y: 10 })
    const pastedAssembler = pasted.entities.find(
      (entity) => entity.type === 'assembler' && entity.position.x === 11 && entity.position.y === 10
    )

    expect(blueprint.entities).toHaveLength(2)
    expect(pastedAssembler?.recipeId).toBe('circuit')
    expect(pastedAssembler?.level).toBe(2)
    expect(pastedAssembler?.input).toHaveLength(0)

    const deleted = deleteArea(pasted, { x: 10, y: 10 }, { x: 11, y: 10 })
    expect(deleted.entities.some((entity) => entity.position.x >= 10 && entity.position.x <= 11 && entity.position.y === 10)).toBe(false)
  })

  it('upgrades belts and production machines within a selected area', () => {
    let project = createShapezProject()
    project.entities = []
    project.belts = {}
    project.research.completed.push('automation-upgrade')
    project.research.maxMachineLevel = 2
    project = placeBuilding(project, 'belt', { x: 0, y: 0 }, 'east')
    project = placeBuilding(project, 'assembler', { x: 1, y: 0 }, 'east')
    project = placeBuilding(project, 'hub', { x: 2, y: 0 }, 'east')

    const result = upgradeArea(project, { x: 0, y: 0 }, { x: 2, y: 0 })

    expect(result.entities.find((entity) => entity.position.x === 0)?.type).toBe('fast-belt')
    expect(result.entities.find((entity) => entity.position.x === 1)?.level).toBe(2)
    expect(result.entities.find((entity) => entity.position.x === 2)?.level).toBeUndefined()
  })

  it('rejects conveyor input for a research-locked assembler recipe', () => {
    let project = createShapezProject()
    project.entities = []
    project.belts = {}
    project = placeBuilding(project, 'belt', { x: 0, y: 0 }, 'east')
    project = placeBuilding(project, 'assembler', { x: 1, y: 0 }, 'east')
    const belt = project.entities.find((entity) => entity.kind === 'belt')!
    const assembler = project.entities.find((entity) => entity.type === 'assembler')!
    assembler.recipeId = 'motor'
    project.belts[belt.id].item = { id: 'locked-gear', shape: 'iron-gear', age: 0 }
    project.belts[belt.id].enteredTick = -2

    const result = runTick(project).project

    expect(result.belts[belt.id].item?.id).toBe('locked-gear')
    expect(result.entities.find((entity) => entity.type === 'assembler')?.input).toHaveLength(0)
  })

  it('counts direct machine delivery to a hub exactly once', () => {
    let project = createShapezProject()
    project.entities = []
    project.belts = {}
    project = placeBuilding(project, 'assembler', { x: 0, y: 0 }, 'east')
    project = placeBuilding(project, 'hub', { x: 1, y: 0 }, 'east')
    const assembler = project.entities.find((entity) => entity.type === 'assembler')!
    assembler.output.push({ id: 'direct-plate', shape: 'iron-plate', age: 0 })

    const result = runTick(project).project

    expect(result.metrics.delivered['iron-plate']).toBe(1)
    expect(result.research.points).toBe(1)
  })
  it('moves fast belts more often than standard belts without dropping blocked items', () => {
    let normal = createShapezProject()
    normal.entities = []
    normal.belts = {}
    normal = placeBuilding(normal, 'belt', { x: 0, y: 0 }, 'east')
    normal = placeBuilding(normal, 'belt', { x: 1, y: 0 }, 'east')
    const normalStart = normal.entities.find((entity) => entity.position.x === 0)!
    normal.belts[normalStart.id].item = { id: 'normal', shape: 'iron-ore', age: 0 }
    normal.belts[normalStart.id].enteredTick = normal.tick

    let fast = createShapezProject()
    fast.entities = []
    fast.belts = {}
    fast.unlocked.push('fast-belt')
    fast = placeBuilding(fast, 'fast-belt', { x: 0, y: 0 }, 'east')
    fast = placeBuilding(fast, 'fast-belt', { x: 1, y: 0 }, 'east')
    const fastStart = fast.entities.find((entity) => entity.position.x === 0)!
    fast.belts[fastStart.id].item = { id: 'fast', shape: 'iron-ore', age: 0 }
    fast.belts[fastStart.id].enteredTick = fast.tick

    const normalAfter = runTick(normal).project
    const fastAfter = runTick(fast).project

    expect(normalAfter.belts[normalStart.id].item?.id).toBe('normal')
    expect(fastAfter.belts[fastStart.id].item).toBeUndefined()
    expect(Object.values(fastAfter.belts).some((runtime) => runtime.item?.id === 'fast')).toBe(true)
  })
})
