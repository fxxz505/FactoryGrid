import type { FactoryEntity, FactoryProject } from '../models/factory'

export const PROJECT_STORAGE_KEY = 'factorygrid-shapez-v4'
const MANIFEST_KEY = PROJECT_STORAGE_KEY + ':manifest'
const CHUNK_PREFIX = PROJECT_STORAGE_KEY + ':chunk:'
const CHUNK_CELLS = 32
const LEGACY_MIRROR_ENTITY_LIMIT = 1000

export function projectStorageChunkKey(entity: FactoryEntity): string {
  return Math.floor(entity.position.x / CHUNK_CELLS) + ':' + Math.floor(entity.position.y / CHUNK_CELLS)
}

interface ProjectManifest extends Omit<FactoryProject, 'entities'> {
  version: 2
  chunkKeys: string[]
}

export function loadStoredProject(): FactoryProject | undefined {
  const manifestValue = localStorage.getItem(MANIFEST_KEY)
  if (manifestValue) {
    try {
      const manifest = JSON.parse(manifestValue) as ProjectManifest
      const entities = manifest.chunkKeys.flatMap((key) => {
        const value = localStorage.getItem(CHUNK_PREFIX + key)
        return value ? JSON.parse(value) as FactoryEntity[] : []
      })
      const project = { ...manifest } as Partial<ProjectManifest>
      delete project.version
      delete project.chunkKeys
      return { ...project, entities } as FactoryProject
    } catch {
      // Fall through to the legacy single-key save.
    }
  }
  const legacy = localStorage.getItem(PROJECT_STORAGE_KEY)
  if (!legacy) return undefined
  try {
    return JSON.parse(legacy) as FactoryProject
  } catch {
    return undefined
  }
}

export function saveStoredProject(project: FactoryProject, dirtyChunkKeys?: ReadonlySet<string>): void {
  const previous = readManifest()
  const chunks = dirtyChunkKeys && previous
    ? groupEntitiesByChunk(project.entities.filter((entity) => dirtyChunkKeys.has(projectStorageChunkKey(entity))))
    : groupEntitiesByChunk(project.entities)
  chunks.forEach((entities, key) => {
    const value = JSON.stringify(entities)
    const storageKey = CHUNK_PREFIX + key
    if (localStorage.getItem(storageKey) !== value) localStorage.setItem(storageKey, value)
  })
  const chunkKeys = new Set(previous?.chunkKeys ?? [])
  if (dirtyChunkKeys && previous) {
    dirtyChunkKeys.forEach((key) => {
      if (chunks.has(key)) chunkKeys.add(key)
      else {
        chunkKeys.delete(key)
        localStorage.removeItem(CHUNK_PREFIX + key)
      }
    })
  } else {
    previous?.chunkKeys.filter((key) => !chunks.has(key)).forEach((key) => localStorage.removeItem(CHUNK_PREFIX + key))
    chunkKeys.clear()
    chunks.forEach((_, key) => chunkKeys.add(key))
  }
  const projectData = Object.fromEntries(
    Object.entries(project).filter(([key]) => key !== 'entities' && key !== 'history' && key !== 'belts')
  ) as Omit<FactoryProject, 'entities' | 'history' | 'belts'>
  const activeBelts = Object.fromEntries(
    Object.entries(project.belts).filter(([, runtime]) => runtime.item !== undefined)
  )
  const manifest = {
    ...projectData,
    belts: activeBelts,
    history: [],
    version: 2,
    chunkKeys: Array.from(chunkKeys).sort()
  } as ProjectManifest
  localStorage.setItem(MANIFEST_KEY, JSON.stringify(manifest))
  if (project.entities.length < LEGACY_MIRROR_ENTITY_LIMIT) {
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify({ ...project, belts: activeBelts, history: [] }))
  }
}

function readManifest(): ProjectManifest | undefined {
  const value = localStorage.getItem(MANIFEST_KEY)
  if (!value) return undefined
  try {
    return JSON.parse(value) as ProjectManifest
  } catch {
    return undefined
  }
}

function groupEntitiesByChunk(entities: FactoryEntity[]): Map<string, FactoryEntity[]> {
  const chunks = new Map<string, FactoryEntity[]>()
  entities.forEach((entity) => {
    const key = projectStorageChunkKey(entity)
    const chunk = chunks.get(key)
    if (chunk) chunk.push(entity)
    else chunks.set(key, [entity])
  })
  return chunks
}
