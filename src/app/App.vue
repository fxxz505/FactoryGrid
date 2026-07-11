<template>
  <main class="shape-app">
    <header class="shape-topbar">
      <div class="brand-block">
        <span class="brand-mark">异</span>
        <div>
          <h1>异形工厂编辑器</h1>
          <p>{{ project.name }} <span class="sep">/</span> 第 {{ project.tick }} tick <span class="sep">/</span> 传送带上 {{ project.metrics.beltItems }} 个物品</p>
        </div>
      </div>

      <div class="run-controls">
        <button class="primary" type="button" @click="toggleRun"><Pause v-if="project.running" :size="16" /><Play v-else :size="16" />{{ project.running ? '暂停' : '运行' }}</button>
        <button type="button" @click="step"><StepForward :size="16" />单步</button>
        <button type="button" @click="resetProject"><RefreshCw :size="16" />重置</button>
        <button type="button" @click="rotateTool"><RotateCw :size="16" />旋转 {{ arrowFor(project.activeDirection) }}</button>
        <button type="button" @click="centerViewport"><Focus :size="16" />回到工厂</button>
        <button type="button" @click="openWorldMap"><Map :size="16" />地图 M</button>
        <button type="button" @click="undoProject"><Undo2 :size="16" />撤销</button>
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
          <div class="panel-heading"><h2>建造</h2><span>{{ activeToolName }}</span></div>
          <button class="tool-row pan-tool" :class="{ active: project.activeTool === 'pan' }" type="button" @click="selectTool('pan')">
            <span class="tool-glyph"><Move :size="18" /></span>
            <span><strong>移动画布</strong><small>拖动视角，不放置建筑。</small></span>
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
            <span><strong>{{ building.name }}</strong><small>{{ building.hotkey }} <span class="sep">/</span> {{ building.description }}</small></span>
          </button>
          <button class="tool-row danger-tool" :class="{ active: project.activeTool === 'delete' }" type="button" @click="selectTool('delete')">
            <span class="tool-glyph">删</span>
            <span><strong>拆除建筑</strong><small>点击单个格子删除建筑。</small></span>
          </button>
        </section>

        <section class="panel-block area-tools">
          <div class="panel-heading"><h2>大型建造</h2><span>区域工具</span></div>
          <button class="tool-row" :class="{ active: project.activeTool === 'copy-area' }" type="button" @click="selectTool('copy-area')">
            <span class="tool-glyph"><Copy :size="17" /></span>
            <span><strong>框选复制</strong><small>拖出矩形并保存为相对蓝图。</small></span>
          </button>
          <button class="tool-row" :class="{ active: project.activeTool === 'paste-blueprint' }" type="button" :disabled="!activeBlueprint" @click="selectTool('paste-blueprint')">
            <span class="tool-glyph"><ClipboardPaste :size="17" /></span>
            <span><strong>蓝图粘贴</strong><small>点击格子作为蓝图左上角。</small></span>
          </button>
          <button class="tool-row danger-tool" :class="{ active: project.activeTool === 'delete-area' }" type="button" @click="selectTool('delete-area')">
            <span class="tool-glyph"><Trash2 :size="17" /></span>
            <span><strong>批量拆除</strong><small>拖选后一次拆除整个区域。</small></span>
          </button>
          <button class="tool-row" :class="{ active: project.activeTool === 'upgrade-area' }" type="button" :disabled="!canUpgrade" @click="selectTool('upgrade-area')">
            <span class="tool-glyph"><ChevronsUp :size="17" /></span>
            <span><strong>升级规划器</strong><small>{{ canUpgrade ? '升级传送带和生产机器。' : '完成自动化升级研究后解锁。' }}</small></span>
          </button>
        </section>

        <section class="panel-block">
          <div class="panel-heading"><h2>蓝图</h2><span>{{ project.blueprints.length }}</span></div>
          <div class="blueprint-options" aria-label="蓝图粘贴参数">
            <button type="button" title="旋转蓝图" @click="rotateBlueprintOption"><RotateCw :size="16" />{{ blueprintOptions.rotation }}°</button>
            <button type="button" :class="{ active: blueprintOptions.mirrorX }" title="水平镜像" @click="blueprintOptions.mirrorX = !blueprintOptions.mirrorX">镜像</button>
            <select v-model="blueprintOptions.beltTier" aria-label="替换传送带等级">
              <option value="keep">保留物流等级</option>
              <option value="belt">普通传送带</option>
              <option value="fast-belt" :disabled="!project.unlocked.includes('fast-belt')">高速传送带</option>
              <option value="express-belt" :disabled="!project.unlocked.includes('express-belt')">极速传送带</option>
            </select>
          </div>
          <article v-for="blueprint in project.blueprints" :key="blueprint.id" class="blueprint-card" :class="{ active: activeBlueprint?.id === blueprint.id }">
            <strong>{{ blueprint.name }}</strong>
            <p>{{ blueprint.description }}</p>
            <button type="button" :disabled="blueprint.entities.length === 0" @click="chooseBlueprint(blueprint)">选择并粘贴</button>
          </article>
        </section>
      </aside>

      <section class="canvas-column">
        <FactoryCanvas
          :project="project"
          :selected-entity-id="project.selectedEntityId"
          :topology-revision="topologyRevision"
          :topology-mutation="topologyMutation"
          @select="project.selectedEntityId = $event"
          @place="handlePlace"
          @drag-belt="handleDragBelt"
          @area-action="handleAreaAction"
          @delete-cell="handleDeleteCell"
          @viewport-change="handleViewportChange"
          @configure-assembler="openAssemblerRecipes"
          @configure-research="openResearchProjects"
        />
        <SimulationBar :metrics="project.metrics" :errors="project.errors" :events="project.events" :performance="project.performance" />
      </section>
    </section>

    <div v-if="recipePanelEntity" class="recipe-overlay" @click.self="closeRecipePanel">
      <section class="recipe-panel" role="dialog" aria-modal="true" aria-label="合成器配方">
        <div class="panel-heading"><h2>合成配方</h2><span>{{ recipePanelEntity.label }}</span></div>
        <button
          v-for="recipe in availableAssemblerRecipes"
          :key="recipe.id"
          class="recipe-choice"
          :class="{ active: recipePanelEntity.recipeId === recipe.id }"
          type="button"
          @click="selectAssemblerRecipe(recipe.id)"
        >
          <span class="recipe-shapes">
            <i v-for="ingredient in recipe.inputs" :key="ingredient.shape" class="tier-shape" :style="shapeStyle(ingredient.shape)"></i>
            <b class="tier-shape" :style="shapeStyle(recipe.output)"></b>
          </span>
          <span><strong>{{ recipe.name }}</strong><small>{{ recipe.description }}</small></span>
        </button>
        <button class="wide-action" type="button" @click="closeRecipePanel">关闭</button>
      </section>
    </div>

    <div v-if="researchPanelEntity" class="recipe-overlay" @click.self="closeResearchPanel">
      <section class="recipe-panel research-project-panel" role="dialog" aria-modal="true" aria-label="研究项目">
        <div class="panel-heading"><h2>研究项目</h2><span>{{ researchPanelEntity.label }}</span></div>
        <button
          v-for="research in researchDefinitions"
          :key="research.id"
          class="recipe-choice research-project-choice"
          :class="{ active: researchPanelEntity.recipeId === research.id, completed: isResearchComplete(research.id), locked: !researchAvailable(research) }"
          type="button"
          :disabled="isResearchComplete(research.id) || !researchAvailable(research)"
          @click="selectResearchProject(research.id)"
        >
          <span class="research-pack-list">
            <i v-for="requirement in research.requirements" :key="requirement.shape" class="tier-shape" :style="shapeStyle(requirement.shape)"></i>
          </span>
          <span>
            <strong>{{ research.name }}</strong>
            <small>{{ research.description }}</small>
            <small class="research-progress-text">{{ researchStatus(research) }}</small>
          </span>
        </button>
        <button class="wide-action" type="button" @click="closeResearchPanel">关闭</button>
      </section>
    </div>

    <WorldMap
      v-if="worldMapOpen"
      :project="project"
      :viewport-size="factoryViewportSize"
      :bookmarks="project.mapBookmarks"
      @close="closeWorldMap"
      @viewport-change="handleViewportChange"
      @add-bookmark="addMapBookmark"
      @remove-bookmark="removeMapBookmark"
    />
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, toRaw } from 'vue'
import {
  ChevronsUp, ClipboardPaste, Copy, Focus, Map, Move, Pause, Play,
  RefreshCw, RotateCw, StepForward, Trash2, Undo2
} from '@lucide/vue'
import FactoryCanvas from '../components/editor/FactoryCanvas.vue'
import WorldMap from '../components/editor/WorldMap.vue'
import SimulationBar from '../components/editor/SimulationBar.vue'
import MachineIcon from '../components/editor/MachineIcon.vue'
import { buildings, buildingById } from '../data/machines'
import { shapeById } from '../data/resources'
import { unlockedAssemblerRecipes } from '../data/recipes'
import { researchDefinitions } from '../data/research'
import { createShapezProject } from '../data/examples'
import { runTick } from '../engine/simulation/tickEngine'
import { SimulationWorkerClient } from '../engine/simulation/simulationWorkerClient'
import { loadStoredProject, projectStorageChunkKey, saveStoredProject } from '../utils/projectStorage'
import {
  buildBeltLine, copyAreaToBlueprint, deleteArea, deleteAt,
  editorTopologyMutation, pasteBlueprintWithOptions, placeBuilding, rotateDirection, rotateSelectedEntity, undo, upgradeArea,
  type EditorTopologyMutation
} from '../engine/simulation/editorActions'
import type {
  Blueprint, BlueprintPasteOptions, BuildingType, Direction, FactoryEntity, FactoryProject,
  GridPosition, ResearchDefinition, ToolId, ViewportState
} from '../models/factory'

const MAX_SIMULATION_STEPS_PER_FRAME = 4
const SAVE_THROTTLE_MS = 1200
const SIMULATION_STEP_MS = 170
const project = reactive(loadProject())
const recipePanel = reactive<{ entityId?: string }>({})
const researchPanel = reactive<{ entityId?: string }>({})
const worldMapOpen = ref(false)
const topologyRevision = ref(0)
const topologyMutation = ref<EditorTopologyMutation>()
const factoryViewportSize = reactive({ width: 960, height: 640 })
const blueprintState = reactive<{ activeId?: string }>({})
const blueprintOptions = reactive<BlueprintPasteOptions>({ rotation: 0, mirrorX: false, beltTier: 'keep' })
const simulationWorker = new SimulationWorkerClient()
let simulationRevision = 0
let frameHandle = 0
let lastFrameTime = 0
let simAccumulator = 0
let saveTimer: number | undefined
let saveIdleHandle: number | undefined
let saveAllChunks = false
const dirtyStorageChunks = new Set<string>()
let lastSavedAt = 0
let fpsWindowStart = 0
let fpsFrames = 0

const visibleBuildings = computed(() => buildings.filter((building) => project.unlocked.includes(building.id)))
const activeToolName = computed(() => {
  const names: Partial<Record<ToolId, string>> = {
    delete: '拆除', pan: '移动画布', 'copy-area': '框选复制',
    'paste-blueprint': '蓝图粘贴', 'delete-area': '批量拆除', 'upgrade-area': '升级规划器'
  }
  return names[project.activeTool] ?? buildingById[project.activeTool as BuildingType]?.name ?? project.activeTool
})
const recipePanelEntity = computed<FactoryEntity | undefined>(() => project.entities.find((entity) => entity.id === recipePanel.entityId && entity.type === 'assembler'))
const researchPanelEntity = computed<FactoryEntity | undefined>(() => project.entities.find((entity) => entity.id === researchPanel.entityId && entity.type === 'research-lab'))
const availableAssemblerRecipes = computed(() => unlockedAssemblerRecipes(project))
const activeBlueprint = computed(() => project.blueprints.find((blueprint) => blueprint.id === blueprintState.activeId && blueprint.entities.length > 0))
const canUpgrade = computed(() => project.research.completed.includes('automation-upgrade'))

function loadProject(): FactoryProject {
  const saved = loadStoredProject()
  return saved ? hydrateSavedProject(saved) : createShapezProject()
}

function hydrateSavedProject(saved: FactoryProject): FactoryProject {
  const base = createShapezProject()
  const availableSet = new Set<BuildingType>(buildings.map((building) => building.id))
  const entities = (saved.entities ?? []).filter((entity) => availableSet.has(entity.type)).map((entity) => ({
    ...entity,
    level: entity.level,
    input: entity.input ?? [],
    output: entity.output ?? []
  }))
  const entityIds = new Set(entities.map((entity) => entity.id))
  const belts = Object.fromEntries(Object.entries(saved.belts ?? {}).filter(([id, runtime]) => (
    entityIds.has(id) && runtime.item !== undefined
  )))
  const unlocked = Array.from(new Set([...(saved.unlocked ?? base.unlocked), 'research-lab' as BuildingType])).filter((type) => availableSet.has(type))
  const blueprints = (saved.blueprints ?? []).map((blueprint) => ({
    ...blueprint,
    entities: blueprint.entities ?? [],
    width: blueprint.width ?? 0,
    height: blueprint.height ?? 0
  }))
  return {
    ...base,
    ...saved,
    renderAlpha: saved.renderAlpha ?? 0,
    unlocked,
    entities,
    belts,
    blueprints,
    research: {
      ...base.research, ...saved.research,
      delivered: saved.research?.delivered ?? {},
      progress: saved.research?.progress ?? {},
      consumed: saved.research?.consumed ?? {}
    },
    performance: { ...base.performance, ...saved.performance },
    mapBookmarks: saved.mapBookmarks ?? base.mapBookmarks,
    activeTool: isKnownTool(saved.activeTool) ? saved.activeTool : 'belt'
  }
}

function isKnownTool(tool: ToolId): boolean {
  return ['select', 'pan', 'delete', 'copy-area', 'paste-blueprint', 'delete-area', 'upgrade-area'].includes(tool)
    || buildings.some((building) => building.id === tool)
}

function replaceProject(next: FactoryProject, persist = true, forceTopologyRefresh = false): void {
  const mutation = editorTopologyMutation(next)
  simulationRevision += 1
  Object.assign(project, next)
  if (mutation || forceTopologyRefresh) {
    topologyMutation.value = mutation
    topologyRevision.value += 1
  }
  if (forceTopologyRefresh) saveAllChunks = true
  else if (mutation) markDirtyStorageChunks(mutation)
  if (persist) scheduleSaveProject(250)
}

function saveProject(): void {
  if (saveTimer) window.clearTimeout(saveTimer)
  saveTimer = undefined
  if (saveIdleHandle !== undefined) cancelIdleSave(saveIdleHandle)
  saveIdleHandle = undefined
  lastSavedAt = Date.now()
  saveStoredProject(toRaw(project), saveAllChunks ? undefined : dirtyStorageChunks)
  dirtyStorageChunks.clear()
  saveAllChunks = false
}

function markDirtyStorageChunks(mutation: EditorTopologyMutation): void {
  mutation.removed.forEach((entity) => dirtyStorageChunks.add(projectStorageChunkKey(entity)))
  mutation.added.forEach((entity) => dirtyStorageChunks.add(projectStorageChunkKey(entity)))
}

function scheduleSaveProject(minimumDelay = 0): void {
  const elapsed = Date.now() - lastSavedAt
  const delay = Math.max(minimumDelay, elapsed >= SAVE_THROTTLE_MS ? 0 : SAVE_THROTTLE_MS - elapsed)
  if (!saveTimer && saveIdleHandle === undefined) {
    saveTimer = window.setTimeout(() => {
      saveTimer = undefined
      saveIdleHandle = requestIdleSave(() => {
        saveIdleHandle = undefined
        saveProject()
      })
    }, delay)
  }
}

function requestIdleSave(callback: () => void): number {
  const idleWindow = window as Window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
  }
  return idleWindow.requestIdleCallback
    ? idleWindow.requestIdleCallback(callback, { timeout: 3000 })
    : window.setTimeout(callback, 32)
}

function cancelIdleSave(handle: number): void {
  const idleWindow = window as Window & { cancelIdleCallback?: (handle: number) => void }
  if (idleWindow.cancelIdleCallback) idleWindow.cancelIdleCallback(handle)
  else window.clearTimeout(handle)
}

function selectTool(tool: ToolId): void {
  if (tool === 'upgrade-area' && !canUpgrade.value) return
  if (tool === 'paste-blueprint' && !activeBlueprint.value) return
  project.activeTool = tool
  scheduleSaveProject()
}

function toggleRun(): void {
  project.running = !project.running
  saveProject()
}
function step(): void { replaceProject(runTick(project).project) }
function resetProject(): void {
  blueprintState.activeId = undefined
  replaceProject(createShapezProject(), true, true)
}
function centerViewport(): void {
  project.viewport = { x: 150, y: 88, zoom: 1 }
  saveProject()
}
function measureFactoryViewport(): void {
  const stage = document.querySelector<HTMLElement>('.factory-canvas-stage')
  if (!stage) return
  factoryViewportSize.width = stage.clientWidth
  factoryViewportSize.height = stage.clientHeight
}
function openWorldMap(): void {
  measureFactoryViewport()
  worldMapOpen.value = true
}
function closeWorldMap(): void { worldMapOpen.value = false }
function addMapBookmark(position: GridPosition): void {
  project.mapBookmarks.push({
    id: 'bookmark-' + Date.now().toString(36),
    name: '区域 ' + (project.mapBookmarks.length + 1),
    position
  })
  saveProject()
}
function removeMapBookmark(id: string): void {
  project.mapBookmarks = project.mapBookmarks.filter((bookmark) => bookmark.id !== id)
  saveProject()
}
function rotateTool(): void {
  if (buildings.some((building) => building.id === project.activeTool)) {
    project.activeDirection = rotateDirection(project.activeDirection)
    saveProject()
  } else if (project.activeTool === 'select' && project.selectedEntityId) {
    replaceProject(rotateSelectedEntity(toRaw(project)))
  }
}
function undoProject(): void { replaceProject(undo(toRaw(project))) }

function handlePlace(cell: GridPosition): void {
  if (project.activeTool === 'select' || project.activeTool === 'pan') return
  if (project.activeTool === 'paste-blueprint' && activeBlueprint.value) {
    replaceProject(pasteBlueprintWithOptions(toRaw(project), activeBlueprint.value, cell, blueprintOptions))
    return
  }
  if (project.activeTool === 'delete') {
    replaceProject(deleteAt(toRaw(project), cell))
    return
  }
  if (['copy-area', 'delete-area', 'upgrade-area'].includes(project.activeTool)) return
  replaceProject(placeBuilding(toRaw(project), project.activeTool as BuildingType, cell, project.activeDirection))
}

function handleDragBelt(start: GridPosition, end: GridPosition, direction: Direction): void {
  const type = project.activeTool === 'tunnel'
    ? 'tunnel'
    : project.activeTool === 'fast-belt' ? 'fast-belt' : project.activeTool === 'express-belt' ? 'express-belt' : 'belt'
  replaceProject(buildBeltLine(toRaw(project), start, end, direction, type))
}

function handleAreaAction(start: GridPosition, end: GridPosition): void {
  if (project.activeTool === 'copy-area') {
    const blueprint = copyAreaToBlueprint(toRaw(project), start, end, '区域蓝图 ' + (project.blueprints.length + 1))
    project.blueprints.unshift(blueprint)
    blueprintState.activeId = blueprint.id
    project.activeTool = 'paste-blueprint'
    saveProject()
  } else if (project.activeTool === 'delete-area') {
    replaceProject(deleteArea(toRaw(project), start, end))
  } else if (project.activeTool === 'upgrade-area') {
    replaceProject(upgradeArea(toRaw(project), start, end))
  }
}

function handleDeleteCell(cell: GridPosition): void { replaceProject(deleteAt(toRaw(project), cell)) }
function handleViewportChange(viewport: ViewportState): void {
  project.viewport = viewport
  scheduleSaveProject(250)
}
function chooseBlueprint(blueprint: Blueprint): void {
  if (!blueprint.entities.length) return
  blueprintState.activeId = blueprint.id
  project.activeTool = 'paste-blueprint'
  scheduleSaveProject()
}
function rotateBlueprintOption(): void {
  blueprintOptions.rotation = ((blueprintOptions.rotation + 90) % 360) as BlueprintPasteOptions['rotation']
}

function openAssemblerRecipes(id: string): void {
  project.selectedEntityId = id
  recipePanel.entityId = id
}
function closeRecipePanel(): void { recipePanel.entityId = undefined }
function selectAssemblerRecipe(recipeId: string): void {
  const entity = project.entities.find((candidate) => candidate.id === recipePanel.entityId && candidate.type === 'assembler')
  if (!entity || !availableAssemblerRecipes.value.some((recipe) => recipe.id === recipeId)) return
  entity.recipeId = recipeId
  entity.progress = 0
  simulationRevision += 1
  saveProject()
  closeRecipePanel()
}

function openResearchProjects(id: string): void {
  project.selectedEntityId = id
  researchPanel.entityId = id
}
function closeResearchPanel(): void { researchPanel.entityId = undefined }
function selectResearchProject(researchId: string): void {
  const entity = project.entities.find((candidate) => candidate.id === researchPanel.entityId && candidate.type === 'research-lab')
  const research = researchDefinitions.find((candidate) => candidate.id === researchId)
  if (!entity || !research || isResearchComplete(research.id) || !researchAvailable(research)) return
  entity.recipeId = research.id
  entity.progress = 0
  simulationRevision += 1
  saveProject()
}
function researchStatus(research: ResearchDefinition): string {
  if (isResearchComplete(research.id)) return '已完成'
  if (!researchAvailable(research)) {
    return '需要前置研究：' + research.prerequisites.map((id) => researchDefinitions.find((item) => item.id === id)?.name ?? id).join('、')
  }
  return research.requirements.map((requirement) => {
    const consumed = project.research.consumed[research.id]?.[requirement.shape] ?? 0
    return `${shapeById[requirement.shape]?.name} ${consumed}/${requirement.amount}`
  }).join(' · ')
}
function shapeStyle(shape: keyof typeof shapeById): Record<string, string> {
  const definition = shapeById[shape]
  return { background: definition?.color ?? '#647278', clipPath: polygonClip(definition?.tier ?? 0) }
}
function polygonClip(tier: number): string {
  const sides = tier === 0 ? 0 : tier + 2
  if (sides < 3) return 'circle(50%)'
  const points = Array.from({ length: sides }, (_, index) => {
    const rotation = tier === 2 ? -Math.PI / 4 : -Math.PI / 2
    const angle = rotation + index * Math.PI * 2 / sides
    return `${50 + Math.cos(angle) * 48}% ${50 + Math.sin(angle) * 48}%`
  })
  return `polygon(${points.join(',')})`
}
function isResearchComplete(id: string): boolean { return project.research.completed.includes(id) }
function researchAvailable(research: ResearchDefinition): boolean {
  return research.prerequisites.every((id) => isResearchComplete(id))
}
function arrowFor(direction: string): string {
  return direction === 'north' ? '上' : direction === 'south' ? '下' : direction === 'west' ? '左' : '右'
}

function onKey(event: KeyboardEvent): void {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
  const key = event.key.toLowerCase()
  if (key === 'm') {
    event.preventDefault()
    if (worldMapOpen.value) closeWorldMap()
    else openWorldMap()
    return
  }
  if (key === 'escape' && worldMapOpen.value) {
    closeWorldMap()
    return
  }
  if (worldMapOpen.value) return
  const match = visibleBuildings.value.find((building) => building.hotkey.toLowerCase() === key)
  if (match) selectTool(match.id)
  if (key === 'r') rotateTool()
  if (key === 'delete') selectTool('delete')
}

function updatePerformance(time: number, delta: number): void {
  fpsFrames += 1
  if (!fpsWindowStart) fpsWindowStart = time
  const elapsed = time - fpsWindowStart
  if (elapsed < 500) return
  const sampledFps = Math.round((fpsFrames * 1000) / elapsed)
  project.performance.fps = Math.round(project.performance.fps * 0.45 + sampledFps * 0.55)
  project.performance.frameTime = Math.round(delta * 10) / 10
  project.performance.quality = project.performance.fps < 44
    ? 'performance'
    : project.performance.fps < 56 ? 'balanced' : 'high'
  fpsWindowStart = time
  fpsFrames = 0
}

function animationLoop(time: number): void {
  if (!lastFrameTime) lastFrameTime = time
  const delta = Math.min(250, time - lastFrameTime)
  lastFrameTime = time
  updatePerformance(time, delta)

  if (project.running) {
    simAccumulator += delta
    const stepMs = SIMULATION_STEP_MS / Math.max(1, project.speed)
    if (simulationWorker.shouldUseWorker(toRaw(project))) {
      if (simAccumulator >= stepMs && !simulationWorker.isBusy()) {
        const steps = Math.min(MAX_SIMULATION_STEPS_PER_FRAME, Math.floor(simAccumulator / stepMs))
        const revision = simulationRevision
        if (simulationWorker.step(toRaw(project), steps, revision, (next) => {
          if (simulationRevision !== revision) return
          applySimulationResult(next)
          project.performance.simulationMode = 'worker'
        })) simAccumulator -= steps * stepMs
      }
      frameHandle = window.requestAnimationFrame(animationLoop)
      return
    }
    let steps = 0
    while (simAccumulator >= stepMs && steps < MAX_SIMULATION_STEPS_PER_FRAME) {
      steps += 1
      simAccumulator -= stepMs
    }
    if (steps > 0) {
      let next = toRaw(project)
      for (let index = 0; index < steps; index += 1) next = runTick(next).project
      Object.assign(project, next)
      project.performance.simulationMode = 'main'
    }
    if (steps === MAX_SIMULATION_STEPS_PER_FRAME && simAccumulator >= stepMs) simAccumulator = 0
  } else {
    simAccumulator = 0
  }

  frameHandle = window.requestAnimationFrame(animationLoop)
}

function applySimulationResult(next: FactoryProject): void {
  project.tick = next.tick
  project.entities = next.entities
  project.belts = next.belts
  project.metrics = next.metrics
  project.research = next.research
  project.errors = next.errors
  project.events = next.events
  project.goals = next.goals
  project.unlocked = next.unlocked
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  window.addEventListener('beforeunload', saveProject)
  frameHandle = window.requestAnimationFrame(animationLoop)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('beforeunload', saveProject)
  if (frameHandle) window.cancelAnimationFrame(frameHandle)
  simulationWorker.dispose()
  saveProject()
})
</script>
