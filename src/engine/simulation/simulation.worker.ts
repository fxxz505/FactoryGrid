import { runTicks } from './tickEngine'
import type { FactoryProject } from '../../models/factory'

interface SimulationRequest {
  id: number
  project?: FactoryProject
  steps: number
}

let workerProject: FactoryProject | undefined

self.onmessage = (event: MessageEvent<SimulationRequest>) => {
  const { id, project, steps } = event.data
  if (project) workerProject = project
  if (!workerProject) return
  workerProject = runTicks(workerProject, steps)
  self.postMessage({ id, project: workerProject })
}
