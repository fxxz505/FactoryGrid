import type { FactoryProject, RecipeDefinition } from '../models/factory'

export const recipes: RecipeDefinition[] = [
  {
    id: 'smelt-iron',
    name: '铁锭',
    machine: 'furnace',
    inputs: [
      { shape: 'iron-ore', amount: 1 },
      { shape: 'coal-ore', amount: 1 }
    ],
    output: 'iron-ingot',
    durationTicks: 34,
    description: '铁矿与煤矿进入熔炉后烧制为铁锭。'
  },
  {
    id: 'smelt-copper',
    name: '铜锭',
    machine: 'furnace',
    inputs: [
      { shape: 'copper-ore', amount: 1 },
      { shape: 'coal-ore', amount: 1 }
    ],
    output: 'copper-ingot',
    durationTicks: 34,
    description: '铜矿与煤矿进入熔炉后烧制为铜锭。'
  },
  {
    id: 'smelt-steel',
    name: '钢材',
    machine: 'furnace',
    inputs: [
      { shape: 'iron-ingot', amount: 1 },
      { shape: 'coal-ore', amount: 1 }
    ],
    output: 'steel',
    durationTicks: 52,
    description: '铁锭与煤矿再次烧制为钢材。'
  },
  {
    id: 'iron-plate',
    name: '铁板',
    machine: 'assembler',
    inputs: [{ shape: 'iron-ingot', amount: 1 }],
    output: 'iron-plate',
    durationTicks: 18,
    description: '一个铁锭压制为铁板。'
  },
  {
    id: 'wire',
    name: '铜线',
    machine: 'assembler',
    inputs: [{ shape: 'copper-ingot', amount: 1 }],
    output: 'copper-wire',
    outputAmount: 2,
    durationTicks: 22,
    description: '一个铜锭拉制为两份铜线。'
  },
  {
    id: 'gear',
    name: '齿轮',
    machine: 'assembler',
    inputs: [{ shape: 'iron-plate', amount: 2 }],
    output: 'iron-gear',
    durationTicks: 28,
    description: '两块铁板合成为齿轮。'
  },
  {
    id: 'circuit',
    name: '电路',
    machine: 'assembler',
    inputs: [
      { shape: 'iron-plate', amount: 1 },
      { shape: 'copper-wire', amount: 2 }
    ],
    output: 'circuit',
    durationTicks: 42,
    description: '铁板与铜线合成为电路。'
  },
  {
    id: 'motor',
    name: '电机',
    machine: 'assembler',
    inputs: [
      { shape: 'iron-gear', amount: 1 },
      { shape: 'circuit', amount: 1 }
    ],
    output: 'motor',
    durationTicks: 56,
    description: '齿轮与电路组合成电机。',
    requiredResearch: 'metallurgy-automation'
  },
  {
    id: 'bearing', name: '轴承', machine: 'assembler',
    inputs: [{ shape: 'steel', amount: 1 }], output: 'bearing', durationTicks: 30,
    description: '钢材加工为精密轴承。', requiredResearch: 'metallurgy-automation'
  },
  {
    id: 'steel-frame', name: '钢制框架', machine: 'assembler',
    inputs: [{ shape: 'steel', amount: 2 }, { shape: 'iron-plate', amount: 2 }], output: 'steel-frame', durationTicks: 48,
    description: '钢材和铁板组装为结构框架。', requiredResearch: 'metallurgy-automation'
  },
  {
    id: 'processor', name: '处理器', machine: 'assembler',
    inputs: [{ shape: 'circuit', amount: 2 }, { shape: 'copper-wire', amount: 2 }], output: 'processor', durationTicks: 54,
    description: '电路和铜线制造高级处理器。', requiredResearch: 'advanced-electronics'
  },
  {
    id: 'servo', name: '伺服机构', machine: 'assembler',
    inputs: [{ shape: 'motor', amount: 1 }, { shape: 'circuit', amount: 1 }, { shape: 'bearing', amount: 1 }], output: 'servo', durationTicks: 64,
    description: '电机、电路和轴承构成伺服机构。', requiredResearch: 'robotics'
  },
  {
    id: 'automation-core', name: '自动化核心', machine: 'assembler',
    inputs: [{ shape: 'processor', amount: 1 }, { shape: 'steel-frame', amount: 1 }, { shape: 'servo', amount: 1 }], output: 'automation-core', durationTicks: 80,
    description: '高级电子、结构与执行部件组成自动化核心。', requiredResearch: 'automation-core'
  },
  {
    id: 'logistics-pack', name: '物流研究包', machine: 'assembler',
    inputs: [{ shape: 'iron-plate', amount: 1 }, { shape: 'copper-wire', amount: 1 }], output: 'logistics-pack', durationTicks: 30,
    description: '基础物流研究用研究包。'
  },
  {
    id: 'automation-pack', name: '自动化研究包', machine: 'assembler',
    inputs: [{ shape: 'iron-gear', amount: 1 }, { shape: 'circuit', amount: 1 }], output: 'automation-pack', durationTicks: 44,
    description: '机器升级研究用研究包。'
  },
  {
    id: 'metallurgy-pack', name: '冶金研究包', machine: 'assembler',
    inputs: [{ shape: 'steel', amount: 1 }, { shape: 'circuit', amount: 1 }], output: 'metallurgy-pack', durationTicks: 48,
    description: '高级冶金研究用研究包。'
  },
  {
    id: 'electronics-pack', name: '电子研究包', machine: 'assembler',
    inputs: [{ shape: 'circuit', amount: 2 }, { shape: 'copper-wire', amount: 2 }], output: 'electronics-pack', durationTicks: 50,
    description: '高级电子学研究用研究包。', requiredResearch: 'automation-upgrade'
  },
  {
    id: 'robotics-pack', name: '机器人研究包', machine: 'assembler',
    inputs: [{ shape: 'motor', amount: 1 }, { shape: 'bearing', amount: 1 }], output: 'robotics-pack', durationTicks: 62,
    description: '机器人技术研究用研究包。', requiredResearch: 'advanced-electronics'
  },
  {
    id: 'core-pack', name: '核心研究包', machine: 'assembler',
    inputs: [{ shape: 'servo', amount: 1 }, { shape: 'processor', amount: 1 }], output: 'core-pack', durationTicks: 72,
    description: '自动化核心研究用研究包。', requiredResearch: 'robotics'
  },
  {
    id: 'utility-pack', name: '效用研究包', machine: 'assembler',
    inputs: [{ shape: 'automation-core', amount: 1 }, { shape: 'servo', amount: 1 }, { shape: 'processor', amount: 1 }], output: 'utility-pack', durationTicks: 96,
    description: '终局规模化生产研究用研究包。', requiredResearch: 'automation-core'
  }
]

export const recipeById = Object.fromEntries(recipes.map((recipe) => [recipe.id, recipe])) as Record<string, RecipeDefinition>
export const furnaceRecipes = recipes.filter((recipe) => recipe.machine === 'furnace')
export const assemblerRecipes = recipes.filter((recipe) => recipe.machine === 'assembler')

export function recipeIsUnlocked(project: FactoryProject, recipe: RecipeDefinition): boolean {
  return !recipe.requiredResearch || project.research.completed.includes(recipe.requiredResearch)
}

export function unlockedAssemblerRecipes(project: FactoryProject): RecipeDefinition[] {
  return assemblerRecipes.filter((recipe) => recipeIsUnlocked(project, recipe))
}
