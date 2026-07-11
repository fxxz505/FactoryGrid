import { expect, test } from '@playwright/test'

test('factory can run and deliver shapes in the Chinese UI', async ({ page }) => {
  await page.goto('/')

  await expect(page.locator('h1')).toContainText('\u5f02\u5f62\u5de5\u5382\u7f16\u8f91\u5668')
  await expect(page.getByTestId('factory-canvas')).toBeVisible()
  await expect(page.locator('.simulation-bar')).toBeVisible()
  await expect(page.locator('.inspector-panel')).toHaveCount(0)
  await expect(page.locator('.metric-cards')).toHaveCount(0)

  await page.getByRole('button', { name: '\u8fd0\u884c' }).click()
  await expect(page.getByRole('button', { name: '\u6682\u505c' })).toBeVisible()
  await page.waitForTimeout(1400)
  await page.getByRole('button', { name: '\u6682\u505c' }).click()

  await expect(page.locator('.event-stream')).toContainText(/\u67a2\u7ebd\u63a5\u6536|\u70b9\u51fb\u8fd0\u884c/)
})

test('user can preview belt dragging, pan the canvas and save a blueprint', async ({ page }) => {
  await page.goto('/')

  await page.locator('.tool-row').filter({ hasText: '\u4f20\u9001\u5e26' }).first().click()
  const canvas = page.getByTestId('factory-canvas')
  await canvas.hover({ position: { x: 190, y: 300 } })
  await page.mouse.down()
  await canvas.hover({ position: { x: 410, y: 300 } })
  await expect(canvas).toHaveClass(/previewing/)
  await page.mouse.up()

  await page.locator('.pan-tool').click()
  await canvas.hover({ position: { x: 500, y: 260 } })
  await page.mouse.down()
  await canvas.hover({ position: { x: 560, y: 300 } })
  await expect(canvas).toHaveClass(/panning/)
  await page.mouse.up()
  await canvas.hover({ position: { x: 540, y: 280 } })
  await page.mouse.wheel(0, -220)

  await page.getByRole('button', { name: /框选复制/ }).click()
  await canvas.dragTo(canvas, {
    sourcePosition: { x: 160, y: 110 },
    targetPosition: { x: 300, y: 220 }
  })
  await expect(page.locator('.blueprint-card').filter({ hasText: '区域蓝图' }).first()).toBeVisible()
})

test('machines use simple geometric language without text labels or image assets', async ({ page }) => {
  const assetRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/assets/factory-kit/')) assetRequests.push(request.url())
  })

  await page.goto('/')
  const canvas = page.locator('.factory-canvas-static.active')
  await expect(canvas).toBeVisible()
  await expect(page.locator('.tool-row svg')).toHaveCount(5)
  await expect(page.locator('.machine-icon img')).toHaveCount(0)
  await expect(page.locator('.machine-icon .icon-core')).toHaveCount(23)
  await expect(page.getByTestId('factory-canvas')).not.toContainText('\u67a2')
  expect(assetRequests).toEqual([])
})







test('legacy saves omit removed container and inserter tools with clean delete labels', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('factorygrid-shapez-v4', JSON.stringify({
      id: 'legacy-save',
      name: 'legacy save',
      tick: 0,
      running: false,
      renderAlpha: 0,
      speed: 2,
      activeTool: 'belt',
      activeDirection: 'east',
      viewport: { x: 150, y: 88, zoom: 1 },
      goals: [],
      unlocked: ['belt', 'rotator', 'container', 'inserter'],
      entities: [],
      belts: {},
      metrics: { delivered: {}, produced: {}, trashed: {}, beltItems: 0, activeBuildings: 0, bottlenecks: [], recentDelivery: [] },
      errors: [],
      events: [],
      blueprints: [],
      history: []
    }))
  })

  await page.goto('/')

  await expect(page.getByRole('button', { name: new RegExp('^\\u50a8\\u7269\\u7bb1') })).toHaveCount(0)
  await expect(page.getByRole('button', { name: new RegExp('^\\u673a\\u68b0\\u81c2') })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^研究中心/ })).toBeVisible()
  await expect(page.locator('.danger-tool').first()).toContainText('\u62c6\u9664\u5efa\u7b51')
  await expect(page.locator('.danger-tool').first()).toContainText('\u70b9\u51fb\u5355\u4e2a\u683c\u5b50\u5220\u9664\u5efa\u7b51')
  await expect(page.locator('.danger-tool').first()).not.toContainText('\u79fb\u52a8\u753b\u5e03')
})


test('ore generators furnace and assembler are available with recipe selection UI', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('button', { name: /^\u94c1\u77ff\u53d1\u751f\u5668/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^\u7164\u77ff\u53d1\u751f\u5668/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^\u94dc\u77ff\u53d1\u751f\u5668/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^\u7194\u7089/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^\u5408\u6210\u5668/ })).toBeVisible()

  const canvas = page.getByTestId('factory-canvas')
  await page.getByRole('button', { name: /^\u5408\u6210\u5668/ }).click()
  await canvas.click({ position: { x: 500, y: 240 } })
  await canvas.dblclick({ position: { x: 500, y: 240 } })

  await expect(page.locator('.recipe-panel')).toBeVisible()
  await expect(page.locator('.recipe-choice')).toContainText(['\u94c1\u677f', '\u94dc\u7ebf', '\u9f7f\u8f6e', '\u7535\u8def'])
})


test('machine ports use integrated tapered housings with inward and outward direction marks', async () => {
  const assets = await import('node:fs/promises').then((fs) => fs.readFile('src/render/factoryAssets.ts', 'utf8'))
  const renderer = await import('node:fs/promises').then((fs) => fs.readFile('src/render/canvasRenderer.ts', 'utf8'))

  expect(assets).toContain("entity.type === 'furnace'")
  expect(assets).toContain("entity.type === 'assembler'")
  expect(renderer).toContain('function drawMachinePortHousings')
  expect(renderer).toContain('function drawMachinePortHousing')
  expect(renderer).toContain('function drawPortDirectionTriangle')
  expect(renderer).toContain("const INPUT_PORT_COLOR = '#86bd73'")
  expect(renderer).toContain("const OUTPUT_PORT_COLOR = '#6fa9c8'")
  expect(renderer).toContain('const length = size * 0.34')
  expect(renderer).toContain('const thickness = track * 0.52')
  expect(renderer).not.toContain('function drawInputPortGate')
  expect(renderer).not.toContain('function drawOutputPortGate')
  expect(renderer).not.toContain('function drawMachinePortSockets')
  expect(renderer).not.toContain('function drawMachinePortCaps')
  expect(renderer).not.toContain('fillText')
  expect(renderer).not.toContain('输入')
  expect(renderer).not.toContain('输出')
})

test('R remains a rotate shortcut and is not assigned to a machine tool', async ({ page }) => {
  await page.goto('/')

  await expect(page.locator('.tool-row').filter({ hasText: /^\u65cb\u8f6c\u5668/ })).not.toContainText(/^R\s*\//)
  const canvas = page.getByTestId('factory-canvas')
  await page.locator('.tool-row').filter({ hasText: '\u5207\u5272\u673a' }).first().click()
  await canvas.click({ position: { x: 300, y: 240 } })
  const before = await canvas.screenshot()
  await page.keyboard.press('r')
  await page.waitForTimeout(120)
  const after = await canvas.screenshot()

  expect(Buffer.compare(before, after)).not.toBe(0)
})
test('belt design uses pale guide marks without arrow-shaped blue markers', async ({ page }) => {
  await page.goto('/')
  const canvas = page.locator('.factory-canvas-static.active')
  const markerStats = await canvas.evaluate((node) => {
    const c = node as HTMLCanvasElement
    const ctx = c.getContext('2d')
    if (!ctx) return { pale: 0, saturatedBlue: 0 }
    const data = ctx.getImageData(0, 0, c.width, c.height).data
    let pale = 0
    let saturatedBlue = 0
    for (let index = 0; index < data.length; index += 4) {
      const r = data[index]
      const g = data[index + 1]
      const b = data[index + 2]
      const a = data[index + 3]
      if (a > 120 && r > 145 && g > 145 && b > 145 && Math.abs(r - g) < 28 && Math.abs(g - b) < 28) pale += 1
      if (a > 180 && b > 150 && r < 70 && g < 130) saturatedBlue += 1
    }
    return { pale, saturatedBlue }
  })
  expect(markerStats.pale).toBeGreaterThan(300)
  expect(markerStats.saturatedBlue).toBeLessThan(20)
})

test('geometric canvas paints nonblank seamless belts and machines', async ({ page }) => {
  await page.goto('/')
  const canvas = page.locator('.factory-canvas-static.active')
  const painted = await canvas.evaluate((node) => {
    const c = node as HTMLCanvasElement
    const ctx = c.getContext('2d')
    if (!ctx) return false
    const sample = ctx.getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 80, 80).data
    let colored = 0
    for (let index = 0; index < sample.length; index += 4) {
      if (sample[index + 3] !== 0 && Math.abs(sample[index] - sample[index + 1]) > 3) colored += 1
    }
    return colored > 20
  })
  expect(painted).toBe(true)
})


test('belt guide marks are rendered as triangular paths instead of circular dots', async () => {
  const source = await import('node:fs/promises').then((fs) => fs.readFile('src/render/canvasRenderer.ts', 'utf8'))
  const match = source.match(/function drawBeltPaleTriangle[\s\S]*?\n}/)

  expect(match?.[0]).toContain('lineTo')
  expect(match?.[0]).not.toContain('arc(')
})


test('belt guide marks use the belt output direction only', async () => {
  const source = await import('node:fs/promises').then((fs) => fs.readFile('src/render/canvasRenderer.ts', 'utf8'))
  const call = source.match(/drawBeltGuideMarks\(ctx, x, y, size, plan\.direction, connections\.length\)/)
  const match = source.match(/function drawBeltGuideMarks[\s\S]*?\n}/)

  expect(call).toBeTruthy()
  expect(match?.[0]).not.toContain('connections.forEach')
})

test('canvas background uses a single orthogonal grid layer', async () => {
  const source = await import('node:fs/promises').then((fs) => fs.readFile('src/render/canvasRenderer.ts', 'utf8'))
  const gridMatch = source.match(/function drawGrid[\s\S]*?function drawBeltPreview/)

  expect(gridMatch?.[0]).not.toContain('for (let i = -height; i < width; i += 22)')
  expect(gridMatch?.[0]).not.toContain("fillStyle = '#334047'")
})


test('underground tunnel preview and pairing use tunnel visuals instead of belt sprites', async () => {
  const renderer = await import('node:fs/promises').then((fs) => fs.readFile('src/render/canvasRenderer.ts', 'utf8'))
  const canvas = await import('node:fs/promises').then((fs) => fs.readFile('src/components/editor/FactoryCanvas.vue', 'utf8'))

  expect(canvas).toContain("tool: props.project.activeTool === 'tunnel' ? 'tunnel' : 'belt'")
  expect(renderer).toContain("if (preview.tool === 'tunnel') drawMachineAsset")
  expect(renderer).toContain('function drawTunnelLinks')
  expect(renderer).toContain('function drawTunnelLink')
  expect(renderer).toContain('function findTunnelExit')
})


test('smooth conveyor item motion is rendered between belt edges instead of fixed cell centers', async () => {
  const renderer = await import('node:fs/promises').then((fs) => fs.readFile('src/render/canvasRenderer.ts', 'utf8'))
  const canvas = await import('node:fs/promises').then((fs) => fs.readFile('src/components/editor/FactoryCanvas.vue', 'utf8'))
  const model = await import('node:fs/promises').then((fs) => fs.readFile('src/models/factory.ts', 'utf8'))
  const app = await import('node:fs/promises').then((fs) => fs.readFile('src/app/App.vue', 'utf8'))

  expect(model).toContain('enteredTick?: number')
  expect(app).toContain('SIMULATION_STEP_MS')
  expect(app).toContain('simAccumulator')
  expect(canvas).toContain('renderFactoryDynamicCanvas')
  expect(renderer).toContain('function beltItemPoint')
  expect(renderer).toContain('function beltFrameProgress')
  expect(renderer).toContain('scene.belts.forEach((entity) => {')
  expect(renderer).toContain('beltItemPoint(project, entity')
  expect(renderer).toContain('const radius = BELT_ITEM_RADIUS * viewport.zoom')
  expect(renderer).toContain('if (t < 0.5) return lerpPoint(from, center, t / 0.5)')
  expect(renderer).not.toContain('queuedItem')
  expect(renderer).toContain('drawShapeBatch')
  expect(renderer).toContain('beltFrameProgress(project, renderAlpha)')
  expect(renderer).not.toContain('performance.now()')
  expect(renderer).not.toContain('drawShape(ctx, item.shape, x + size / 2, y + size / 2')
  expect(canvas).toContain('const renderAlpha = props.project.running')
})

test('conveyor animation uses one render clock and stable shape paths to avoid jitter', async () => {
  const renderer = await import('node:fs/promises').then((fs) => fs.readFile('src/render/canvasRenderer.ts', 'utf8'))
  const canvas = await import('node:fs/promises').then((fs) => fs.readFile('src/components/editor/FactoryCanvas.vue', 'utf8'))
  const app = await import('node:fs/promises').then((fs) => fs.readFile('src/app/App.vue', 'utf8'))
  const drawShape = renderer.match(/function drawShape\([\s\S]*?function shouldUseShapeAccent/)

  expect(canvas).not.toContain('function animateBelts')
  expect(canvas).toContain('animationFrame = window.requestAnimationFrame(animateItems)')
  expect(app).not.toContain('project.renderAlpha =')
  expect(app).not.toContain('else scheduleSaveProject()')
  expect(renderer).toContain('return clamp01(renderAlpha)')
  expect(drawShape?.[0]).toContain('ctx.beginPath()')
  expect(drawShape?.[0]).toContain('appendShapePath')
  expect(drawShape?.[0]).not.toContain('ctx.fillRect(x - radius')
  expect(drawShape?.[0]).not.toContain('ctx.strokeRect')
})

test('industrial products render with data-driven polygon tiers', async () => {
  const renderer = await import('node:fs/promises').then((fs) => fs.readFile('src/render/canvasRenderer.ts', 'utf8'))
  const resources = await import('node:fs/promises').then((fs) => fs.readFile('src/data/resources.ts', 'utf8'))

  expect(renderer).toContain('const tier = shapeById[shape]?.tier')
  expect(renderer).toContain('appendTierPath')
  expect(renderer).toContain('appendRegularPolygon(ctx, tier + 2')
  expect(resources).toContain("id: 'iron-ore'")
  expect(resources).toContain('tier: 0')
  expect(resources).toContain("id: 'iron-ingot'")
  expect(resources).toContain('tier: 1')
  expect(resources).toContain("id: 'iron-plate'")
  expect(resources).toContain('tier: 2')
  expect(resources).toContain("id: 'utility-pack'")
  expect(resources).toContain('tier: 6')
})
test('canvas does not render the floating goal rail over the factory workspace', async () => {
  const renderer = await import('node:fs/promises').then((fs) => fs.readFile('src/render/canvasRenderer.ts', 'utf8'))

  expect(renderer).not.toContain('drawGoalRail(ctx, project)')
  expect(renderer).not.toContain('function drawGoalRail')
  expect(renderer).not.toContain('fillText(`\\u76ee\\u6807')
})
test('pan tool labels and README stay clean Chinese for GitHub publishing', async () => {
  const app = await import('node:fs/promises').then((fs) => fs.readFile('src/app/App.vue', 'utf8'))
  const readme = await import('node:fs/promises').then((fs) => fs.readFile('README.md', 'utf8'))

  expect(app).toContain('\u79fb\u52a8\u753b\u5e03')
  expect(app).toContain('\u62d6\u52a8\u89c6\u89d2\uff0c\u4e0d\u653e\u7f6e\u5efa\u7b51\u3002')
  expect(app).not.toContain('\ufffd')
  expect(readme).toContain('# FactoryGrid')
  expect(readme).not.toContain('## \u5f00\u53d1\u7ea6\u5b9a')
  expect(readme).not.toContain('\ufffd')
})

test('research moves from the sidebar into a placeable lab', async ({ page }) => {
  await page.goto('/')

  await expect(page.locator('.research-panel')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^研究中心/ })).toBeVisible()
  const canvas = page.getByTestId('factory-canvas')
  await page.getByRole('button', { name: /^合成器/ }).click()
  await canvas.click({ position: { x: 500, y: 240 } })
  await canvas.dblclick({ position: { x: 500, y: 240 } })

  await expect(page.locator('.recipe-choice')).toContainText(['铁板', '铜线', '齿轮', '电路', '物流研究包'])
  await expect(page.locator('.recipe-choice').filter({ hasText: '电机' })).toHaveCount(0)
})
test('completed metallurgy research reveals the motor recipe and upgrade planner', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('factorygrid-shapez-v4', JSON.stringify({
      id: 'researched-factory',
      name: '研究工厂',
      tick: 0,
      running: false,
      renderAlpha: 0,
      speed: 2,
      activeTool: 'belt',
      activeDirection: 'east',
      viewport: { x: 150, y: 88, zoom: 1 },
      goals: [],
      unlocked: ['belt', 'fast-belt', 'assembler', 'furnace', 'hub'],
      entities: [],
      belts: {},
      metrics: { delivered: {}, produced: {}, trashed: {}, beltItems: 0, activeBuildings: 0, bottlenecks: [], recentDelivery: [] },
      research: {
        points: 0,
        delivered: { 'iron-plate': 8, 'copper-wire': 8, 'iron-gear': 8, circuit: 8, steel: 8 },
        progress: {},
        consumed: {},
        completed: ['logistics-engineering', 'automation-upgrade', 'metallurgy-automation'],
        maxMachineLevel: 2
      },
      performance: { fps: 60, frameTime: 16.7, quality: 'high' },
      errors: [],
      events: [],
      blueprints: [],
      history: []
    }))
  })
  await page.goto('/')

  await expect(page.getByRole('button', { name: /升级规划器/ })).toBeEnabled()
  await expect(page.getByRole('button', { name: /^高速传送带/ })).toBeVisible()

  const canvas = page.getByTestId('factory-canvas')
  await page.getByRole('button', { name: /^合成器/ }).click()
  await canvas.click({ position: { x: 500, y: 240 } })
  await canvas.dblclick({ position: { x: 500, y: 240 } })
  await expect(page.locator('.recipe-choice').filter({ hasText: '电机' })).toBeVisible()
})

test('large factory tools provide area copy paste delete and upgrade workflows', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('button', { name: /框选复制/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /蓝图粘贴/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /批量拆除/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /升级规划器/ })).toBeDisabled()

  const canvas = page.getByTestId('factory-canvas')
  await page.getByRole('button', { name: /框选复制/ }).click()
  await canvas.dragTo(canvas, {
    sourcePosition: { x: 160, y: 110 },
    targetPosition: { x: 300, y: 220 }
  })

  await expect(page.locator('.blueprint-card').filter({ hasText: '区域蓝图' }).first()).toBeVisible()
})

test('performance status and viewport culling protect large canvas rendering', async ({ page }) => {
  await page.goto('/')

  await expect(page.locator('.performance-readout')).toContainText('FPS')
  await expect(page.locator('.performance-readout')).toContainText(/清晰|流畅/)

  const renderer = await import('node:fs/promises').then((fs) => fs.readFile('src/render/canvasRenderer.ts', 'utf8'))
  const app = await import('node:fs/promises').then((fs) => fs.readFile('src/app/App.vue', 'utf8'))

  expect(renderer).toContain('function visibleEntities')
  expect(renderer).toContain('function visibleGridBounds')
  expect(renderer).toContain('const ratioCap')
  expect(app).toContain('MAX_SIMULATION_STEPS_PER_FRAME')
  expect(app).toContain('updatePerformance')
})

test('conveyor animation uses layered canvases without reactive per-frame updates', async () => {
  const canvas = await import('node:fs/promises').then((fs) => fs.readFile('src/components/editor/FactoryCanvas.vue', 'utf8'))
  const renderer = await import('node:fs/promises').then((fs) => fs.readFile('src/render/canvasRenderer.ts', 'utf8'))
  const app = await import('node:fs/promises').then((fs) => fs.readFile('src/app/App.vue', 'utf8'))

  expect(canvas).toContain('factory-canvas-static')
  expect(canvas).toContain('factory-canvas-dynamic')
  expect(canvas).toContain('factory-canvas-machine-overlay')
  expect(canvas).toContain('renderFactoryStaticCanvas')
  expect(canvas).toContain('renderFactoryDynamicCanvas')
  expect(canvas).toContain('renderFactoryMachineOverlayCanvas(')
  expect(canvas).toContain('chunkCache')
  expect(canvas).toContain('chunkSnapshot')
  expect(canvas).toContain("document.visibilityState === 'hidden'")
  expect(renderer).toContain('export interface FactoryRenderScene')
  expect(renderer).toContain('beltPlans: Map<string, BeltSpritePlan>')
  expect(renderer).not.toContain('queuedItem')
  expect(app).not.toContain('project.renderAlpha =')
  expect(app).not.toContain('else scheduleSaveProject()')
  expect(canvas).not.toContain('props.project.renderAlpha')
})
test('standard belt interpolation respects its two tick movement interval', async () => {
  const renderer = await import('node:fs/promises').then((fs) => fs.readFile('src/render/canvasRenderer.ts', 'utf8'))
  expect(renderer).toContain('function beltMoveInterval')
  expect(renderer).toContain('/ beltMoveInterval(entity)')
})

test('research is configured through a double-clickable research lab instead of the sidebar', async ({ page }) => {
  await page.goto('/')

  await expect(page.locator('.research-panel')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^研究中心/ })).toBeVisible()

  const canvas = page.getByTestId('factory-canvas')
  await page.getByRole('button', { name: /^研究中心/ }).click()
  await canvas.click({ position: { x: 500, y: 240 } })
  await canvas.dblclick({ position: { x: 500, y: 240 } })

  await expect(page.locator('.research-project-panel')).toBeVisible()
  await expect(page.locator('.research-project-choice')).toHaveCount(7)
  await expect(page.locator('.research-project-choice')).toContainText(['物流工程', '自动化升级', '冶金自动化', '高级电子学', '机器人技术', '自动化核心', '规模化生产'])
})

test('static world chunks are reused for previews and locally invalidated after building', async ({ page }) => {
  await page.addInitScript(() => {
    const trackedWindow = window as typeof window & { __factoryChunkCanvases: number }
    const originalCreateElement = Document.prototype.createElement
    trackedWindow.__factoryChunkCanvases = 0
    Document.prototype.createElement = function (tagName: string) {
      const element = originalCreateElement.call(this, tagName)
      if (tagName.toLowerCase() === 'canvas') trackedWindow.__factoryChunkCanvases += 1
      return element
    }
  })
  await page.goto('/')

  const canvas = page.getByTestId('factory-canvas')
  await page.locator('.tool-row').filter({ hasText: '切割机' }).first().click()
  await page.evaluate(() => { (window as typeof window & { __factoryChunkCanvases: number }).__factoryChunkCanvases = 0 })

  for (const position of [{ x: 560, y: 230 }, { x: 610, y: 260 }, { x: 660, y: 290 }]) {
    await canvas.hover({ position })
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
  }
  await page.keyboard.press('r')
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  expect(await page.evaluate(() => (window as typeof window & { __factoryChunkCanvases: number }).__factoryChunkCanvases)).toBe(0)

  await canvas.click({ position: { x: 660, y: 290 } })
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  const rebuiltAfterPlacement = await page.evaluate(() => (
    window as typeof window & { __factoryChunkCanvases: number }
  ).__factoryChunkCanvases)
  expect(rebuiltAfterPlacement).toBeGreaterThan(0)
  expect(rebuiltAfterPlacement).toBeLessThanOrEqual(6)

  await canvas.hover({ position: { x: 680, y: 300 } })
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  expect(await page.evaluate(() => (window as typeof window & { __factoryChunkCanvases: number }).__factoryChunkCanvases)).toBe(rebuiltAfterPlacement)
})
test('canvas panning streams covered viewports without per-event redraws or blank edges', async ({ page }) => {
  await page.addInitScript(() => {
    const trackedWindow = window as typeof window & { __factoryStaticPaints: number }
    const originalClearRect = CanvasRenderingContext2D.prototype.clearRect
    trackedWindow.__factoryStaticPaints = 0
    CanvasRenderingContext2D.prototype.clearRect = function (...args: [number, number, number, number]) {
      if (this.canvas.classList.contains('factory-canvas-static')) trackedWindow.__factoryStaticPaints += 1
      return originalClearRect.apply(this, args)
    }
  })
  await page.goto('/')

  const canvas = page.getByTestId('factory-canvas')
  const layers = page.locator('.factory-render-layer.active')
  await page.locator('.pan-tool').click()
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
  await page.evaluate(() => { (window as typeof window & { __factoryStaticPaints: number }).__factoryStaticPaints = 0 })

  await canvas.evaluate((node) => {
    const rect = node.getBoundingClientRect()
    const startX = rect.left + rect.width * 0.45
    const startY = rect.top + rect.height * 0.45
    node.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, buttons: 1, clientX: startX, clientY: startY }))
    for (let step = 1; step <= 64; step += 1) {
      node.dispatchEvent(new MouseEvent('mousemove', {
        bubbles: true,
        button: 0,
        buttons: 1,
        clientX: startX + step * 10,
        clientY: startY + step * 6
      }))
    }
  })
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))

  const streamedPaints = await page.evaluate(() => (
    window as typeof window & { __factoryStaticPaints: number }
  ).__factoryStaticPaints)
  expect(streamedPaints).toBeGreaterThan(0)
  expect(streamedPaints).toBeLessThanOrEqual(4)
  const transforms = await layers.evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).style.transform))
  expect(new Set(transforms).size).toBe(1)
  expect(transforms[0] === '' || /^translate3d\(/.test(transforms[0])).toBe(true)
  const stageGrid = await page.locator('.factory-canvas-stage').evaluate((stage) => {
    const style = getComputedStyle(stage)
    return { image: style.backgroundImage, size: style.backgroundSize, position: style.backgroundPosition }
  })
  expect(stageGrid.image).toContain('linear-gradient')
  expect(stageGrid.size).not.toBe('auto')

  await canvas.evaluate((node) => {
    const rect = node.getBoundingClientRect()
    node.dispatchEvent(new MouseEvent('mouseup', {
      bubbles: true,
      button: 0,
      clientX: rect.left + rect.width * 0.45 + 640,
      clientY: rect.top + rect.height * 0.45 + 384
    }))
  })
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
  expect(await layers.evaluateAll((nodes) => nodes.every((node) => !(node as HTMLElement).style.transform))).toBe(true)
  expect(await page.evaluate(() => (
    window as typeof window & { __factoryStaticPaints: number }
  ).__factoryStaticPaints)).toBeGreaterThanOrEqual(streamedPaints)
})

test('panning streams newly visible chunks before mouse release without deleting belts', async ({ page }) => {
  await page.addInitScript(() => {
    const trackedWindow = window as typeof window & { __factoryStaticPaints: number }
    const originalClearRect = CanvasRenderingContext2D.prototype.clearRect
    trackedWindow.__factoryStaticPaints = 0
    CanvasRenderingContext2D.prototype.clearRect = function (...args: [number, number, number, number]) {
      if (this.canvas.classList.contains('factory-canvas-static')) trackedWindow.__factoryStaticPaints += 1
      return originalClearRect.apply(this, args)
    }
  })
  await page.goto('/')

  await page.locator('.run-controls button').nth(4).click()
  const before = await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('factorygrid-shapez-v4') ?? '{}') as {
      entities?: Array<{ kind: string }>
    }
    return saved.entities?.filter((entity) => entity.kind === 'belt').length ?? 0
  })
  const canvas = page.getByTestId('factory-canvas')
  await page.locator('.pan-tool').click()
  await page.evaluate(() => { (window as typeof window & { __factoryStaticPaints: number }).__factoryStaticPaints = 0 })

  const box = await canvas.boundingBox()
  if (!box) throw new Error('factory canvas has no bounds')
  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.5)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.92, box.y + box.height * 0.82, { steps: 24 })
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))

  expect(await page.evaluate(() => (window as typeof window & { __factoryStaticPaints: number }).__factoryStaticPaints)).toBeGreaterThan(0)
  expect(await page.locator('.factory-canvas-static.active').evaluate((node) => getComputedStyle(node).transform)).not.toBe('none')

  await page.mouse.up()
  await page.waitForFunction(() => (
    Array.from(document.querySelectorAll('.factory-render-layer.active'))
      .every((node) => !(node as HTMLElement).style.transform)
  ))
  const after = await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('factorygrid-shapez-v4') ?? '{}') as {
      entities?: Array<{ kind: string }>
    }
    return saved.entities?.filter((entity) => entity.kind === 'belt').length ?? 0
  })
  expect(after).toBe(before)
  await expect(page.locator('.factory-canvas-stage > canvas')).toHaveCount(7)
  expect(await page.locator('.factory-render-layer.active').evaluateAll((nodes) => (
    nodes.every((node) => !(node as HTMLElement).style.transform)
  ))).toBe(true)
})
test('mouse release keeps the first frame responsive and settles the camera while idle', async ({ page }) => {
  await page.addInitScript(() => {
    const state = window as typeof window & {
      __releaseStaticPaints: number
      __releaseStart: number
      __releaseHandlerDuration: number
      __releaseChunkCanvases: number
      __releaseStores: number
    }
    state.__releaseStaticPaints = 0
    state.__releaseStart = 0
    state.__releaseHandlerDuration = 0
    state.__releaseChunkCanvases = 0
    state.__releaseStores = 0
    const originalCreateElement = Document.prototype.createElement
    Document.prototype.createElement = function (tagName: string) {
      const element = originalCreateElement.call(this, tagName)
      if (state.__releaseStart && tagName.toLowerCase() === 'canvas') state.__releaseChunkCanvases += 1
      return element
    }
    const originalSetItem = Storage.prototype.setItem
    Storage.prototype.setItem = function (...args: [string, string]) {
      if (state.__releaseStart) state.__releaseStores += 1
      return originalSetItem.apply(this, args)
    }
    const originalClearRect = CanvasRenderingContext2D.prototype.clearRect
    CanvasRenderingContext2D.prototype.clearRect = function (...args: [number, number, number, number]) {
      if (state.__releaseStart && this.canvas.classList.contains('factory-canvas-static')) {
        state.__releaseStaticPaints += 1
      }
      return originalClearRect.apply(this, args)
    }
  })
  await page.goto('/')

  const canvas = page.getByTestId('factory-canvas')
  await page.locator('.pan-tool').click()
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  await page.evaluate(() => {
    const state = window as typeof window & {
      __releaseStaticPaints: number
      __releaseStart: number
    }
    state.__releaseStaticPaints = 0
    state.__releaseStart = 0
  })
  const box = await canvas.boundingBox()
  if (!box) throw new Error('factory canvas has no bounds')
  await page.mouse.move(box.x + box.width * 0.42, box.y + box.height * 0.46)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.42 + 120, box.y + box.height * 0.46 + 60, { steps: 12 })
  await canvas.evaluate((node) => {
    const state = window as typeof window & {
      __releaseStart: number
      __releaseHandlerDuration: number
    }
    const rect = node.getBoundingClientRect()
    state.__releaseStart = performance.now()
    node.dispatchEvent(new MouseEvent('mouseup', {
      bubbles: true,
      button: 0,
      clientX: rect.left + rect.width * 0.42 + 120,
      clientY: rect.top + rect.height * 0.46 + 60
    }))
    state.__releaseHandlerDuration = performance.now() - state.__releaseStart
  })
  const firstFrame = await page.evaluate(() => new Promise<{
    handler: number
    paints: number
    chunks: number
    stores: number
  }>((resolve) => {
    const state = window as typeof window & {
      __releaseHandlerDuration: number
      __releaseStaticPaints: number
      __releaseChunkCanvases: number
      __releaseStores: number
    }
    requestAnimationFrame(() => resolve({
      handler: state.__releaseHandlerDuration,
      paints: state.__releaseStaticPaints,
      chunks: state.__releaseChunkCanvases,
      stores: state.__releaseStores
    }))
  }))
  expect(firstFrame.handler).toBeLessThan(4)
  expect(firstFrame.paints).toBeLessThanOrEqual(1)
  expect(firstFrame.chunks).toBe(0)
  expect(firstFrame.stores).toBe(0)

  await page.waitForFunction(() => (
    Array.from(document.querySelectorAll('.factory-render-layer.active'))
      .every((node) => !(node as HTMLElement).style.transform)
  ))
  expect(await page.evaluate(() => (
    window as typeof window & { __releaseStaticPaints: number }
  ).__releaseStaticPaints)).toBeLessThanOrEqual(1)
})
test('releasing the mouse over warmed chunks stays fast in a large factory', async ({ page }) => {
  await page.addInitScript(() => {
    const project = {
      id: 'large-factory', name: 'large-factory', tick: 0, running: false, renderAlpha: 0, speed: 1,
      activeTool: 'pan', activeDirection: 'east', viewport: { x: 130, y: 88, zoom: 1 }, goals: [],
      unlocked: ['belt'], entities: [] as Array<Record<string, unknown>>, belts: {} as Record<string, object>,
      metrics: { delivered: {}, produced: {}, trashed: {}, beltItems: 0, activeBuildings: 0, bottlenecks: [], recentDelivery: [] },
      research: { points: 0, delivered: {}, progress: {}, consumed: {}, completed: [], maxMachineLevel: 1 },
      performance: { fps: 60, frameTime: 16.7, quality: 'high' }, errors: [], events: [], blueprints: [], history: []
    }
    for (let y = -30; y < 30; y += 1) {
      for (let x = -50; x < 50; x += 1) {
        const id = `large-belt-${x}-${y}`
        project.entities.push({
          id, kind: 'belt', type: 'belt', label: 'belt', position: { x, y }, direction: 'east',
          input: [], output: [], progress: 0, status: 'idle'
        })
        project.belts[id] = {}
      }
    }
    localStorage.setItem('factorygrid-shapez-v4', JSON.stringify(project))
  })
  await page.goto('/')

  const canvas = page.getByTestId('factory-canvas')
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  await page.evaluate(() => {
    const state = window as typeof window & {
      __largeChunkCanvases: number
      __largeCommitStart: number
      __largeCommitDuration: number
    }
    state.__largeChunkCanvases = 0
    state.__largeCommitStart = 0
    state.__largeCommitDuration = 0
    const originalCreateElement = Document.prototype.createElement
    Document.prototype.createElement = function (tagName: string) {
      const element = originalCreateElement.call(this, tagName)
      if (state.__largeCommitStart && tagName.toLowerCase() === 'canvas') state.__largeChunkCanvases += 1
      return element
    }
    const layers = Array.from(document.querySelectorAll('.factory-render-layer.active'))
    layers.forEach((layer) => {
      new MutationObserver(() => {
        if (!state.__largeCommitStart) return
        if (layers.every((node) => !(node as HTMLElement).style.transform)) {
          state.__largeCommitDuration = performance.now() - state.__largeCommitStart
        }
      }).observe(layer, { attributes: true, attributeFilter: ['style'] })
    })
  })

  const box = await canvas.boundingBox()
  if (!box) throw new Error('factory canvas has no bounds')
  await page.mouse.move(box.x + box.width * 0.44, box.y + box.height * 0.48)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.44 + 90, box.y + box.height * 0.48 + 45, { steps: 10 })
  await page.evaluate(() => {
    (window as typeof window & { __largeCommitStart: number }).__largeCommitStart = performance.now()
  })
  await page.mouse.up()
  await page.waitForFunction(() => (
    (window as typeof window & { __largeCommitDuration: number }).__largeCommitDuration > 0
  ))

  const result = await page.evaluate(() => {
    const state = window as typeof window & {
      __largeChunkCanvases: number
      __largeCommitDuration: number
    }
    return { chunks: state.__largeChunkCanvases, duration: state.__largeCommitDuration }
  })
  expect(result.chunks).toBe(0)
  expect(result.duration).toBeLessThan(140)
})

test('streaming pan redraws cargo before clearing translated canvas layers', async ({ page }) => {
  await page.goto('/')

  await page.evaluate(() => {
    const state = window as typeof window & {
      __dynamicPaintAfterStatic: boolean
      __unsyncedPanClears: number
    }
    state.__dynamicPaintAfterStatic = true
    state.__unsyncedPanClears = 0
    const originalClearRect = CanvasRenderingContext2D.prototype.clearRect
    CanvasRenderingContext2D.prototype.clearRect = function (...args: [number, number, number, number]) {
      if (this.canvas.classList.contains('factory-canvas-static')) state.__dynamicPaintAfterStatic = false
      if (this.canvas.classList.contains('factory-canvas-dynamic')
        && !this.canvas.classList.contains('factory-canvas-machine-overlay')) {
        state.__dynamicPaintAfterStatic = true
      }
      return originalClearRect.apply(this, args)
    }
    document.querySelectorAll('.factory-render-layer').forEach((canvas) => {
      new MutationObserver(() => {
        if (!(canvas as HTMLElement).style.transform && !state.__dynamicPaintAfterStatic) {
          state.__unsyncedPanClears += 1
        }
      }).observe(canvas, { attributes: true, attributeFilter: ['style'] })
    })
  })

  const canvas = page.getByTestId('factory-canvas')
  await page.locator('.pan-tool').click()
  const box = await canvas.boundingBox()
  if (!box) throw new Error('factory canvas has no bounds')
  await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.45)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.88, box.y + box.height * 0.78, { steps: 30 })
  await page.mouse.up()
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))

  expect(await page.evaluate(() => (
    window as typeof window & { __unsyncedPanClears: number }
  ).__unsyncedPanClears)).toBe(0)
})
test('mouse release keeps translated cargo animating before the idle camera commit', async ({ page }) => {
  await page.addInitScript(() => {
    const state = window as typeof window & {
      __releaseDynamicPaints: number
      __releaseStaticPaints: number
      __captureReleasePaints: boolean
      __releaseFrameTimes: number[]
    }
    state.__releaseDynamicPaints = 0
    state.__releaseStaticPaints = 0
    state.__captureReleasePaints = false
    state.__releaseFrameTimes = []
    const project = {
      id: 'release-cargo-project', name: 'release-cargo-project', tick: 0, running: false, renderAlpha: 0, speed: 1,
      activeTool: 'pan', activeDirection: 'east', viewport: { x: 130, y: 88, zoom: 1 }, goals: [], unlocked: ['belt'],
      entities: [{
        id: 'visible-belt', kind: 'belt', type: 'belt', label: 'belt', position: { x: 6, y: 5 }, direction: 'east',
        input: [], output: [], progress: 0, status: 'idle'
      }],
      belts: {
        'visible-belt': {
          item: { id: 'release-cargo', shape: 'circle', age: 0 }, enteredTick: 0, lastMovedTick: 0
        }
      },
      metrics: { delivered: {}, produced: {}, trashed: {}, beltItems: 1, activeBuildings: 0, bottlenecks: [], recentDelivery: [] },
      research: { points: 0, delivered: {}, progress: {}, consumed: {}, completed: [], maxMachineLevel: 1 },
      performance: { fps: 60, frameTime: 16.7, quality: 'high' }, errors: [], events: [], blueprints: [], history: []
    }
    localStorage.setItem('factorygrid-shapez-v4', JSON.stringify(project))
    const originalClearRect = CanvasRenderingContext2D.prototype.clearRect
    CanvasRenderingContext2D.prototype.clearRect = function (...args: [number, number, number, number]) {
      if (state.__captureReleasePaints) {
        if (this.canvas.classList.contains('factory-canvas-static')) state.__releaseStaticPaints += 1
        else if (this.canvas.classList.contains('factory-canvas-dynamic')
          && !this.canvas.classList.contains('factory-canvas-machine-overlay')) state.__releaseDynamicPaints += 1
      }
      return originalClearRect.apply(this, args)
    }
    const sampleFrame = (time: number) => {
      if (state.__captureReleasePaints) state.__releaseFrameTimes.push(time)
      requestAnimationFrame(sampleFrame)
    }
    requestAnimationFrame(sampleFrame)
  })
  await page.goto('/')

  const canvas = page.getByTestId('factory-canvas')
  await page.locator('.pan-tool').click()
  const box = await canvas.boundingBox()
  if (!box) throw new Error('factory canvas has no bounds')
  await page.mouse.move(box.x + box.width * 0.46, box.y + box.height * 0.48)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.46 + 96, box.y + box.height * 0.48 + 44, { steps: 14 })
  await page.evaluate(() => {
    const state = window as typeof window & {
      __releaseDynamicPaints: number
      __releaseStaticPaints: number
      __captureReleasePaints: boolean
      __releaseFrameTimes: number[]
    }
    state.__releaseDynamicPaints = 0
    state.__releaseStaticPaints = 0
    state.__releaseFrameTimes = []
    state.__captureReleasePaints = true
  })
  await page.mouse.up()
  const earlyFrames = await page.evaluate(() => new Promise<{
    dynamicPaints: number
    staticPaints: number
    transformed: boolean
  }>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => {
    const state = window as typeof window & {
      __releaseDynamicPaints: number
      __releaseStaticPaints: number
    }
    resolve({
      dynamicPaints: state.__releaseDynamicPaints,
      staticPaints: state.__releaseStaticPaints,
      transformed: Array.from(document.querySelectorAll('.factory-render-layer.active'))
        .every((node) => Boolean((node as HTMLElement).style.transform))
    })
  }))))
  expect(earlyFrames.dynamicPaints).toBeGreaterThanOrEqual(2)
  expect(earlyFrames.staticPaints).toBe(0)
  expect(earlyFrames.transformed).toBe(true)

  await page.waitForFunction(() => (
    Array.from(document.querySelectorAll('.factory-render-layer.active'))
      .every((node) => !(node as HTMLElement).style.transform)
  ))
  await page.evaluate(() => {
    const state = window as typeof window & { __captureReleasePaints: boolean; __releaseFrameTimes: number[] }
    state.__captureReleasePaints = false
    const gaps = state.__releaseFrameTimes.slice(1).map((time, index) => time - state.__releaseFrameTimes[index])
    ;(window as typeof window & { __releaseMaxFrameGap: number }).__releaseMaxFrameGap = Math.max(0, ...gaps)
  })
  expect(await page.evaluate(() => (
    window as typeof window & { __releaseMaxFrameGap: number }
  ).__releaseMaxFrameGap)).toBeLessThan(34)
})
test('M opens a cached full factory map which can navigate the main camera', async ({ page }) => {
  await page.goto('/')

  await expect(page.locator('.factory-minimap')).toHaveCount(0)
  await page.keyboard.press('m')
  const worldMap = page.locator('.world-map-overlay')
  const mapCanvas = page.getByTestId('world-map-canvas')
  await expect(worldMap).toBeVisible()
  await expect(worldMap).toContainText('工厂地图')
  await expect(mapCanvas).toBeVisible()

  const before = await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('factorygrid-shapez-v4') ?? '{}') as {
      viewport?: { x: number; y: number }
    }
    return saved.viewport
  })

  const pixels = await mapCanvas.evaluate((canvas) => {
    const map = canvas as HTMLCanvasElement
    const context = map.getContext('2d')
    if (!context) return 0
    return Array.from(context.getImageData(0, 0, map.width, map.height).data)
      .filter((value, index) => index % 4 !== 3 && value > 0).length
  })
  expect(pixels).toBeGreaterThan(100)

  await page.evaluate(() => {
    const state = window as typeof window & { __mapCanvasCreations: number }
    state.__mapCanvasCreations = 0
    const originalCreateElement = Document.prototype.createElement
    Document.prototype.createElement = function (tagName: string) {
      const element = originalCreateElement.call(this, tagName)
      if (tagName.toLowerCase() === 'canvas') state.__mapCanvasCreations += 1
      return element
    }
  })
  const box = await mapCanvas.boundingBox()
  if (!box) throw new Error('world map canvas has no bounds')
  await page.mouse.move(box.x + box.width * 0.52, box.y + box.height * 0.52)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.68, box.y + box.height * 0.62, { steps: 12 })
  await page.mouse.up()
  await page.mouse.wheel(0, -240)
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
  expect(await page.evaluate(() => (
    window as typeof window & { __mapCanvasCreations: number }
  ).__mapCanvasCreations)).toBe(0)

  await mapCanvas.dblclick({ position: { x: box.width * 0.72, y: box.height * 0.48 } })
  await expect(worldMap).toHaveCount(0)
  await page.waitForFunction(() => {
    const saved = JSON.parse(localStorage.getItem('factorygrid-shapez-v4') ?? '{}') as {
      viewport?: { x: number; y: number }
    }
    return Boolean(saved.viewport && saved.viewport.x !== 130)
  })
  const after = await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('factorygrid-shapez-v4') ?? '{}') as {
      viewport?: { x: number; y: number }
    }
    return saved.viewport
  })
  expect(after).toBeTruthy()
  expect(after).not.toEqual(before)

  await page.keyboard.press('m')
  await expect(page.locator('.world-map-overlay')).toBeVisible()
  await page.keyboard.press('m')
  await expect(page.locator('.world-map-overlay')).toHaveCount(0)
})

test('world map derives belt corners and machine links from the factory topology', async () => {
  const source = await import('node:fs/promises').then((fs) => fs.readFile('src/components/editor/WorldMap.vue', 'utf8'))
  const assets = await import('node:fs/promises').then((fs) => fs.readFile('src/render/factoryAssets.ts', 'utf8'))

  expect(source).toContain('planBeltSprite(props.project, entity, entityIndex).connections')
  expect(source).toContain('connections.forEach((direction) => drawConnectionArm')
  expect(source).toContain('portConnectsToNeighbor')
  expect(source).toContain('drawTunnelLinks')
  expect(assets).toContain('entityIndex?.get(positionKey(position))')
  expect(assets).not.toContain("entityIndex?.get(position.x + ':' + position.y)")
})
test('blueprint parameters, map bookmarks and adaptive performance controls are available', async ({ page }) => {
  await page.goto('/')

  await expect(page.locator('.blueprint-options')).toBeVisible()
  await expect(page.getByLabel('替换传送带等级')).toBeVisible()
  await page.locator('.blueprint-options button').filter({ hasText: '0°' }).click()
  await expect(page.locator('.blueprint-options')).toContainText('90°')
  await page.keyboard.press('m')
  await expect(page.locator('.world-map-bookmarks')).toBeVisible()
  const before = await page.locator('.world-map-bookmark').count()
  await page.getByTitle('添加当前地图中心').click()
  await expect(page.locator('.world-map-bookmark')).toHaveCount(before + 1)

  const app = await import('node:fs/promises').then((fs) => fs.readFile('src/app/App.vue', 'utf8'))
  const renderer = await import('node:fs/promises').then((fs) => fs.readFile('src/render/canvasRenderer.ts', 'utf8'))
  expect(app).toContain("project.performance.fps < 44")
  expect(app).toContain("? 'performance'")
  expect(app).toContain("? 'balanced' : 'high'")
  expect(renderer).toContain("project.performance?.quality === 'balanced' ? 1.5 : 2")
})

test('large factory workers and incremental chunk saves are wired into production', async () => {
  const app = await import('node:fs/promises').then((fs) => fs.readFile('src/app/App.vue', 'utf8'))
  const workerClient = await import('node:fs/promises').then((fs) => fs.readFile('src/engine/simulation/simulationWorkerClient.ts', 'utf8'))
  const storage = await import('node:fs/promises').then((fs) => fs.readFile('src/utils/projectStorage.ts', 'utf8'))
  const map = await import('node:fs/promises').then((fs) => fs.readFile('src/components/editor/WorldMap.vue', 'utf8'))

  expect(app).toContain('SimulationWorkerClient')
  expect(workerClient).toContain('WORKER_ENTITY_THRESHOLD = 1800')
  expect(storage).toContain("PROJECT_STORAGE_KEY + ':chunk:'")
  expect(storage).toContain('groupEntitiesByChunk')
  expect(map).toContain('worldMap.worker.ts')
  expect(map).toContain("typeof OffscreenCanvas !== 'undefined'")
})

test('placing and deleting in a large factory keep the interaction frame responsive', async ({ page }) => {
  await page.addInitScript(() => {
    const project = {
      id: 'edit-performance', name: 'edit-performance', tick: 0, running: false, renderAlpha: 0, speed: 1,
      activeTool: 'belt', activeDirection: 'east', viewport: { x: 130, y: 88, zoom: 1 }, goals: [],
      unlocked: ['belt'], entities: [] as Array<Record<string, unknown>>, belts: {} as Record<string, object>,
      metrics: { delivered: {}, produced: {}, trashed: {}, beltItems: 0, activeBuildings: 0, bottlenecks: [], recentDelivery: [] },
      research: { points: 0, delivered: {}, progress: {}, consumed: {}, completed: [], maxMachineLevel: 1 },
      performance: { fps: 60, frameTime: 16.7, quality: 'high' }, errors: [], events: [], blueprints: [], history: []
    }
    for (let index = 0; index < 6000; index += 1) {
      const id = `edit-belt-${index}`
      project.entities.push({
        id, kind: 'belt', type: 'belt', label: 'belt', position: { x: index - 3000, y: 30 }, direction: 'east',
        input: [], output: [], progress: 0, status: 'idle'
      })
      project.belts[id] = {}
    }
    localStorage.setItem('factorygrid-shapez-v4', JSON.stringify(project))
  })
  await page.goto('/')

  await page.evaluate(() => {
    const state = window as typeof window & { __editStores: number }
    state.__editStores = 0
    const originalSetItem = Storage.prototype.setItem
    Storage.prototype.setItem = function (...args: [string, string]) {
      state.__editStores += 1
      return originalSetItem.apply(this, args)
    }
  })

  const placement = await page.evaluate(() => new Promise<{ duration: number; stores: number }>((resolve) => {
    const state = window as typeof window & { __editStores: number }
    state.__editStores = 0
    const target = document.querySelector('[data-testid="factory-canvas"]') as HTMLCanvasElement
    const rect = target.getBoundingClientRect()
    const start = performance.now()
    target.dispatchEvent(new MouseEvent('click', {
      bubbles: true, clientX: rect.left + 500, clientY: rect.top + 240, button: 0
    }))
    const duration = performance.now() - start
    requestAnimationFrame(() => resolve({ duration, stores: state.__editStores }))
  }))
  expect(placement.duration).toBeLessThan(14)
  expect(placement.stores).toBe(0)

  const deletion = await page.evaluate(() => new Promise<{ duration: number; stores: number }>((resolve) => {
    const state = window as typeof window & { __editStores: number }
    state.__editStores = 0
    const target = document.querySelector('[data-testid="factory-canvas"]') as HTMLCanvasElement
    const rect = target.getBoundingClientRect()
    const start = performance.now()
    target.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true, clientX: rect.left + 500, clientY: rect.top + 240, button: 2
    }))
    const duration = performance.now() - start
    requestAnimationFrame(() => resolve({ duration, stores: state.__editStores }))
  }))
  expect(deletion.duration).toBeLessThan(14)
  expect(deletion.stores).toBe(0)
})

test('machine placement preview rotates and commits the same direction as the placed entity', async ({ page }) => {
  await page.goto('/')

  const canvas = page.getByTestId('factory-canvas')
  await page.locator('.tool-row').filter({ hasText: '切割机' }).first().click()
  await canvas.hover({ position: { x: 620, y: 260 } })
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
  const eastPreview = await canvas.screenshot()

  await page.keyboard.press('r')
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
  const southPreview = await canvas.screenshot()
  expect(southPreview.equals(eastPreview)).toBe(false)

  await canvas.click({ position: { x: 620, y: 260 } })
  await page.waitForFunction(() => {
    const saved = JSON.parse(localStorage.getItem('factorygrid-shapez-v4') ?? '{}') as {
      entities?: Array<{ type: string; direction: string }>
    }
    return saved.entities?.filter((entity) => entity.type === 'cutter').at(-1)?.direction === 'south'
  })
  const placedDirection = await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('factorygrid-shapez-v4') ?? '{}') as {
      entities?: Array<{ type: string; direction: string }>
    }
    return saved.entities?.filter((entity) => entity.type === 'cutter').at(-1)?.direction
  })
  expect(placedDirection).toBe('south')

  await page.keyboard.press('r')
  await canvas.click({ position: { x: 620, y: 260 } })
  await page.waitForFunction(() => {
    const saved = JSON.parse(localStorage.getItem('factorygrid-shapez-v4') ?? '{}') as {
      entities?: Array<{ type: string; direction: string }>
    }
    return saved.entities?.filter((entity) => entity.type === 'cutter').at(-1)?.direction === 'west'
  })
  const replacement = await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('factorygrid-shapez-v4') ?? '{}') as {
      entities?: Array<{ type: string; direction: string; position: { x: number; y: number } }>
    }
    const cutters = saved.entities?.filter((entity) => entity.type === 'cutter') ?? []
    const latest = cutters.at(-1)
    return {
      direction: latest?.direction,
      occupants: latest
        ? saved.entities?.filter((entity) => (
          entity.position.x === latest.position.x && entity.position.y === latest.position.y
        )).length
        : 0
    }
  })
  expect(replacement).toEqual({ direction: 'west', occupants: 1 })

  const source = await import('node:fs/promises').then((fs) => fs.readFile('src/components/editor/FactoryCanvas.vue', 'utf8'))
  const renderer = await import('node:fs/promises').then((fs) => fs.readFile('src/render/canvasRenderer.ts', 'utf8'))
  const actions = await import('node:fs/promises').then((fs) => fs.readFile('src/engine/simulation/editorActions.ts', 'utf8'))
  expect(source).toContain('placementPreview')
  expect(renderer).toContain('drawPlacementPreview')
  expect(renderer).toContain('drawMachineAsset(ctx, project, preview.entity')
  expect(actions).toContain('createPlacementEntity')
})
