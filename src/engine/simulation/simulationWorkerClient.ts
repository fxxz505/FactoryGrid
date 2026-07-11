import type { FactoryProject } from '../../models/factory'

const WORKER_ENTITY_THRESHOLD = 1800

export class SimulationWorkerClient {
  private worker?: Worker
  private requestId = 0
  private pending = false
  private syncedRevision = -1

  shouldUseWorker(project: FactoryProject): boolean {
    return typeof Worker !== 'undefined' && project.entities.length >= WORKER_ENTITY_THRESHOLD
  }

  isBusy(): boolean {
    return this.pending
  }

  step(project: FactoryProject, steps: number, revision: number, onComplete: (project: FactoryProject) => void): boolean {
    if (!this.shouldUseWorker(project) || this.pending) return false
    this.worker ??= new Worker(new URL('./simulation.worker.ts', import.meta.url), { type: 'module' })
    const id = ++this.requestId
    this.pending = true
    this.worker.onmessage = (event: MessageEvent<{ id: number; project: FactoryProject }>) => {
      if (event.data.id !== id) return
      this.pending = false
      onComplete(event.data.project)
    }
    const nextProject = this.syncedRevision === revision ? undefined : project
    this.syncedRevision = revision
    this.worker.postMessage({ id, project: nextProject, steps })
    return true
  }

  dispose(): void {
    this.worker?.terminate()
    this.worker = undefined
    this.pending = false
    this.syncedRevision = -1
  }
}

export const SIMULATION_WORKER_THRESHOLD = WORKER_ENTITY_THRESHOLD
