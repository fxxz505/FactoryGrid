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

  await page.getByRole('button', { name: /10/ }).click()
  await expect(page.locator('.blueprint-card').first()).toBeVisible()
})

test('machines use simple geometric language without text labels or image assets', async ({ page }) => {
  const assetRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/assets/factory-kit/')) assetRequests.push(request.url())
  })

  await page.goto('/')
  const canvas = page.getByTestId('factory-canvas')
  await expect(canvas).toBeVisible()
  await expect(page.locator('.tool-row svg')).toHaveCount(1)
  await expect(page.locator('.machine-icon img')).toHaveCount(0)
  await expect(page.locator('.machine-icon .icon-core')).toHaveCount(17)
  await expect(page.locator('canvas')).not.toContainText('\u67a2')
  expect(assetRequests).toEqual([])
})





test('R rotates the selected machine instead of only rotating the build tool', async ({ page }) => {
  await page.goto('/')
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
  expect(model).toContain('renderAlpha: number')
  expect(app).toContain('SIMULATION_STEP_MS')
  expect(app).toContain('simAccumulator')
  expect(app).toContain('project.renderAlpha')
  expect(renderer).toContain('function beltItemPoint')
  expect(renderer).toContain('function beltFrameProgress')
  expect(renderer).toContain('function drawBeltItem')
  expect(renderer).toContain('belts.forEach((entity) => drawBeltItem')
  expect(renderer).toContain('project.renderAlpha ?? 0')
  expect(renderer).not.toContain('performance.now()')
  expect(renderer).not.toContain('drawShape(ctx, item.shape, x + size / 2, y + size / 2')
  expect(canvas).toContain('props.project.renderAlpha')
})

test('conveyor animation uses one render clock and stable shape paths to avoid jitter', async () => {
  const renderer = await import('node:fs/promises').then((fs) => fs.readFile('src/render/canvasRenderer.ts', 'utf8'))
  const canvas = await import('node:fs/promises').then((fs) => fs.readFile('src/components/editor/FactoryCanvas.vue', 'utf8'))
  const app = await import('node:fs/promises').then((fs) => fs.readFile('src/app/App.vue', 'utf8'))
  const drawShape = renderer.match(/function drawShape[\s\S]*?function star/)

  expect(canvas).not.toContain('function animateBelts')
  expect(canvas).not.toContain('animationFrame')
  expect(app).toContain('project.renderAlpha = Math.min(1, simAccumulator / stepMs)')
  expect(renderer).toContain('return clamp01(project.renderAlpha ?? 0)')
  expect(drawShape?.[0]).toContain('ctx.beginPath()')
  expect(drawShape?.[0]).toContain('ctx.rect(')
  expect(drawShape?.[0]).not.toContain('ctx.fillRect(x - radius')
  expect(drawShape?.[0]).not.toContain('ctx.strokeRect')
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

  expect(app).toContain('&#31227;&#21160;&#30011;&#24067;')
  expect(app).toContain('&#25302;&#21160;&#35270;&#35282;&#65292;&#19981;&#25918;&#32622;&#24314;&#31569;&#12290;')
  expect(app).not.toMatch(/[�锟]/)
  expect(readme).toContain('# FactoryGrid')
  expect(readme).not.toContain('## 开发约定')
  expect(readme).not.toMatch(/[�锟]/)
})