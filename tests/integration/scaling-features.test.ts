import { beforeEach, describe, expect, it } from 'vitest'
import { createShapezProject } from '../../src/data/examples'
import {
  copyAreaToBlueprint, deleteAt, editorTopologyMutation, pasteBlueprintWithOptions, placeBuilding, upgradeArea
} from '../../src/engine/simulation/editorActions'
import { SimulationWorkerClient, SIMULATION_WORKER_THRESHOLD } from '../../src/engine/simulation/simulationWorkerClient'
import { createFactoryChunkSnapshot, updateFactoryChunkSnapshot } from '../../src/render/canvasRenderer'
import { loadStoredProject, saveStoredProject } from '../../src/utils/projectStorage'

describe('large factory expansion systems', () => {
  beforeEach(() => localStorage.clear())

  it('rotates, mirrors and replaces logistics tiers while pasting blueprints', () => {
    const project = createShapezProject()
    project.entities = project.entities.filter((entity) => entity.id === 'belt-a1' || entity.id === 'splitter-a')
    project.belts = { 'belt-a1': {} }
    const blueprint = copyAreaToBlueprint(project, { x: 1, y: 1 }, { x: 2, y: 1 }, '物流蓝图')
    const pasted = pasteBlueprintWithOptions(project, blueprint, { x: 20, y: 20 }, {
      rotation: 90,
      mirrorX: true,
      beltTier: 'express-belt'
    })
    const newEntities = pasted.entities.filter((entity) => entity.position.x >= 20)

    expect(newEntities).toHaveLength(2)
    expect(newEntities.some((entity) => entity.type === 'express-belt')).toBe(true)
    expect(newEntities.map((entity) => entity.position.y).sort()).toEqual([20, 21])
  })

  it('upgrades logistics through normal, fast and express tiers', () => {
    const project = createShapezProject()
    project.entities = project.entities.filter((entity) => entity.id === 'belt-a1')
    project.research.completed = ['automation-upgrade', 'mass-production']
    project.research.maxMachineLevel = 3

    const fast = upgradeArea(project, { x: 1, y: 1 }, { x: 1, y: 1 })
    const express = upgradeArea(fast, { x: 1, y: 1 }, { x: 1, y: 1 })

    expect(fast.entities[0].type).toBe('fast-belt')
    expect(express.entities[0].type).toBe('express-belt')
  })

  it('switches simulation work to a worker only for large factories', () => {
    const client = new SimulationWorkerClient()
    const small = createShapezProject()
    const large = createShapezProject()
    large.entities = Array.from({ length: SIMULATION_WORKER_THRESHOLD }, (_, index) => ({
      ...small.entities[0],
      id: 'large-' + index,
      position: { x: index, y: 0 }
    }))

    expect(client.shouldUseWorker(small)).toBe(false)
    expect(client.shouldUseWorker(large)).toBe(typeof Worker !== 'undefined')
    client.dispose()
  })

  it('keeps GPU cargo batching available as a progressive enhancement', async () => {
    const source = await import('../../src/render/webglCargoRenderer')
    expect(source.WebglCargoRenderer).toBeTypeOf('function')
  })

  it('stores entities in 32x32 chunks while preserving legacy save compatibility', () => {
    const project = createShapezProject()
    project.entities.push({ ...project.entities[0], id: 'far-entity', position: { x: 70, y: -40 } })
    saveStoredProject(project)

    expect(localStorage.getItem('factorygrid-shapez-v4:manifest')).toContain('chunkKeys')
    expect(Object.keys(localStorage).some((key) => key.startsWith('factorygrid-shapez-v4:chunk:'))).toBe(true)
    expect(loadStoredProject()?.entities.some((entity) => entity.id === 'far-entity')).toBe(true)
    expect(localStorage.getItem('factorygrid-shapez-v4')).toContain('far-entity')
  })

  it('avoids writing a full legacy mirror for very large factories', () => {
    const project = createShapezProject()
    project.entities = Array.from({ length: 1000 }, (_, index) => ({
      ...project.entities[0], id: 'chunked-' + index, position: { x: index, y: index % 4 }
    }))
    saveStoredProject(project)

    expect(localStorage.getItem('factorygrid-shapez-v4:manifest')).toBeTruthy()
    expect(localStorage.getItem('factorygrid-shapez-v4')).toBeNull()
    expect(loadStoredProject()?.entities).toHaveLength(1000)
  })

  it('edits a large factory without deep-cloning unrelated project state', () => {
    const project = createShapezProject()
    project.entities = Array.from({ length: 6000 }, (_, index) => ({
      ...project.entities[0], id: 'edit-' + index, position: { x: index, y: 0 }
    }))
    const metrics = project.metrics
    const research = project.research
    const blueprints = project.blueprints

    const placed = placeBuilding(project, 'belt', { x: 10, y: 0 }, 'east')
    const deleted = deleteAt(placed, { x: 10, y: 0 })

    expect(placed.metrics).toBe(metrics)
    expect(placed.research).toBe(research)
    expect(placed.blueprints).toBe(blueprints)
    expect(placed.entities).not.toBe(project.entities)
    expect(deleted.entities.some((entity) => entity.position.x === 10 && entity.position.y === 0)).toBe(false)
  })

  it('updates only the affected chunk topology after an editor mutation', () => {
    const project = createShapezProject()
    const snapshot = createFactoryChunkSnapshot(project)
    const untouchedSignature = snapshot.signatures.get('0:0')
    const next = placeBuilding(project, 'belt', { x: 70, y: 70 }, 'east')
    const mutation = editorTopologyMutation(next)
    expect(mutation).toBeDefined()

    updateFactoryChunkSnapshot(snapshot, mutation?.removed ?? [], mutation?.added ?? [])

    expect(snapshot.entityIndex.get('70,70')?.type).toBe('belt')
    expect(snapshot.entities.get('2:2')?.some((entity) => entity.position.x === 70)).toBe(true)
    expect(snapshot.signatures.get('0:0')).toBe(untouchedSignature)
  })

  it('persists compact runtime state without editor history or empty belt slots', () => {
    const project = createShapezProject()
    project.history = [project.entities]
    project.belts['empty-belt'] = {}
    saveStoredProject(project)

    const manifest = localStorage.getItem('factorygrid-shapez-v4:manifest') ?? ''
    expect(manifest).toContain('"history":[]')
    expect(manifest).not.toContain('empty-belt')
    expect(loadStoredProject()?.history).toEqual([])
  })
})
