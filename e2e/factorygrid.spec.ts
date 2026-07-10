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
  const canvas = page.getByTestId('factory-canvas')
  await expect(canvas).toBeVisible()
  await expect(page.locator('.tool-row svg')).toHaveCount(5)
  await expect(page.locator('.machine-icon img')).toHaveCount(0)
  await expect(page.locator('.machine-icon .icon-core')).toHaveCount(22)
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


test('furnace and assembler use geometric multi-port caps without text labels', async () => {
  const assets = await import('node:fs/promises').then((fs) => fs.readFile('src/render/factoryAssets.ts', 'utf8'))
  const renderer = await import('node:fs/promises').then((fs) => fs.readFile('src/render/canvasRenderer.ts', 'utf8'))

  expect(assets).toContain("entity.type === 'furnace'")
  expect(assets).toContain("entity.type === 'assembler'")
  expect(renderer).toContain('function drawMachinePortCaps')
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
  const canvas = page.getByTestId('factory-canvas')
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
  const canvas = page.getByTestId('factory-canvas')
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
  expect(renderer).toContain('const point = beltItemPoint')
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
  const drawShape = renderer.match(/function drawShape\([\s\S]*?function star/)

  expect(canvas).not.toContain('function animateBelts')
  expect(canvas).toContain('animationFrame = window.requestAnimationFrame(animateItems)')
  expect(app).not.toContain('project.renderAlpha =')
  expect(app).not.toContain('else scheduleSaveProject()')
  expect(renderer).toContain('return clamp01(renderAlpha)')
  expect(drawShape?.[0]).toContain('ctx.beginPath()')
  expect(drawShape?.[0]).toContain('ctx.rect(')
  expect(drawShape?.[0]).not.toContain('ctx.fillRect(x - radius')
  expect(drawShape?.[0]).not.toContain('ctx.strokeRect')
})

test('ore and factory products render as basic circles or triangles only', async () => {
  const renderer = await import('node:fs/promises').then((fs) => fs.readFile('src/render/canvasRenderer.ts', 'utf8'))
  const drawShape = renderer.match(/function drawShape[\s\S]*?function isBasicCircleShape/)

  expect(renderer).toContain('const basicCircleShapes')
  expect(renderer).toContain('const basicTriangleShapes')
  expect(renderer).toContain('function shouldUseShapeAccent')
  expect(renderer).toContain('const useAccent = !!def?.accent && shouldUseShapeAccent(shape)')
  expect(drawShape?.[0]).toContain('isBasicCircleShape(shape)')
  expect(drawShape?.[0]).toContain('isBasicTriangleShape(shape)')
  expect(drawShape?.[0]).not.toContain("shape === 'iron-gear'")
  expect(drawShape?.[0]).not.toContain("shape === 'copper-wire'")
  expect(drawShape?.[0]).not.toContain("shape === 'circuit'")
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

test('research panel tracks industrial delivery progress and locks advanced recipes', async ({ page }) => {
  await page.goto('/')

  await expect(page.locator('.research-panel')).toBeVisible()
  await expect(page.locator('.research-points')).toContainText('研究点')
  await expect(page.locator('.research-node')).toHaveCount(4)

  const canvas = page.getByTestId('factory-canvas')
  await page.getByRole('button', { name: /^合成器/ }).click()
  await canvas.click({ position: { x: 500, y: 240 } })
  await canvas.dblclick({ position: { x: 500, y: 240 } })

  await expect(page.locator('.recipe-choice')).toContainText(['铁板', '铜线', '齿轮', '电路'])
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
  expect(canvas).toContain('renderFactoryStaticCanvas')
  expect(canvas).toContain('renderFactoryDynamicCanvas')
  expect(canvas).toContain("document.visibilityState === 'hidden'")
  expect(renderer).toContain('export interface FactoryRenderScene')
  expect(renderer).toContain('beltPlans: Map<string, BeltSpritePlan>')
  expect(app).not.toContain('project.renderAlpha =')
  expect(app).not.toContain('else scheduleSaveProject()')
  expect(canvas).not.toContain('props.project.renderAlpha')
})
test('standard belt interpolation respects its two tick movement interval', async () => {
  const renderer = await import('node:fs/promises').then((fs) => fs.readFile('src/render/canvasRenderer.ts', 'utf8'))
  expect(renderer).toContain('function beltMoveInterval')
  expect(renderer).toContain('/ beltMoveInterval(entity)')
})
