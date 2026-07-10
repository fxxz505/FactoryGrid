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
          <article v-for="blueprint in project.blueprints" :key="blueprint.id" class="blueprint-card" :class="{ active: activeBlueprint?.id === blueprint.id }">
            <strong>{{ blueprint.name }}</strong>
            <p>{{ blueprint.description }}</p>
            <button type="button" :disabled="blueprint.entities.length === 0" @click="chooseBlueprint(blueprint)">选择并粘贴</button>
          </article>
        </section>

        <section class="panel-block research-panel">
          <div class="panel-heading"><h2>研究</h2><span class="research-points">研究点 {{ project.research.points }}</span></div>
          <article v-for="research in researchDefinitions" :key="research.id" class="research-node" :class="{ completed: isResearchComplete(research.id), locked: !researchAvailable(research) }">
            <div class="research-title"><strong>{{ research.name }}</strong><span>{{ isResearchComplete(research.id) ? '已完成' : research.cost + ' 点' }}</span></div>
            <p>{{ research.description }}</p>
            <div class="research-requirements">
              <span v-for="requirement in research.requirements" :key="requirement.shape">
                {{ shapeById[requirement.shape]?.name }} {{ project.research.delivered[requirement.shape] ?? 0 }}/{{ requirement.amount }}
              </span>
            </div>
          </article>
        </section>
      </aside>

      <section class="canvas-column">
        <FactoryCanvas
          :project="project"
          :selected-entity-id="project.selectedEntityId"
          @select="project.selectedEntityId = $event"
          @place="handlePlace"
          @drag-belt="handleDragBelt"
          @area-action="handleAreaAction"
          @delete-cell="handleDeleteCell"
          @viewport-change="handleViewportChange"
          @configure-assembler="openAssemblerRecipes"
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
            <i v-for="ingredient in recipe.inputs" :key="ingredient.shape" :style="{ background: shapeById[ingredient.shape]?.color }"></i>
            <b :style="{ background: shapeById[recipe.output]?.color }"></b>
          </span>
          <span><strong>{{ recipe.name }}</strong><small>{{ recipe.description }}</small></span>
        </button>
        <button class="wide-action" type="button" @click="closeRecipePanel">关闭</button>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, toRaw } from 'vue'
import {
  ChevronsUp, ClipboardPaste, Copy, Focus, Move, Pause, Play,
  RefreshCw, RotateCw, StepForward, Trash2, Undo2
} from '@lucide/vue'
import FactoryCanvas from '../components/editor/FactoryCanvas.vue'
import SimulationBar from '../components/editor/SimulationBar.vue'
import MachineIcon from '../components/editor/MachineIcon.vue'
import { buildings, buildingById } from '../data/machines'
import { shapeById } from '../data/resources'
import { unlockedAssemblerRecipes } from '../data/recipes'
import { researchDefinitions } from '../data/research'
import { createShapezProject } from '../data/examples'
import { runTick } from '../engine/simulation/tickEngine'
import {
  buildBeltLine, copyAreaToBlueprint, deleteArea, deleteAt, pasteBlueprint,
  placeBuilding, rotateDirection, rotateSelectedEntity, undo, upgradeArea
} from '../engine/simulation/editorActions'
import type {
  Blueprint, BuildingType, Direction, FactoryEntity, FactoryProject,
  GridPosition, ResearchDefinition, ToolId, ViewportState
} from '../models/factory'

const STORAGE_KEY = 'factorygrid-shapez-v4'
const MAX_SIMULATION_STEPS_PER_FRAME = 4
const SAVE_THROTTLE_MS = 1200
const SIMULATION_STEP_MS = 170
const project = reactive(loadProject())
const recipePanel = reactive<{ entityId?: string }>({})
const blueprintState = reactive<{ activeId?: string }>({})
let frameHandle = 0
let lastFrameTime = 0
let simAccumulator = 0
let saveTimer: number | undefined
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
const availableAssemblerRecipes = computed(() => unlockedAssemblerRecipes(project))
const activeBlueprint = computed(() => project.blueprints.find((blueprint) => blueprint.id === blueprintState.activeId && blueprint.entities.length > 0))
const canUpgrade = computed(() => project.research.completed.includes('automation-upgrade'))

function loadProject(): FactoryProject {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (!saved) return createShapezProject()
  try {
    return hydrateSavedProject(JSON.parse(saved) as FactoryProject)
  } catch {
    return createShapezProject()
  }
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
  const belts = Object.fromEntries(Object.entries(saved.belts ?? {}).filter(([id]) => entityIds.has(id)))
  const unlocked = Array.from(new Set(saved.unlocked ?? base.unlocked)).filter((type) => availableSet.has(type))
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
    research: { ...base.research, ...saved.research, delivered: saved.research?.delivered ?? {} },
    performance: { ...base.performance, ...saved.performance },
    activeTool: isKnownTool(saved.activeTool) ? saved.activeTool : 'belt'
  }
}

function isKnownTool(tool: ToolId): boolean {
  return ['select', 'pan', 'delete', 'copy-area', 'paste-blueprint', 'delete-area', 'upgrade-area'].includes(tool)
    || buildings.some((building) => building.id === tool)
}

function replaceProject(next: FactoryProject, persist = true): void {
  Object.assign(project, next)
  if (persist) saveProject()
}

function saveProject(): void {
  if (saveTimer) window.clearTimeout(saveTimer)
  saveTimer = undefined
  lastSavedAt = Date.now()
  localStorage.setItem(STORAGE_KEY, JSON.stringify(project))
}

function scheduleSaveProject(): void {
  const elapsed = Date.now() - lastSavedAt
  if (elapsed >= SAVE_THROTTLE_MS) {
    saveProject()
    return
  }
  if (!saveTimer) saveTimer = window.setTimeout(saveProject, SAVE_THROTTLE_MS - elapsed)
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
  replaceProject(createShapezProject())
}
function centerViewport(): void {
  project.viewport = { x: 150, y: 88, zoom: 1 }
  saveProject()
}
function rotateTool(): void {
  if (project.selectedEntityId) replaceProject(rotateSelectedEntity(project))
  else {
    project.activeDirection = rotateDirection(project.activeDirection)
    saveProject()
  }
}
function undoProject(): void { replaceProject(undo(project)) }

function handlePlace(cell: GridPosition): void {
  if (project.activeTool === 'select' || project.activeTool === 'pan') return
  if (project.activeTool === 'paste-blueprint' && activeBlueprint.value) {
    replaceProject(pasteBlueprint(project, activeBlueprint.value, cell))
    return
  }
  if (project.activeTool === 'delete') {
    replaceProject(deleteAt(project, cell))
    return
  }
  if (['copy-area', 'delete-area', 'upgrade-area'].includes(project.activeTool)) return
  replaceProject(placeBuilding(project, project.activeTool as BuildingType, cell, project.activeDirection))
}

function handleDragBelt(start: GridPosition, end: GridPosition, direction: Direction): void {
  const type = project.activeTool === 'tunnel' ? 'tunnel' : project.activeTool === 'fast-belt' ? 'fast-belt' : 'belt'
  replaceProject(buildBeltLine(project, start, end, direction, type))
}

function handleAreaAction(start: GridPosition, end: GridPosition): void {
  if (project.activeTool === 'copy-area') {
    const blueprint = copyAreaToBlueprint(project, start, end, '区域蓝图 ' + (project.blueprints.length + 1))
    project.blueprints.unshift(blueprint)
    blueprintState.activeId = blueprint.id
    project.activeTool = 'paste-blueprint'
    saveProject()
  } else if (project.activeTool === 'delete-area') {
    replaceProject(deleteArea(project, start, end))
  } else if (project.activeTool === 'upgrade-area') {
    replaceProject(upgradeArea(project, start, end))
  }
}

function handleDeleteCell(cell: GridPosition): void { replaceProject(deleteAt(project, cell)) }
function handleViewportChange(viewport: ViewportState): void {
  project.viewport = viewport
  scheduleSaveProject()
}
function chooseBlueprint(blueprint: Blueprint): void {
  if (!blueprint.entities.length) return
  blueprintState.activeId = blueprint.id
  project.activeTool = 'paste-blueprint'
  scheduleSaveProject()
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
  saveProject()
  closeRecipePanel()
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
  project.performance.quality = project.performance.fps < 50 ? 'performance' : 'high'
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
    let steps = 0
    while (simAccumulator >= stepMs && steps < MAX_SIMULATION_STEPS_PER_FRAME) {
      replaceProject(runTick(toRaw(project)).project, false)
      simAccumulator -= stepMs
      steps += 1
    }
    if (steps === MAX_SIMULATION_STEPS_PER_FRAME && simAccumulator >= stepMs) simAccumulator = 0
  } else {
    simAccumulator = 0
  }

  frameHandle = window.requestAnimationFrame(animationLoop)
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
  saveProject()
})
</script>