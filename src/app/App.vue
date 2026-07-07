<template>
  <main class="shape-app">
    <header class="shape-topbar">
      <div class="brand-block">
        <span class="brand-mark">&#24322;</span>
        <div>
          <h1>&#24322;&#24418;&#24037;&#21378;&#32534;&#36753;&#22120;</h1>
          <p>{{ project.name }} <span class="sep">/</span> &#31532; {{ project.tick }} tick <span class="sep">/</span> &#20256;&#36865;&#24102;&#19978; {{ project.metrics.beltItems }} &#20010;&#22270;&#24418;</p>
        </div>
      </div>

      <div class="run-controls">
        <button class="primary" type="button" @click="toggleRun"><Pause v-if="project.running" :size="16" /><Play v-else :size="16" />{{ project.running ? '\u6682\u505c' : '\u8fd0\u884c' }}</button>
        <button type="button" @click="step"><StepForward :size="16" />&#21333;&#27493;</button>
        <button type="button" @click="resetProject"><RefreshCw :size="16" />&#37325;&#32622;</button>
        <button type="button" @click="rotateTool"><RotateCw :size="16" />&#26059;&#36716; {{ arrowFor(project.activeDirection) }}</button>
        <button type="button" @click="centerViewport"><Focus :size="16" />&#22238;&#21040;&#24037;&#21378;</button>
        <button type="button" @click="undoProject"><Undo2 :size="16" />&#25764;&#38144;</button>
      </div>

      <div class="goal-strip">
        <div v-for="goal in project.goals" :key="goal.shape" class="goal-pill">
          <span :style="{ background: shapeById[goal.shape]?.color }">{{ shapeById[goal.shape]?.code }}</span>
          <strong>{{ goal.delivered }}/{{ goal.amount }}</strong>
        </div>
      </div>
    </header>

    <section class="shape-workspace">
      <aside class="tool-panel">
        <section class="panel-block tool-grid-panel">
          <div class="panel-heading">
            <h2>&#24314;&#36896;</h2>
            <span>{{ activeToolName }}</span>
          </div>
          <button class="tool-row pan-tool" :class="{ active: project.activeTool === 'pan' }" type="button" title="&#25302;&#21160;&#30011;&#24067;&#65292;&#26816;&#26597;&#22823;&#35268;&#27169;&#20135;&#32447;&#12290;" @click="selectTool('pan')">
            <span class="tool-glyph"><Move :size="18" /></span>
            <span><strong>&#31227;&#21160;&#30011;&#24067;</strong><small>&#25302;&#21160;&#35270;&#35282;&#65292;&#19981;&#25918;&#32622;&#24314;&#31569;&#12290;</small></span>
          </button>
          <button
            v-for="building in visibleBuildings"
            :key="building.id"
            class="tool-row"
            :class="{ active: project.activeTool === building.id }"
            type="button"
            :title="building.description"
            @click="selectTool(building.id)"
          >
            <MachineIcon :type="building.id" />
            <span>
              <strong>{{ building.name }}</strong>
              <small>{{ building.hotkey }} <span class="sep">/</span> {{ building.description }}</small>
            </span>
          </button>
          <button class="tool-row danger-tool" :class="{ active: project.activeTool === 'delete' }" type="button" @click="selectTool('delete')">
            <span class="tool-glyph">&#21024;</span>
            <span><strong>&#31227;&#21160;&#30011;&#24067;</strong><small>&#25302;&#21160;&#35270;&#35282;&#65292;&#19981;&#25918;&#32622;&#24314;&#31569;&#12290;</small></span>
          </button>
        </section>

        <section class="panel-block">
          <div class="panel-heading"><h2>&#34013;&#22270;</h2><span>{{ project.blueprints.length }}</span></div>
          <article v-for="blueprint in project.blueprints" :key="blueprint.id" class="blueprint-card">
            <strong>{{ blueprint.name }}</strong>
            <p>{{ blueprint.description }}</p>
            <button type="button" @click="applyBlueprint(blueprint.entityIds)">&#30422;&#31456;&#22797;&#21046;</button>
          </article>
          <button class="wide-action" type="button" @click="saveBlueprint">&#20445;&#23384;&#24403;&#21069;&#21069; 10 &#20010;&#24314;&#31569;</button>
        </section>
      </aside>

      <section class="canvas-column">
        <FactoryCanvas
          :project="project"
          :selected-entity-id="project.selectedEntityId"
          @select="project.selectedEntityId = $event"
          @place="handlePlace"
          @drag-belt="handleDragBelt"
          @delete-cell="handleDeleteCell"
          @viewport-change="handleViewportChange"
        />
        <SimulationBar :metrics="project.metrics" :errors="project.errors" :events="project.events" />
      </section>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive } from 'vue'
import { Focus, Move, Pause, Play, RefreshCw, RotateCw, StepForward, Undo2 } from '@lucide/vue'
import FactoryCanvas from '../components/editor/FactoryCanvas.vue'
import SimulationBar from '../components/editor/SimulationBar.vue'
import MachineIcon from '../components/editor/MachineIcon.vue'
import { buildings, buildingById } from '../data/machines'
import { shapeById } from '../data/resources'
import { createShapezProject, createEntity } from '../data/examples'
import { runTick } from '../engine/simulation/tickEngine'
import { buildBeltLine, deleteAt, placeBuilding, rotateDirection, rotateSelectedEntity, undo } from '../engine/simulation/editorActions'
import type { BuildingType, Direction, FactoryProject, GridPosition, ToolId, ViewportState } from '../models/factory'

const STORAGE_KEY = 'factorygrid-shapez-v4'
const project = reactive(loadProject())
let frameHandle = 0
let lastFrameTime = 0
let simAccumulator = 0
let saveTimer: number | undefined
let lastSavedAt = 0
const SAVE_THROTTLE_MS = 1200
const SIMULATION_STEP_MS = 170

const visibleBuildings = computed(() => buildings.filter((building) => project.unlocked.includes(building.id)))
const activeToolName = computed(() => project.activeTool === 'delete' ? '\u62c6\u9664' : project.activeTool === 'pan' ? '\u79fb\u52a8\u753b\u5e03' : buildingById[project.activeTool]?.name ?? project.activeTool)

function loadProject(): FactoryProject {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (!saved) return createShapezProject()
  try {
    const parsed = JSON.parse(saved) as FactoryProject
    return parsed.goals && parsed.unlocked && parsed.viewport ? { ...parsed, renderAlpha: parsed.renderAlpha ?? 0 } : createShapezProject()
  } catch {
    return createShapezProject()
  }
}

function replaceProject(next: FactoryProject, persist = true): void {
  Object.assign(project, next)
  if (persist) saveProject()
  else scheduleSaveProject()
}

function saveProject(): void {
  if (saveTimer) {
    window.clearTimeout(saveTimer)
    saveTimer = undefined
  }
  lastSavedAt = Date.now()
  localStorage.setItem(STORAGE_KEY, JSON.stringify(project))
}

function scheduleSaveProject(): void {
  const elapsed = Date.now() - lastSavedAt
  if (elapsed >= SAVE_THROTTLE_MS) {
    saveProject()
    return
  }
  if (saveTimer) return
  saveTimer = window.setTimeout(saveProject, SAVE_THROTTLE_MS - elapsed)
}

function selectTool(tool: ToolId): void {
  project.activeTool = tool
  scheduleSaveProject()
}

function toggleRun(): void {
  project.running = !project.running
  saveProject()
}

function step(): void {
  replaceProject(runTick(project).project)
}

function resetProject(): void {
  replaceProject(createShapezProject())
}

function centerViewport(): void {
  project.viewport = { x: 150, y: 88, zoom: 1 }
  saveProject()
}

function rotateTool(): void {
  if (project.selectedEntityId) {
    replaceProject(rotateSelectedEntity(project))
    return
  }
  project.activeDirection = rotateDirection(project.activeDirection)
  saveProject()
}

function undoProject(): void {
  replaceProject(undo(project))
}

function handlePlace(cell: GridPosition): void {
  if (project.activeTool === 'select' || project.activeTool === 'pan') return
  if (project.activeTool === 'delete') {
    replaceProject(deleteAt(project, cell))
    return
  }
  replaceProject(placeBuilding(project, project.activeTool as BuildingType, cell, project.activeDirection))
}

function handleDragBelt(start: GridPosition, end: GridPosition, direction: Direction): void {
  const type = project.activeTool === 'tunnel' ? 'tunnel' : 'belt'
  replaceProject(buildBeltLine(project, start, end, direction, type))
}

function handleDeleteCell(cell: GridPosition): void {
  replaceProject(deleteAt(project, cell))
}

function handleViewportChange(viewport: ViewportState): void {
  project.viewport = viewport
  scheduleSaveProject()
}

function saveBlueprint(): void {
  const entityIds = project.entities.filter((entity) => entity.type !== 'hub').slice(0, 10).map((entity) => entity.id)
  project.blueprints.unshift({
    id: `bp-${Date.now().toString(36)}`,
    name: `\u84dd\u56fe ${project.blueprints.length + 1}`,
    description: `\u5df2\u4fdd\u5b58 ${entityIds.length} \u4e2a\u683c\u5b50\uff0c\u53ef\u5feb\u901f\u590d\u5236\u4e00\u6bb5\u751f\u4ea7\u7ebf\u3002`,
    entityIds,
    createdAt: new Date().toISOString()
  })
  saveProject()
}

function applyBlueprint(entityIds: string[]): void {
  const source = project.entities.filter((entity) => entityIds.includes(entity.id))
  const offset = 3 + Math.floor(project.entities.length / 4)
  const clones = source.map((entity, index) => createEntity({
    ...entity,
    id: `${entity.type}-copy-${Date.now().toString(36)}-${index}`,
    position: { x: entity.position.x + offset, y: entity.position.y + offset },
    input: [],
    output: [],
    progress: 0,
    status: 'idle'
  }))
  project.history = [...project.history, project.entities].slice(-20)
  project.entities.push(...clones)
  clones.filter((entity) => entity.type === 'belt').forEach((entity) => { project.belts[entity.id] = {} })
  saveProject()
}

function arrowFor(direction: string): string {
  return direction === 'north' ? '\u4e0a' : direction === 'south' ? '\u4e0b' : direction === 'west' ? '\u5de6' : '\u53f3'
}

function onKey(event: KeyboardEvent): void {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
  const key = event.key.toLowerCase()
  const match = buildings.find((building) => building.hotkey.toLowerCase() === key)
  if (match) selectTool(match.id)
  if (key === 'r') rotateTool()
  if (key === 'delete') selectTool('delete')
}

function animationLoop(time: number): void {
  if (!lastFrameTime) lastFrameTime = time
  const delta = Math.min(250, time - lastFrameTime)
  lastFrameTime = time

  if (project.running) {
    simAccumulator += delta
    const stepMs = SIMULATION_STEP_MS / Math.max(1, project.speed)
    while (simAccumulator >= stepMs) {
      replaceProject(runTick(project).project, false)
      simAccumulator -= stepMs
    }
    project.renderAlpha = Math.min(1, simAccumulator / stepMs)
  } else {
    simAccumulator = 0
    project.renderAlpha = 0
  }

  frameHandle = window.requestAnimationFrame(animationLoop)
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  frameHandle = window.requestAnimationFrame(animationLoop)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  if (frameHandle) window.cancelAnimationFrame(frameHandle)
  saveProject()
})

window.addEventListener('beforeunload', saveProject)
</script>
