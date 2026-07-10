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
